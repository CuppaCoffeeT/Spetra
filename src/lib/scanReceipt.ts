// Reusable receipt-scan flow helper (no React, plain async).
//
// Wraps expo-image-picker (Expo-Go-safe on all platforms) -> on-device OCR
// (recognizeText: ML Kit on native via EAS dev build, tesseract.js on web) ->
// shared field extraction (extractReceiptFields). When OCR is unavailable
// (native without a dev build), ocrAvailable is false and fields are empty so
// the caller can fall back to manual entry while still attaching the image.

import * as ImagePicker from 'expo-image-picker';
import { recognizeText } from '../services/ocr';
import { extractReceiptFields } from '../services/parser';

export type ScanResult = {
  imageUri: string;
  text: string;
  ocrAvailable: boolean;
  fields: {
    amount: number | null;
    transactionDate: string | null;
    merchant: string | null;
  };
} | null;

export async function scanReceipt(
  source: 'camera' | 'library'
): Promise<ScanResult> {
  // 1. Request the appropriate permission.
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  // 2. Capture / pick an image.
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const imageUri = result.assets[0].uri;

  // 3. On-device OCR + shared field extraction.
  const { text, available } = await recognizeText(imageUri);
  const fields = extractReceiptFields(text);

  return { imageUri, text, ocrAvailable: available, fields };
}
