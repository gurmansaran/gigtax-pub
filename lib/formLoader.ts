/**
 * Load bundled PDF assets (e.g. f1040.pdf) as base64 for pdf-lib.
 * Requires metro.config.js to include 'pdf' in assetExts.
 */

import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';

type PdfAssetKey = 'f1040';
const PDF_ASSETS: Record<PdfAssetKey, number> = {
  f1040: require('../assets/pdfs/f1040.pdf') as number,
};

export type { PdfAssetKey };

/**
 * Load a PDF asset as a base64 string.
 * Use for pdf-lib: PDFDocument.load(Buffer.from(base64, 'base64')) or equivalent.
 */
export async function loadPdfAsBase64(key: PdfAssetKey): Promise<string> {
  const module = PDF_ASSETS[key];
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`Failed to resolve PDF asset: ${key}`);
  }
  const base64 = await readAsStringAsync(asset.localUri, {
    encoding: 'base64',
  });
  return base64;
}

/**
 * Load f1040.pdf as base64. Convenience wrapper.
 */
export async function loadF1040Base64(): Promise<string> {
  return loadPdfAsBase64('f1040');
}
