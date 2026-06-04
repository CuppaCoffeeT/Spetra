// Native / default OCR implementation.
//
// On native (iOS/Android), on-device OCR is provided by ML Kit's text
// recognizer. That requires a native module — @react-native-ml-kit/text-recognition —
// which is NOT installed here and cannot run inside Expo Go. It needs an EAS dev
// build (PRD R1) to link the native ML Kit binaries.
//
// Until that dev build exists, the native path returns { available: false } so the
// receipt flow degrades gracefully: the user can still fill the fields manually and
// attach the image. The documented extension point is below — install the package
// in an EAS dev build and replace the body of recognizeText() with a call to it:
//
//   import TextRecognition from '@react-native-ml-kit/text-recognition';
//   const result = await TextRecognition.recognize(imageUri);
//   return { text: result.text, available: true };
//
// On web, Metro resolves ocr.web.ts instead of this file (tesseract.js), so
// tesseract.js never enters the native bundle.

export type OcrResult = { text: string; available: boolean };

export async function recognizeText(imageUri: string): Promise<OcrResult> {
  // Native ML Kit isn't installed (requires an EAS dev build). Report
  // unavailable so the caller falls back to manual entry + image attach.
  return { text: '', available: false };
}
