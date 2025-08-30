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

const DEFAULT_CONF_THRESHOLD = 0.75; // Balanced threshold for accuracy vs false positives
const PII_MAX_TEXT_LEN = 6000;

// ONNX availability check - lazy loaded to avoid module resolution issues at startup
let ONNX_AVAILABILITY_CHECKED = false;
let ONNX_AVAILABLE = false;

// ONNX session cache and helpers
let ortSession: any = null;
let ort: any = null;
let id2label: Record<string, string> | null = null;

async function checkOnnxAvailability(): Promise<boolean> {
  if (ONNX_AVAILABILITY_CHECKED) {
    // eslint-disable-next-line no-console
    console.log("[PII] ONNX availability already checked:", ONNX_AVAILABLE);
    return ONNX_AVAILABLE;
  }
  
  // eslint-disable-next-line no-console
  console.log("[PII] ===== CHECKING ONNX AVAILABILITY =====");
  
  try {
    // First check if onnxruntime-react-native is available
    // eslint-disable-next-line no-console
    console.log("[PII] Step 1: Checking onnxruntime-react-native...");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ortModule = require("onnxruntime-react-native");
    // eslint-disable-next-line no-console
    console.log(
      "[PII] ORT Module loaded:",
      typeof ortModule,
      Object.keys(ortModule || {}),
    );
    
    if (!ortModule?.InferenceSession) {
      // eslint-disable-next-line no-console
      console.error(
        "[PII] ONNX Runtime not available - InferenceSession missing",
      );
      // eslint-disable-next-line no-console
      console.log("[PII] Available ORT properties:", Object.keys(ortModule || {}));
      ONNX_AVAILABLE = false;
      ONNX_AVAILABILITY_CHECKED = true;
      return false;
    }
    // eslint-disable-next-line no-console
    console.log("[PII] ✓ ONNX Runtime InferenceSession found");

    // Then check if we can load the model asset
    // eslint-disable-next-line no-console
    console.log("[PII] Step 2: Loading model asset...");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const modelAsset = require("@/assets/models/pii_model/model.onnx");
    // eslint-disable-next-line no-console
    console.log("[PII] Model asset type:", typeof modelAsset, "value:", modelAsset);
    
    if (!modelAsset) {
      // eslint-disable-next-line no-console
      console.error("[PII] Model asset not found or invalid");
      ONNX_AVAILABLE = false;
      ONNX_AVAILABILITY_CHECKED = true;
      return false;
    }
    // eslint-disable-next-line no-console
    console.log("[PII] ✓ Model asset loaded successfully");

    ONNX_AVAILABLE = true;
    ONNX_AVAILABILITY_CHECKED = true;
    // eslint-disable-next-line no-console
    console.log("[PII] ===== ONNX FULLY AVAILABLE =====");
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[PII] ===== ONNX AVAILABILITY CHECK FAILED =====");
    // eslint-disable-next-line no-console
    console.error("[PII] Error details:", error);
    // eslint-disable-next-line no-console
    console.error("[PII] Error message:", String(error));
    // eslint-disable-next-line no-console
    console.error("[PII] Error stack:", (error as any)?.stack);
    ONNX_AVAILABLE = false;
    ONNX_AVAILABILITY_CHECKED = true;
    return false;
  }
}

async function ensureOrtSession(): Promise<boolean> {
  if (ortSession) {
    // eslint-disable-next-line no-console
    console.log("[PII] ONNX session already initialized");
    return true;
  }
  
  const isAvailable = await checkOnnxAvailability();
  if (!isAvailable) {
    // eslint-disable-next-line no-console
    console.warn("[PII] ONNX not available, cannot create session");
    return false;
  }

  try {
    // eslint-disable-next-line no-console
    console.log("[PII] Initializing ONNX session...");
    
    // Lazy require to avoid build-time linking issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ort = require("onnxruntime-react-native");
    if (!ort?.InferenceSession) {
      // eslint-disable-next-line no-console
      console.error("[PII] InferenceSession not available in ORT");
      return false;
    }

    // Copy ONNX model to app document directory for ONNX Runtime
    let modelPath: string | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const FileSystem = require("expo-file-system");

      const localPath = `${FileSystem.documentDirectory}pii_model.onnx`;

      // Check if model already exists locally (avoid re-copying)
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        // eslint-disable-next-line no-console
        console.log("[PII] ✓ Using existing local model file");
        modelPath = localPath;
      } else {
        // eslint-disable-next-line no-console
        console.log("[PII] Downloading/copying ONNX model to local storage...");

        // Get the asset module
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const onnxAssetModule = require("@/assets/models/pii_model/model.onnx");
        const asset = Asset.fromModule(onnxAssetModule);

        // eslint-disable-next-line no-console
        console.log("[PII] Asset URI:", asset.uri);
        // eslint-disable-next-line no-console
        console.log("[PII] Asset localUri:", asset.localUri);

        // In development, download from Metro dev server
        // In production, copy from bundled APK asset
        let sourceUri = asset.uri;

        // Check if this is a Metro dev server URL (development mode)
        if (asset.uri.includes('localhost:8081') || asset.uri.includes('unstable_path')) {
          // Development mode: download from Metro dev server
          // eslint-disable-next-line no-console
          console.log("[PII] Development mode: downloading from Metro dev server...");

          // Download the asset to local storage
          const downloadResult = await FileSystem.downloadAsync(asset.uri, localPath);
          // eslint-disable-next-line no-console
          console.log("[PII] ✓ Model downloaded successfully, status:", downloadResult.status);
          modelPath = localPath;
        } else {
          // Production mode: copy from bundled asset
          // eslint-disable-next-line no-console
          console.log("[PII] Production mode: copying from bundled asset...");

          // Use localUri if available (for APK assets), otherwise use uri
          sourceUri = asset.localUri || asset.uri;

          await FileSystem.copyAsync({
            from: sourceUri,
            to: localPath,
          });

          modelPath = localPath;
          // eslint-disable-next-line no-console
          console.log("[PII] ✓ Model copied from APK successfully");
        }
      }
    } catch (copyError) {
      // eslint-disable-next-line no-console
      console.error("[PII] Failed to download/copy model:", copyError);

      // Last resort fallback
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const onnxMod = require("@/assets/models/pii_model/model.onnx");
        const asset = Asset.fromModule(onnxMod);
        modelPath = asset.localUri || asset.uri;
        // eslint-disable-next-line no-console
        console.log("[PII] ⚠️ Using asset URI as last resort:", modelPath);
      } catch (fallbackError) {
        // eslint-disable-next-line no-console
        console.error("[PII] All model loading approaches failed:", fallbackError);
        return false;
      }
    }
    
    if (!modelPath) {
      // eslint-disable-next-line no-console
      console.error("[PII] No valid model path found");
      return false;
    }
    // eslint-disable-next-line no-console
    console.log("[PII] Final model path:", modelPath);

    // eslint-disable-next-line no-console
    console.log("[PII] Creating ONNX session...");
    ortSession = await ort.InferenceSession.create(modelPath);
    // eslint-disable-next-line no-console
    console.log("[PII] ONNX session created successfully");
    // eslint-disable-next-line no-console
    console.log("[PII] Input names:", ortSession.inputNames);
    // eslint-disable-next-line no-console
    console.log("[PII] Output names:", ortSession.outputNames);

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg = require("@/assets/models/pii_model/config.json");
      if (cfg?.id2label) {
        id2label = cfg.id2label as Record<string, string>;
        // eslint-disable-next-line no-console
        console.log("[PII] Loaded", Object.keys(id2label).length, "label mappings");
      }
    } catch (configError) {
      // eslint-disable-next-line no-console
      console.warn("[PII] Failed to load config:", configError);
      id2label = null;
    }

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[PII] Failed to initialize ONNX session:", error);
    ortSession = null;
    return false;
  }
}

function softmaxRow(row: Float32Array | number[]): number[] {
  const max = Math.max(...(row as number[]));
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
  const t =
    text.length > PII_MAX_TEXT_LEN ? text.slice(0, PII_MAX_TEXT_LEN) : text;
  const entities: NerEntity[] = [];

  // Email
  const email = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  for (const m of t.matchAll(email)) {
    entities.push({
      label: "EMAIL",
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      score: 0.9,
    });
  }

  // Phone (very permissive; e.g., +65 8123 4567 or 81234567 etc.)
  const phone =
    /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b/g;
  for (const m of t.matchAll(phone)) {
    entities.push({
      label: "PHONE_NUMBER",
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      score: 0.75,
    });
  }

  // Credit card (groups of 4, allow spaces or dashes)
  const cc = /\b(?:\d[ -]*?){13,19}\b/g;
  for (const m of t.matchAll(cc)) {
    // Simple Luhn check to reduce false positives
    const digits = m[0].replace(/[^\d]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      entities.push({
        label: "CREDIT_CARD",
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        score: 0.85,
      });
    }
  }

  // IBAN (very simple; country code + 2 check digits + up to 30 alphanumerics)
  const iban = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
  for (const m of t.matchAll(iban)) {
    entities.push({
      label: "IBAN",
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      score: 0.8,
    });
  }

  // Singapore NRIC/FIN (basic pattern, not exhaustive validation): S1234567A, F7654321Z, etc.
  const nric = /\b[STFG]\d{7}[A-Z]\b/g;
  for (const m of t.matchAll(nric)) {
    entities.push({
      label: "NRIC",
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      score: 0.9,
    });
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
 */
async function runOnnxNer(text: string): Promise<NerEntity[] | null> {
  // eslint-disable-next-line no-console
  console.log("[PII] ===== STARTING ONNX NER =====");
  // eslint-disable-next-line no-console
  console.log("[PII] Input text length:", text.length);
  // eslint-disable-next-line no-console
  console.log("[PII] Input text preview:", text.substring(0, 100) + "...");
  
  const ok = await ensureOrtSession();
  if (!ok || !ortSession) {
    // eslint-disable-next-line no-console
    console.error("[PII] ===== ONNX SESSION NOT AVAILABLE =====");
    // eslint-disable-next-line no-console
    console.error("[PII] Session OK:", ok, "Session exists:", !!ortSession);
    return null;
  }

  try {
    // Tokenize
    // eslint-disable-next-line no-console
    console.log("[PII] Step 1: Tokenizing text...");
    const enc = tokenizer.encode(text);
    const ids = enc.inputIds;
    const attn = enc.attentionMask;
    const seqLen = ids.length;
    // eslint-disable-next-line no-console
    console.log("[PII] ✓ Tokenized to", seqLen, "tokens");
    // eslint-disable-next-line no-console
    console.log("[PII] First 10 token IDs:", ids.slice(0, 10));

    // eslint-disable-next-line no-console
    console.log("[PII] Step 2: Creating tensor inputs...");

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
      // eslint-disable-next-line no-console
      console.log("[PII] ✓ Created int64 tensors");
    } catch {
      triedInt32 = true;
      feeds = makeFeeds(true);
      // eslint-disable-next-line no-console
      console.log("[PII] ✓ Created int32 tensors (fallback)");
    }

    // Name reconciliation: some models include token_type_ids; add zero tensor if required
    const inputNames: string[] = (ortSession.inputNames as string[]) ?? ["input_ids", "attention_mask"];
    if (inputNames.includes("token_type_ids")) {
      const zero = (triedInt32 ? Int32Array : BigInt64Array).from(
        new Array(seqLen).fill(triedInt32 ? 0 : BigInt(0)) as any,
      );
      feeds["token_type_ids"] = new ort.Tensor(triedInt32 ? "int32" : "int64", zero as any, [1, seqLen]);
      // eslint-disable-next-line no-console
      console.log("[PII] ✓ Added token_type_ids tensor");
    }

    // eslint-disable-next-line no-console
    console.log("[PII] Step 3: Running ONNX inference...");
    const results = await ortSession.run(feeds);
    // eslint-disable-next-line no-console
    console.log("[PII] ✓ ONNX inference completed");
    
    const logits = results?.logits;
    if (!logits || !logits.data || !logits.dims || logits.dims.length < 3) {
      // eslint-disable-next-line no-console
      console.error("[PII] Invalid logits output:", logits);
      return null;
    }

    const [/*b*/, T, C] = logits.dims;
    const data = logits.data as Float32Array;
    // eslint-disable-next-line no-console
    console.log("[PII] ✓ Logits shape:", logits.dims, "Data length:", data.length);

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

    // eslint-disable-next-line no-console
    console.log("[PII] ✓ Extracted", entities.length, "entities");
    return entities;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[PII] ONNX inference failed:", error);
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
    const isOnnxAvailable = await checkOnnxAvailability();
    return { hasPii: false, findings: [], engine: isOnnxAvailable ? "onnx" : "regex" };
  }

  let engine: "onnx" | "regex" = "regex";
  
  // Force attempt ONNX first, with detailed logging
  // eslint-disable-next-line no-console
  console.log("[PII] ===== ATTEMPTING ONNX INFERENCE =====");
  let entities = await runOnnxNer(text);
  
  if (entities && entities.length > 0) {
    engine = "onnx";
    // eslint-disable-next-line no-console
    console.log("[PII] ✅ ONNX inference successful, found", entities.length, "entities");
  } else {
    // eslint-disable-next-line no-console
    console.log("[PII] ⚠️ ONNX inference failed or returned no entities, falling back to regex");
    entities = regexHeuristics(text);
    engine = "regex";
  }
  
  // eslint-disable-next-line no-console
  console.log("[PII] Final engine used:", engine);

  // Enhanced thresholding and filtering with improved logic
  const filtered = entities.filter((e) => {
    // Apply confidence threshold
    if (e.score < confThreshold) return false;

    // Additional filtering for common false positives
    const snippet = text.slice(e.start, e.end).trim();

    // Filter out overly broad PII types that cause false positives
    const overlyBroadTypes = [
      'COMPANYNAME', 'CITY', 'COUNTY', 'STATE', 'COUNTRY',
      'JOBTITLE', 'JOBTYPE', 'JOBAREA', 'PREFIX',
      'ORDINALDIRECTION', 'CURRENCY', 'CURRENCYSYMBOL', 'CURRENCYNAME', 'CURRENCYCODE',
      'TIME', 'AGE', 'GENDER', 'SEX', 'HEIGHT', 'EYECOLOR',
      'BUILDINGNUMBER', 'STREET', 'SECONDARYADDRESS'
    ];

    // Skip overly broad entity types
    if (overlyBroadTypes.includes(e.label)) {
      return false;
    }

    // Allow legitimate short PII (state codes, country codes, etc.)
    const legitimateShortPII = [
      // US State codes
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      // Country codes
      'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN', 'IN', 'BR', 'MX', 'KR', 'RU', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'PT', 'GR', 'TR', 'TH', 'MY', 'SG', 'PH', 'VN', 'ID', 'HK', 'TW',
      // Common abbreviations that could be PII
      'SSN', 'DOB', 'PIN', 'CVV', 'ZIP', 'APT', 'STE', 'BLDG'
    ];

    // Allow short snippets that are legitimate PII
    if (snippet.length <= 3 && legitimateShortPII.includes(snippet.toUpperCase())) {
      return true;
    }

    // Filter out very short detections that are unlikely to be PII
    if (snippet.length < 2) return false;

    // Filter out single characters (except numbers which could be part of PII)
    if (snippet.length === 1 && /[a-zA-Z]/.test(snippet)) return false;

    // Expanded list of common words that are unlikely to be PII
    const commonWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'this', 'that', 'these', 'those', 'a', 'an', 'as', 'if', 'it',
      'its', 'they', 'them', 'their', 'then', 'there', 'here', 'when', 'where',
      'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'now', 'also', 'even', 'ever', 'never', 'always'
    ];

    // Only filter out common words if confidence is low (below 0.8)
    if (commonWords.includes(snippet.toLowerCase()) && e.score < 0.8) {
      return false;
    }

    // Allow high-confidence detections even if they're common words
    if (commonWords.includes(snippet.toLowerCase()) && e.score >= 0.8) {
      return true;
    }

    return true;
  });
  
  // eslint-disable-next-line no-console
  console.log(`[PII] Filtered ${entities.length} entities down to ${filtered.length} after thresholding and validation`);

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
    const isOnnxAvailable = await checkOnnxAvailability();
    return { hasPii: false, findings: [], engine: isOnnxAvailable ? "onnx" : "regex" };
  }

  let engine: "onnx" | "regex" = "regex";
  
  // Force attempt ONNX first, with detailed logging
  // eslint-disable-next-line no-console
  console.log("[PII] ===== ATTEMPTING ONNX INFERENCE (OCR) =====");
  let entities = await runOnnxNer(text);
  
  if (entities && entities.length > 0) {
    engine = "onnx";
    // eslint-disable-next-line no-console
    console.log("[PII] ✅ ONNX inference successful, found", entities.length, "entities");
  } else {
    // eslint-disable-next-line no-console
    console.log("[PII] ⚠️ ONNX inference failed or returned no entities, falling back to regex");
    entities = regexHeuristics(text);
    engine = "regex";
  }
  
  // eslint-disable-next-line no-console
  console.log("[PII] Final engine used:", engine);

  // Enhanced thresholding and filtering with improved logic
  const filtered = entities.filter((e) => {
    // Apply confidence threshold
    if (e.score < confThreshold) return false;

    // Additional filtering for common false positives
    const snippet = text.slice(e.start, e.end).trim();

    // Filter out overly broad PII types that cause false positives
    const overlyBroadTypes = [
      'COMPANYNAME', 'CITY', 'COUNTY', 'STATE', 'COUNTRY',
      'JOBTITLE', 'JOBTYPE', 'JOBAREA', 'PREFIX',
      'ORDINALDIRECTION', 'CURRENCY', 'CURRENCYSYMBOL', 'CURRENCYNAME', 'CURRENCYCODE',
      'TIME', 'AGE', 'GENDER', 'SEX', 'HEIGHT', 'EYECOLOR',
      'BUILDINGNUMBER', 'STREET', 'SECONDARYADDRESS'
    ];

    // Skip overly broad entity types
    if (overlyBroadTypes.includes(e.label)) {
      return false;
    }

    // Allow legitimate short PII (state codes, country codes, etc.)
    const legitimateShortPII = [
      // US State codes
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      // Country codes
      'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN', 'IN', 'BR', 'MX', 'KR', 'RU', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'PT', 'GR', 'TR', 'TH', 'MY', 'SG', 'PH', 'VN', 'ID', 'HK', 'TW',
      // Common abbreviations that could be PII
      'SSN', 'DOB', 'PIN', 'CVV', 'ZIP', 'APT', 'STE', 'BLDG'
    ];

    // Allow short snippets that are legitimate PII
    if (snippet.length <= 3 && legitimateShortPII.includes(snippet.toUpperCase())) {
      return true;
    }

    // Filter out very short detections that are unlikely to be PII
    if (snippet.length < 2) return false;

    // Filter out single characters (except numbers which could be part of PII)
    if (snippet.length === 1 && /[a-zA-Z]/.test(snippet)) return false;

    // Expanded list of common words that are unlikely to be PII
    const commonWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'this', 'that', 'these', 'those', 'a', 'an', 'as', 'if', 'it',
      'its', 'they', 'them', 'their', 'then', 'there', 'here', 'when', 'where',
      'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'now', 'also', 'even', 'ever', 'never', 'always'
    ];

    // Only filter out common words if confidence is low (below 0.8)
    if (commonWords.includes(snippet.toLowerCase()) && e.score < 0.8) {
      return false;
    }

    // Allow high-confidence detections even if they're common words
    if (commonWords.includes(snippet.toLowerCase()) && e.score >= 0.8) {
      return true;
    }

    return true;
  });
  
  // eslint-disable-next-line no-console
  console.log(`[PII] Filtered ${entities.length} entities down to ${filtered.length} after thresholding and validation`);
  const findings = mapEntitiesToBoxes(ocr, filtered);

  return {
    hasPii: findings.length > 0,
    findings,
    engine,
  };
}
