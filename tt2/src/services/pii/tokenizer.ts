import { TokenIds, Tokenizer } from "./types";

/**
 * BERT-compatible tokenizer for PII model.
 * Uses the actual vocabulary from the model assets.
 */

let vocab: Record<string, number> | null = null;
let reverseVocab: Record<number, string> | null = null;

function loadVocabulary(): boolean {
  if (vocab && reverseVocab) return true;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tokenizerConfig = require("@/assets/models/pii_model/tokenizer.json");
    if (tokenizerConfig?.model?.vocab) {
      vocab = tokenizerConfig.model.vocab;
      reverseVocab = {};
      for (const [token, id] of Object.entries(vocab!)) {
        reverseVocab![id as number] = token;
      }
      return true;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[Tokenizer] Failed to load vocabulary:", error);
  }
  
  return false;
}

function basicTokenize(text: string): Array<{ token: string; start: number; end: number }> {
  const tokens: Array<{ token: string; start: number; end: number }> = [];
  const normalizedText = text.toLowerCase().trim();
  
  let i = 0;
  while (i < normalizedText.length) {
    // Skip whitespace
    while (i < normalizedText.length && /\s/.test(normalizedText[i])) i++;
    if (i >= normalizedText.length) break;
    
    const start = i;
    let token = "";
    
    // Handle punctuation
    if (/[^\w\s]/.test(normalizedText[i])) {
      token = normalizedText[i];
      i++;
    } else {
      // Handle words
      while (i < normalizedText.length && /\w/.test(normalizedText[i])) {
        token += normalizedText[i];
        i++;
      }
    }
    
    if (token) {
      tokens.push({ token, start, end: i });
    }
  }
  
  return tokens;
}

function wordpieceTokenize(word: string): string[] {
  if (!vocab) return [word];
  
  if (word.length > 100) {
    return ["[UNK]"];
  }
  
  const tokens: string[] = [];
  let start = 0;
  
  while (start < word.length) {
    let end = word.length;
    let curSubstr = null;
    
    while (start < end) {
      let substr = word.slice(start, end);
      if (start > 0) {
        substr = "##" + substr;
      }
      
      if (vocab[substr] !== undefined) {
        curSubstr = substr;
        break;
      }
      end--;
    }
    
    if (curSubstr === null) {
      tokens.push("[UNK]");
      break;
    }
    
    tokens.push(curSubstr);
    start = end;
  }
  
  return tokens;
}

export function createBertTokenizer(maxSeqLen = 512): Tokenizer {
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
      if (!loadVocabulary()) {
        // Fallback to simple tokenization if vocab loading fails
        // eslint-disable-next-line no-console
        console.warn("[Tokenizer] Using fallback tokenization");
        return createFallbackTokenizer(maxSeqLen).encode(text);
      }

      const basicTokens = basicTokenize(text);
      const allTokens: Array<{ token: string; start: number; end: number }> = [];
      
      // Apply WordPiece tokenization
      for (const { token, start, end } of basicTokens) {
        const subTokens = wordpieceTokenize(token);
        const tokenLen = end - start;
        
        for (let i = 0; i < subTokens.length; i++) {
          const subStart = start + Math.floor((i * tokenLen) / subTokens.length);
          const subEnd = start + Math.floor(((i + 1) * tokenLen) / subTokens.length);
          allTokens.push({
            token: subTokens[i],
            start: subStart,
            end: subEnd,
          });
        }
      }

      // Convert to IDs
      const ids: number[] = [clsId];
      const attention: number[] = [1];
      const offsets: Array<{ start: number; end: number }> = [{ start: 0, end: 0 }];

      for (const { token, start, end } of allTokens) {
        if (ids.length >= maxSeqLen - 1) break; // Leave room for SEP
        
        const tokenId = vocab![token] ?? unkId;
        ids.push(tokenId);
        attention.push(1);
        offsets.push({ start, end });
      }

      // Add SEP token
      ids.push(sepId);
      attention.push(1);
      offsets.push({ start: text.length, end: text.length });

      // Pad to max length
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

function createFallbackTokenizer(maxSeqLen = 512): Tokenizer {
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
      // Simple whitespace tokenization as fallback
      const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      
      const ids: number[] = [clsId];
      const attention: number[] = [1];
      const offsets: Array<{ start: number; end: number }> = [{ start: 0, end: 0 }];

      let charPos = 0;
      for (const word of words) {
        if (ids.length >= maxSeqLen - 1) break;
        
        // Find word position in original text
        const wordStart = text.toLowerCase().indexOf(word, charPos);
        const wordEnd = wordStart + word.length;
        charPos = wordEnd;
        
        ids.push(unkId); // Use UNK for all tokens in fallback
        attention.push(1);
        offsets.push({ start: wordStart, end: wordEnd });
      }

      ids.push(sepId);
      attention.push(1);
      offsets.push({ start: text.length, end: text.length });

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

// Singleton tokenizer instance
export const tokenizer = createBertTokenizer();
