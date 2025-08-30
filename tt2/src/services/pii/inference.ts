import { recognizeText } from "../ocr/mlkit";
import { tokenizer } from "./tokenizer";
import type { NerEntity, OcrResult, PiiFinding, ScanAnalysis } from "./types";

/**
 * On-device PII analysis pipeline (Android-first).
 * - OCR (ML Kit) to extract text and geometry
 * - NER (ONNX) to classify entities in text (stubbed; falls back to regex until ONNX is wired)
 * - Geometry mapping: map entity character spans to OCR word boxes
 *
 * Notes:
 * - This file intentionally avoids a hard import of onnxruntime-react-native so the app can compile
 *   before the dependency is added. We will lazy-require ORT when integrating the real model.
 */

const DEFAULT_CONF_THRESHOLD = 0.6;

/**
 * Regex-based fallback detectors (lightweight heuristics for local testing).
 * Replace with real ONNX NER outputs when the model is wired.
 */
function regexHeuristics(text: string): NerEntity[] {
  const entities: NerEntity[] = [];

  // Email
  const email = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  for (const m of text.matchAll(email)) {
    entities.push({ label: "EMAIL", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.9 });
  }

  // Phone (very permissive; e.g., +65 8123 4567 or 81234567 etc.)
  const phone = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b/g;
  for (const m of text.matchAll(phone)) {
    entities.push({ label: "PHONE_NUMBER", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.75 });
  }

  // Credit card (groups of 4, allow spaces or dashes)
  const cc = /\b(?:\d[ -]*?){13,19}\b/g;
  for (const m of text.matchAll(cc)) {
    // Simple Luhn check to reduce false positives
    const digits = m[0].replace(/[^\d]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      entities.push({ label: "CREDIT_CARD", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.85 });
    }
  }

  // IBAN (very simple; country code + 2 check digits + up to 30 alphanumerics)
  const iban = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
  for (const m of text.matchAll(iban)) {
    entities.push({ label: "IBAN", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.8 });
  }

  // Singapore NRIC/FIN (basic pattern, not exhaustive validation): S1234567A, F7654321Z, etc.
  const nric = /\b[STFG]\d{7}[A-Z]\b/g;
  for (const m of text.matchAll(nric)) {
    entities.push({ label: "NRIC", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.9 });
  }

  return entities;
}

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Attempt to run ONNX NER model (lazy loading). Returns null if not available yet.
 * Wire-up plan:
 * - Add onnxruntime-react-native
 * - Bundle model under app-private storage and load it here
 * - Convert tokenizer outputs to tensors and run session.run
 */
async function runOnnxNer(_text: string): Promise<NerEntity[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ort = require("onnxruntime-react-native");
    if (!ort) return null;

    // TODO: Load model session (once), cache globally, then run inference.
    // Placeholder: not implemented until ORT is added.
    return null;
  } catch {
    return null;
  }
}

/**
 * Map entity character spans to OCR word boxes by overlap of char ranges.
 */
function mapEntitiesToBoxes(ocr: OcrResult, entities: NerEntity[]): PiiFinding[] {
  // Precompute char spans for words if not provided
  const words = ocr.words.slice();
  if (words.length > 0 && (words[0].charStart === undefined || words[0].charEnd === undefined)) {
    // Build word char offsets by scanning fullText for each word token in sequence.
    // This is a naive aligner; OCR engines often give explicit offsets which we will use once available.
    let cursor = 0;
    for (let w = 0; w < words.length; w++) {
      const token = words[w].text;
      const idx = ocr.fullText.indexOf(token, cursor);
      if (idx >= 0) {
        words[w].charStart = idx;
        words[w].charEnd = idx + token.length;
        cursor = words[w].charEnd;
      }
    }
  }

  const findings: PiiFinding[] = [];
  for (const e of entities) {
    const overlappingBoxes = [];
    for (const w of words) {
      if (w.charStart === undefined || w.charEnd === undefined) continue;
      const overlap =
        Math.max(0, Math.min(e.end, w.charEnd) - Math.max(e.start, w.charStart));
      if (overlap > 0) {
        overlappingBoxes.push(w.bbox);
      }
    }
    if (overlappingBoxes.length > 0 || ocr.fullText.length > 0) {
      const snippet = ocr.fullText.slice(Math.max(0, e.start - 16), Math.min(ocr.fullText.length, e.end + 16));
      findings.push({
        label: e.label,
        score: e.score,
        snippet,
        boxes: overlappingBoxes,
      });
    }
  }
  return findings;
}

/**
 * Analyze a single image URI for PII.
 * - Runs OCR
 * - Runs ONNX NER if available; otherwise regex heuristics
 * - Maps entities back to image boxes
 */
export async function analyzeImageForPII(imageUri: string, confThreshold = DEFAULT_CONF_THRESHOLD): Promise<ScanAnalysis> {
  const ocr: OcrResult = await recognizeText(imageUri);

  const text = ocr.fullText ?? "";
  if (!text || text.trim().length === 0) {
    return { hasPii: false, findings: [] };
  }

  let entities = await runOnnxNer(text);
  if (!entities) {
    entities = regexHeuristics(text);
  }

  // Thresholding
  const filtered = entities.filter((e) => e.score >= confThreshold);

  const findings = mapEntitiesToBoxes(ocr, filtered);
  return {
    hasPii: findings.length > 0,
    findings,
  };
}
