/**
 * Common types for the on-device PII pipeline
 * These types are intentionally simple and UI-friendly.
 */

export type BBox = {
  x: number; // left
  y: number; // top
  w: number; // width
  h: number; // height
};

export type OcrWord = {
  text: string;
  bbox: BBox;
  confidence?: number;
  lineIndex?: number;
  wordIndex?: number;
  // Character start/end within the concatenated OCR fullText (optional, for alignment)
  charStart?: number;
  charEnd?: number;
};

export type OcrLine = {
  text: string;
  bbox: BBox;
  lineIndex: number;
  // Character start/end within the concatenated OCR fullText (optional)
  charStart?: number;
  charEnd?: number;
};

export type OcrResult = {
  fullText: string;
  words: OcrWord[];
  lines: OcrLine[];
  languageHints?: string[];
};

export type NerEntity = {
  label: string; // e.g., "CREDIT_CARD", "PHONE_NUMBER", etc.
  start: number; // char start in input text
  end: number;   // char end (exclusive) in input text
  score: number; // confidence 0..1
};

export type PiiFinding = {
  label: string;
  score: number;
  snippet: string;
  boxes: BBox[]; // union of word boxes that overlapped entity span
};

export type ScanAnalysis = {
  hasPii: boolean;
  findings: PiiFinding[];
  // Which engine produced the findings: 'onnx' when the exported model runs, otherwise 'regex'
  engine?: "onnx" | "regex";
};

export type TokenIds = {
  inputIds: number[];
  attentionMask: number[];
  // Map each token to its original char span (start, end) in the raw text
  tokenCharOffsets?: Array<{ start: number; end: number }>;
};

export type Tokenizer = {
  maxSeqLen: number;
  padId: number;
  clsId: number;
  sepId: number;
  unkId: number;
  // Encode raw text to token ids + attention mask and optional char offsets
  encode(text: string): TokenIds;
};