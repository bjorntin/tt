import { TokenIds, Tokenizer } from "./types";

/**
 * Stub tokenizer for on-device NER integration scaffolding.
 * Replace with a real HF-compatible tokenizer once model assets are finalized.
 *
 * Current behavior:
 * - Whitespace split
 * - Deterministic numeric id mapping via a small hash
 * - Tracks character offsets for alignment back to OCR geometry
 */

function hashToken(tok: string): number {
  // Simple, deterministic hash to map tokens to a pseudo-id range.
  // Do NOT use in production for real models — replace with real vocab/BPE.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < tok.length; i++) {
    h ^= tok.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Keep in a BERT-like vocab id range while avoiding special ids
  return 1000 + (h % 30000);
}

export function createBasicTokenizer(maxSeqLen = 256): Tokenizer {
  const padId = 0;
  const clsId = 101;
  const sepId = 102;
  const unkId = 100;

  return {
    maxSeqLen,
    padId,
    clsId,
    sepId,
    unkId,
    encode(text: string): TokenIds {
      // Build simple word tokens with char spans
      const tokens: string[] = [];
      const spans: Array<{ start: number; end: number }> = [];

      let i = 0;
      while (i < text.length) {
        // Skip spaces
        while (i < text.length && /\s/.test(text[i])) i++;
        if (i >= text.length) break;
        const start = i;
        while (i < text.length && !/\s/.test(text[i])) i++;
        const end = i;
        tokens.push(text.slice(start, end));
        spans.push({ start, end });
      }

      // Convert tokens to ids, add [CLS] and [SEP]
      const ids: number[] = [clsId];
      const attention: number[] = [1];
      const offsets: Array<{ start: number; end: number }> = [{ start: 0, end: 0 }]; // placeholder for CLS

      for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        const id = tok.length > 0 ? hashToken(tok) : unkId;
        ids.push(id);
        attention.push(1);
        offsets.push(spans[t]);
        if (ids.length >= maxSeqLen - 1) break; // leave room for SEP
      }

      ids.push(sepId);
      attention.push(1);
      offsets.push({ start: text.length, end: text.length }); // SEP placeholder

      // Pad if needed
      while (ids.length < maxSeqLen) {
        ids.push(padId);
        attention.push(0);
        offsets.push({ start: 0, end: 0 });
      }

      return {
        inputIds: ids,
        attentionMask: attention,
        tokenCharOffsets: offsets,
      };
    },
  };
}

// Singleton default tokenizer instance
export const tokenizer = createBasicTokenizer();