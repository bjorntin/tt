/* eslint-disable no-console */
import { OcrResult } from "../pii/types";

/**
 * ML Kit Text Recognition v2 wrapper (Android-first).
 * This is a stub to keep the app compiling until native OCR is wired.
 * It returns an empty result and logs a single warning.
 *
 * Integration plan (Android):
 * - Add ML Kit dependency with on-device model bundled:
 *   com.google.mlkit:text-recognition:16.x.x
 * - Expose a small NativeModule to accept an image URI and return lines/words with boxes.
 * - Replace this stub with the native bridge call.
 */

let warned = false;

export async function recognizeText(_imageUri: string): Promise<OcrResult> {
  if (!warned) {
    // eslint-disable-next-line no-console
    console.warn(
      "[OCR] ML Kit OCR not wired yet; returning empty result. This is a stub.",
    );
    warned = true;
  }
  return {
    fullText: "",
    words: [],
    lines: [],
  };
}
