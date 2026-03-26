/**
 * Tax Form Scanner — Unified scanning for W-2, 1099-NEC, 1099-K,
 * 1099-INT, 1099-DIV, 1099-B tax forms.
 *
 * Wraps saranOcrService for image/PDF scanning with expanded form types
 * and auto-detection. Supports camera, photo library, and PDF document sources.
 */

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { scanTaxDocument, type ScannedTaxData } from './saranOcrService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaxFormType =
  | 'W-2'
  | '1099-NEC'
  | '1099-K'
  | '1099-INT'
  | '1099-DIV'
  | '1099-B'
  | 'auto';

export interface ScannedFormResult {
  formType: TaxFormType;
  data: ScannedTaxData;
  sourceUri: string;
  sourceType: 'camera' | 'gallery' | 'pdf';
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface ScanError {
  code: 'CANCELLED' | 'PERMISSION_DENIED' | 'SCAN_FAILED' | 'INVALID_FILE' | 'NO_API_KEY';
  message: string;
}

// ─── Image Source Helpers ─────────────────────────────────────────────────────

/**
 * Launch camera to capture a tax form photo.
 * Returns the local URI or null if cancelled.
 */
export async function captureFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw { code: 'PERMISSION_DENIED', message: 'Camera permission is required to scan documents.' } as ScanError;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    quality: 0.9,
    allowsEditing: false,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Pick an image from the photo library.
 * Returns the local URI or null if cancelled.
 */
export async function pickFromGallery(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.9,
    allowsEditing: false,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Pick a PDF document using the system document picker.
 * Returns the local URI or null if cancelled.
 */
export async function pickPdfDocument(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

/**
 * Map expanded form types to the core OCR document types.
 * 1099-NEC, 1099-K → '1099' (generic 1099)
 * 1099-INT, 1099-DIV → '1099' (amounts in box1_compensation)
 * W-2 → 'W-2'
 * 1099-B → '1099-B'
 */
function mapToOcrType(formType: TaxFormType): 'W-2' | '1099' | '1099-B' {
  switch (formType) {
    case 'W-2':
      return 'W-2';
    case '1099-B':
      return '1099-B';
    case '1099-NEC':
    case '1099-K':
    case '1099-INT':
    case '1099-DIV':
      return '1099';
    case 'auto':
    default:
      return '1099'; // Let the OCR engine auto-detect
  }
}

/**
 * Scan a tax form from a file URI.
 * @param fileUri - Local file URI (image or PDF)
 * @param formType - Expected form type, or 'auto' for auto-detection
 * @param sourceType - How the file was obtained
 */
export async function scanTaxForm(
  fileUri: string,
  formType: TaxFormType = 'auto',
  sourceType: 'camera' | 'gallery' | 'pdf' = 'camera'
): Promise<ScannedFormResult> {
  const ocrType = mapToOcrType(formType);

  const data = await scanTaxDocument(fileUri, ocrType);

  if (!data) {
    throw {
      code: 'SCAN_FAILED',
      message: 'Could not extract data from the document. Please ensure the image is clear and try again.',
    } as ScanError;
  }

  // Determine the actual form type from the scanned data
  let detectedType: TaxFormType = formType;
  if (formType === 'auto') {
    if (data.type === 'W-2') detectedType = 'W-2';
    else if (data.type === '1099-B') detectedType = '1099-B';
    else detectedType = '1099-NEC'; // Default 1099 variant
  }

  // Confidence is high if form types match
  const confidence: 'high' | 'medium' | 'low' =
    formType === 'auto' ? 'medium' :
    data.type === ocrType.replace('-NEC', '').replace('-K', '').replace('-INT', '').replace('-DIV', '')
      ? 'high' : 'low';

  return {
    formType: detectedType,
    data,
    sourceUri: fileUri,
    sourceType,
    confidence,
    timestamp: Date.now(),
  };
}

/**
 * Full scan flow: capture/pick → scan → return result.
 * Returns null if the user cancels at any point.
 */
export async function scanFromCamera(formType: TaxFormType = 'auto'): Promise<ScannedFormResult | null> {
  const uri = await captureFromCamera();
  if (!uri) return null;
  return scanTaxForm(uri, formType, 'camera');
}

export async function scanFromGallery(formType: TaxFormType = 'auto'): Promise<ScannedFormResult | null> {
  const uri = await pickFromGallery();
  if (!uri) return null;
  return scanTaxForm(uri, formType, 'gallery');
}

export async function scanFromPdf(formType: TaxFormType = 'auto'): Promise<ScannedFormResult | null> {
  const uri = await pickPdfDocument();
  if (!uri) return null;
  return scanTaxForm(uri, formType, 'pdf');
}

// ─── Form Type Labels ─────────────────────────────────────────────────────────

export const FORM_TYPE_LABELS: Record<TaxFormType, string> = {
  'W-2': 'W-2 Wage Statement',
  '1099-NEC': '1099-NEC (Gig/Freelance Income)',
  '1099-K': '1099-K (Payment Card Income)',
  '1099-INT': '1099-INT (Interest Income)',
  '1099-DIV': '1099-DIV (Dividend Income)',
  '1099-B': '1099-B (Brokerage/Capital Gains)',
  auto: 'Auto-Detect Form Type',
};
