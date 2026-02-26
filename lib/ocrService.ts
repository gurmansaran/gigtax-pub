/**
 * Tax Document OCR Service
 * Routes all AI calls through the scan-tax-form Supabase Edge Function.
 * The Anthropic API key lives only in Deno env — never in the app bundle.
 */

import { readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export type DocType = 'W-2' | '1099' | '1099-B';

export interface OcrW2Result {
  formType: 'W-2';
  employer: string;
  ein?: string;
  wages: number;
  fedTax: number;
  box3_ssWages?: number;
  box4_ssTax?: number;
  box5_medicareWages?: number;
  box6_medicareTax?: number;
}

export interface Ocr1099Result {
  formType: '1099';
  payer: string;
  ein?: string;
  box1_compensation: number;
  box4_fedWithheld: number;
  tips?: number;
  isTip?: boolean;
}

/** 1099-B Brokerage: Realized Gain/Loss. */
export interface Ocr1099BResult {
  formType: '1099-B';
  payer: string;
  /** Net realized gain (positive) or loss (negative). */
  realizedGainLoss: number;
  shortTerm?: number;
  longTerm?: number;
}

export type OcrTaxResult = OcrW2Result | Ocr1099Result | Ocr1099BResult;

/**
 * Read file as Base64 string.
 */
async function readFileAsBase64(fileUri: string): Promise<string> {
  return readAsStringAsync(fileUri, { encoding: 'base64' });
}

/** Detect media type from file URI. */
function getMediaType(fileUri: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' {
  const lower = fileUri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

// Map DocType to the formType hint the edge function expects
function toEdgeFormType(docType: DocType): string {
  if (docType === '1099') return '1099-NEC';
  return docType; // 'W-2' | '1099-B' pass through unchanged
}

const nonNeg = (v: number) => (v >= 0 ? v : 0);

/**
 * Analyse a tax document by sending it to the scan-tax-form edge function.
 * No Anthropic key is required in the app — it lives only in the edge function env.
 */
export async function analyzeTaxDocument(
  fileUri: string,
  docType: DocType
): Promise<OcrTaxResult | null> {
  const base64 = await readFileAsBase64(fileUri);
  const mediaType = getMediaType(fileUri);

  const { data: response, error } = await supabase.functions.invoke('scan-tax-form', {
    body: {
      imageBase64: base64,
      mediaType,
      formType: toEdgeFormType(docType),
    },
  });

  if (error) {
    throw new Error(`scan-tax-form edge function error: ${error.message}`);
  }
  if (!response?.success) {
    throw new Error(response?.error || 'Tax document scan failed');
  }

  const obj = response.data as Record<string, unknown>;

  // W-2
  if (obj.formType === 'W-2') {
    const wages = typeof obj.wages === 'number' ? nonNeg(obj.wages) : 0;
    const fedTax = typeof obj.fedTax === 'number' ? nonNeg(obj.fedTax) : 0;
    return {
      formType: 'W-2',
      employer: typeof obj.employer === 'string' ? obj.employer : 'Unknown',
      ein: typeof obj.ein === 'string' ? obj.ein : undefined,
      wages,
      fedTax: Math.min(fedTax, wages),
      box3_ssWages: typeof obj.box3_ssWages === 'number' ? nonNeg(obj.box3_ssWages) : undefined,
      box4_ssTax: typeof obj.box4_ssTax === 'number' ? nonNeg(obj.box4_ssTax) : undefined,
      box5_medicareWages: typeof obj.box5_medicareWages === 'number' ? nonNeg(obj.box5_medicareWages) : undefined,
      box6_medicareTax: typeof obj.box6_medicareTax === 'number' ? nonNeg(obj.box6_medicareTax) : undefined,
    };
  }

  // 1099 variants (NEC, MISC, K) — map to unified 1099 type
  if (
    obj.formType === '1099' ||
    obj.formType === '1099-NEC' ||
    obj.formType === '1099-K' ||
    obj.formType === '1099-INT' ||
    obj.formType === '1099-DIV' ||
    obj.formType === '1099-MISC'
  ) {
    // Normalise field names across 1099 variants
    const comp =
      typeof obj.box1_compensation === 'number' ? nonNeg(obj.box1_compensation) :
      typeof obj.box1a_grossAmount === 'number' ? nonNeg(obj.box1a_grossAmount) :
      typeof obj.box1_interest === 'number' ? nonNeg(obj.box1_interest) :
      typeof obj.box1a_ordinaryDividends === 'number' ? nonNeg(obj.box1a_ordinaryDividends) : 0;
    const withheld = typeof obj.box4_fedWithheld === 'number' ? nonNeg(obj.box4_fedWithheld) : 0;
    return {
      formType: '1099',
      payer: typeof obj.payer === 'string' ? obj.payer : 'Unknown',
      ein: typeof obj.ein === 'string' ? obj.ein : undefined,
      box1_compensation: comp,
      box4_fedWithheld: Math.min(withheld, comp),
      tips: typeof obj.tips === 'number' ? nonNeg(obj.tips) : 0,
      isTip: !!obj.isTip,
    };
  }

  // 1099-B
  if (obj.formType === '1099-B') {
    return {
      formType: '1099-B',
      payer: typeof obj.payer === 'string' ? obj.payer : 'Unknown',
      realizedGainLoss: typeof obj.realizedGainLoss === 'number' ? obj.realizedGainLoss : 0,
      shortTerm: typeof obj.shortTerm === 'number' ? obj.shortTerm : undefined,
      longTerm: typeof obj.longTerm === 'number' ? obj.longTerm : undefined,
    };
  }

  console.warn('Unknown formType in OCR result:', obj.formType);
  return null;
}
