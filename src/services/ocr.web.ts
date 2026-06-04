// Web OCR implementation.
//
// Metro resolves this file (ocr.web.ts) on web and the base ocr.ts on native, so
// tesseract.js stays out of the native bundle. tesseract.js performs free,
// on-device (in-browser) OCR — no server, no API key (PRD D1).

import Tesseract from 'tesseract.js';

export type OcrResult = { text: string; available: boolean };

export async function recognizeText(imageUri: string): Promise<OcrResult> {
  try {
    const { data } = await Tesseract.recognize(imageUri, 'eng');
    return { text: data.text, available: true };
  } catch {
    // OCR failed (bad image, worker error) — degrade to manual entry.
    return { text: '', available: false };
  }
}
