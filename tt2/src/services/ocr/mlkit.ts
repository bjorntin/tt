import { NativeModules, Platform } from "react-native";
import type { OcrResult, OcrWord, OcrLine, BBox } from "../pii/types";

/**
 * ML Kit Text Recognition v2 wrapper (Android-first).
 * Uses the native module OcrMlkit (Kotlin) if available; otherwise falls back to a stub.
 * The ML Kit dependency is bundled via the config plugin:
 *   ["./config-plugins/withMlkitTextRecognition"]
 */

const native: any = (NativeModules as any)?.OcrMlkit;
let warned = false;

function warnOnce(message: string) {
  if (!warned) {
    // eslint-disable-next-line no-console
    console.warn(message);
    warned = true;
  }
}

function mapBox(box: any | undefined): BBox {
  if (!box) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: Number(box.x ?? 0),
    y: Number(box.y ?? 0),
    w: Number(box.w ?? 0),
    h: Number(box.h ?? 0),
  };
}

function mapWord(w: any): OcrWord {
  return {
    text: String(w.text ?? ""),
    bbox: mapBox(w.bbox),
    confidence: typeof w.confidence === "number" ? w.confidence : undefined,
    lineIndex: typeof w.lineIndex === "number" ? w.lineIndex : undefined,
    wordIndex: typeof w.wordIndex === "number" ? w.wordIndex : undefined,
    // charStart/charEnd are not provided by ML Kit; alignment is handled later
  };
}

function mapLine(l: any, idx: number): OcrLine {
  return {
    text: String(l.text ?? ""),
    bbox: mapBox(l.bbox),
    lineIndex: typeof l.lineIndex === "number" ? l.lineIndex : idx,
  };
}

export async function recognizeText(imageUri: string): Promise<OcrResult> {
  // Only Android has the native module right now
  if (Platform.OS !== "android" || !native?.recognize) {
    warnOnce(
      "[OCR] ML Kit native module not available; returning empty OCR result.",
    );
    return {
      fullText: "",
      words: [],
      lines: [],
    };
  }

  try {
    const raw = await native.recognize(imageUri);
    const words: OcrWord[] = Array.isArray(raw?.words)
      ? raw.words.map(mapWord)
      : [];
    const lines: OcrLine[] = Array.isArray(raw?.lines)
      ? raw.lines.map((l: any, i: number) => mapLine(l, i))
      : [];

    return {
      fullText: String(raw?.fullText ?? ""),
      words,
      lines,
    };
  } catch (e) {
    warnOnce(`[OCR] ML Kit recognize() failed: ${String(e)}`);
    return {
      fullText: "",
      words: [],
      lines: [],
    };
  }
}
