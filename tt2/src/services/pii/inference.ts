import { recognizeText } from "../ocr/mlkit";
import { tokenizer } from "./tokenizer";
import type { NerEntity, OcrResult, PiiFinding, ScanAnalysis } from "./types";
import { Asset } from "expo-asset";

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
const PII_MAX_TEXT_LEN = 6000;

// Detect ONNX model asset availability at runtime.
// We keep this very defensive: if any step fails, we treat ONNX as unavailable and fall back to regex.
let ONNX_AVAILABLE = false;
(function detectOnnxAsset() {
  try {
    // Requiring the asset will throw if Metro cannot find/bundle it.
    // Path relative to this file: ../../assets/models/pii_model/model.onnx
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../../assets/models/pii_model/model.onnx");
    if (mod) {
      ONNX_AVAILABLE = true;
    }
  } catch {
    ONNX_AVAILABLE = false;
  }
})();

// ONNX session cache and helpers
let ortSession: any = null;
let ort: any = null;
let id2label: Record<string, string> | null = null;

async function ensureOrtSession(): Promise<boolean> {
  if (ortSession) return true;
  if (!ONNX_AVAILABLE) return false;

  try {
    // Lazy require to avoid build-time linking issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ort = require("onnxruntime-react-native");
    if (!ort?.InferenceSession) return false;

    // Resolve bundled asset to a local file path
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const onnxMod = require("../../assets/models/pii_model/model.onnx");
    const asset = Asset.fromModule(onnxMod);
    await asset.downloadAsync();
    const modelPath = asset.localUri ?? asset.uri;
    if (!modelPath) return false;

    ortSession = await ort.InferenceSession.create(modelPath);

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg = require("../../assets/models/pii_model/config.json");
      if (cfg?.id2label) {
        id2label = cfg.id2label as Record<string, string>;
      }
    } catch {
      id2label = null;
    }

    return true;
  } catch {
    ortSession = null;
    return false;
  }
}

function softmaxRow(row: Float32Array | number[]): number[] {
  const max = Math.max(...row as number[]);
  const exps = (row as number[]).map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / (sum || 1));
}

function baseLabelOf(lbl: string): string {
  if (!lbl) return lbl;
  if (lbl.startsWith("B-") || lbl.startsWith("I-")) return lbl.slice(2);
  return lbl;
}

/**
 * Regex-based fallback detectors (lightweight heuristics for local testing).
 * Replace with real ONNX NER outputs when the model is wired.
 */
function regexHeuristics(text: string): NerEntity[] {
  const t = text.length > PII_MAX_TEXT_LEN ? text.slice(0, PII_MAX_TEXT_LEN) : text;
  const entities: NerEntity[] = [];

  // Email
  const email = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  for (const m of t.matchAll(email)) {
    entities.push({ label: "EMAIL", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.9 });
  }

  // Phone (very permissive; e.g., +65 8123 4567 or 81234567 etc.)
  const phone = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b/g;
  for (const m of t.matchAll(phone)) {
    entities.push({ label: "PHONE_NUMBER", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.75 });
  }

  // Credit card (groups of 4, allow spaces or dashes)
  const cc = /\b(?:\d[ -]*?){13,19}\b/g;
  for (const m of t.matchAll(cc)) {
    // Simple Luhn check to reduce false positives
    const digits = m[0].replace(/[^\d]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      entities.push({ label: "CREDIT_CARD", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.85 });
    }
  }

  // IBAN (very simple; country code + 2 check digits + up to 30 alphanumerics)
  const iban = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
  for (const m of t.matchAll(iban)) {
    entities.push({ label: "IBAN", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, score: 0.8 });
  }

  // Singapore NRIC/FIN (basic pattern, not exhaustive validation): S1234567A, F7654321Z, etc.
  const nric = /\b[STFG]\d{7}[A-Z]\b/g;
  for (const m of t.matchAll(nric)) {
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
async function runOnnxNer(text: string): Promise<NerEntity[] | null> {
  if (!ONNX_AVAILABLE) return null;
  const ok = await ensureOrtSession();
  if (!ok || !ortSession) return null;

  try {
    // Tokenize
    const enc = tokenizer.encode(text);
    const ids = enc.inputIds;
    const attn = enc.attentionMask;
    const seqLen = ids.length;

    // Try int64 first (BigInt), fall back to int32 if needed
    let feeds: Record<string, any> = {};
    let triedInt32 = false;

    const makeFeeds = (useInt32: boolean) => {
      if (useInt32) {
        const idsArr = Int32Array.from(ids);
        const attnArr = Int32Array.from(attn);
        return {
          input_ids: new ort.Tensor("int32", idsArr, [1, seqLen]),
          attention_mask: new ort.Tensor("int32", attnArr, [1, seqLen]),
        };
      } else {
        const idsArr = BigInt64Array.from(ids.map((n) => BigInt(n)));
        const attnArr = BigInt64Array.from(attn.map((n) => BigInt(n)));
        return {
          input_ids: new ort.Tensor("int64", idsArr, [1, seqLen]),
          attention_mask: new ort.Tensor("int64", attnArr, [1, seqLen]),
        };
      }
    };

    try {
      feeds = makeFeeds(false);
    } catch {
      triedInt32 = true;
      feeds = makeFeeds(true);
    }

    // Name reconciliation: some models include token_type_ids; add zero tensor if required
    const inputNames: string[] = (ortSession.inputNames as string[]) ?? ["input_ids", "attention_mask"];
    if (inputNames.includes("token_type_ids")) {
      const zero = (triedInt32 ? Int32Array : BigInt64Array).from(
        new Array(seqLen).fill(triedInt32 ? 0 : BigInt(0)) as any,
      );
      feeds["token_type_ids"] = new ort.Tensor(triedInt32 ? "int32" : "int64", zero as any, [1, seqLen]);
    }

    const results = await ortSession.run(feeds);
    const logits = results?.logits;
    if (!logits || !logits.data || !logits.dims || logits.dims.length < 3) return null;

    const [/*b*/, T, C] = logits.dims;
    const data = logits.data as Float32Array;

    // Build entities by collapsing contiguous non-"O" tokens using tokenizer offsets
    const offsets = enc.tokenCharOffsets ?? [];
    const entities: NerEntity[] = [];

    let iToken = 0;
    // Skip [CLS] if present (our tokenizer adds CLS at index 0)
    const startIdx = 1;
    const endIdx = T - 1; // skip [SEP] placeholder at the end if shapes align

    let currentLabel = "";
    let currentStart = -1;
    let currentEnd = -1;
    let currentScore = 0;

    for (let t = startIdx; t < endIdx && t < offsets.length; t++) {
      const row = data.slice(t * C, (t + 1) * C) as unknown as Float32Array;
      const probs = softmaxRow(row);
      let bestIdx = 0;
      let bestProb = probs[0];
      for (let c = 1; c < C; c++) {
        if (probs[c] > bestProb) {
          bestProb = probs[c];
          bestIdx = c;
        }
      }

      const rawLabel = id2label ? (id2label[String(bestIdx)] ?? `LABEL_${bestIdx}`) : `LABEL_${bestIdx}`;
      const base = baseLabelOf(rawLabel);

      const span = offsets[t] ?? { start: 0, end: 0 };
      const isValidSpan = typeof span.start === "number" && typeof span.end === "number" && span.end > span.start;

      if (!isValidSpan || rawLabel === "O" || base === "O") {
        // Flush current entity if any
        if (currentLabel) {
          entities.push({
            label: currentLabel,
            start: currentStart,
            end: currentEnd,
            score: currentScore,
          });
          currentLabel = "";
        }
        continue;
      }

      if (!currentLabel || base !== currentLabel) {
        // Start new entity
        if (currentLabel) {
          entities.push({
            label: currentLabel,
            start: currentStart,
            end: currentEnd,
            score: currentScore,
          });
        }
        currentLabel = base;
        currentStart = span.start;
        currentEnd = span.end;
        currentScore = bestProb;
      } else {
        // Continue current entity
        currentEnd = Math.max(currentEnd, span.end);
        currentScore = Math.max(currentScore, bestProb);
      }

      iToken++;
    }

    // Flush tail
    if (currentLabel) {
      entities.push({
        label: currentLabel,
        start: currentStart,
        end: currentEnd,
        score: currentScore,
      });
    }

    return entities;
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
    return { hasPii: false, findings: [], engine: ONNX_AVAILABLE ? "onnx" : "regex" };
  }

  let engine: "onnx" | "regex" = "regex";
  let entities = await runOnnxNer(text);
  if (entities && entities.length > 0) {
    engine = "onnx";
  } else {
    entities = regexHeuristics(text);
    engine = "regex";
  }

  // Thresholding
  const filtered = entities.filter((e) => e.score >= confThreshold);

  const findings = mapEntitiesToBoxes(ocr, filtered);
  return {
    hasPii: findings.length > 0,
    findings,
    engine,
  };
}


// Append: analyzeOcrForPII to run PII on an already-available OCR result
export async function analyzeOcrForPII(ocr: OcrResult, confThreshold = DEFAULT_CONF_THRESHOLD): Promise<ScanAnalysis> {
  const text = ocr.fullText ?? "";
  if (!text || text.trim().length === 0) {
    return { hasPii: false, findings: [], engine: ONNX_AVAILABLE ? "onnx" : "regex" };
  }

  let engine: "onnx" | "regex" = "regex";
  let entities = await runOnnxNer(text);
  if (entities && entities.length > 0) {
    engine = "onnx";
  } else {
    entities = regexHeuristics(text);
    engine = "regex";
  }

  const filtered = entities.filter((e) => e.score >= confThreshold);
  const findings = mapEntitiesToBoxes(ocr, filtered);

  return {
    hasPii: findings.length > 0,
    findings,
    engine,
  };
}
