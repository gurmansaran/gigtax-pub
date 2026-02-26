/**
 * Claude OCR Service - AI-powered tax document scanning
 * Uses live Anthropic API via ocrService.analyzeTaxDocument when key is set.
 */

import { analyzeTaxDocument, type DocType } from '@/lib/ocrService';

export interface ScannedW2Data {
  type: 'W-2';
  employer: string;
  wages: number;
  withheld: number;
}

export interface Scanned1099Data {
  type: '1099';
  payer: string;
  amount: number;
  isTip: boolean;
}

/** 1099-B scan result for capital gains. */
export interface Scanned1099BData {
  type: '1099-B';
  payer: string;
  realizedGainLoss: number;
  shortTerm?: number;
  longTerm?: number;
}

export type ScannedTaxData = ScannedW2Data | Scanned1099Data | Scanned1099BData;

const MOCK_W2_DATA: ScannedW2Data = {
  type: 'W-2',
  employer: 'Uber Technologies',
  wages: 45000,
  withheld: 5000,
};

const MOCK_1099_DATA: Scanned1099Data = {
  type: '1099',
  payer: 'DoorDash Inc.',
  amount: 25000,
  isTip: false,
};

const MOCK_1099_B_DATA: Scanned1099BData = {
  type: '1099-B',
  payer: 'Mock Brokerage',
  realizedGainLoss: 1200,
  shortTerm: 400,
  longTerm: 800,
};

/**
 * Scans a tax document image via live AI (analyzeTaxDocument) or mock.
 * @param imageUri - Local file URI of the image to scan
 * @param documentType - 'W-2', '1099', or '1099-B' for extraction hint / mock selection
 * @returns Parsed tax data or null if extraction fails
 */
export const scanTaxDocument = async (
  imageUri: string,
  documentType?: 'W-2' | '1099' | '1099-B'
): Promise<ScannedTaxData | null> => {
  const docType: DocType =
    documentType === '1099-B' ? '1099-B' : documentType === '1099' ? '1099' : 'W-2';

  try {
    const result = await analyzeTaxDocument(imageUri, docType);
    if (!result) return null;

    if (result.formType === 'W-2') {
      return {
        type: 'W-2',
        employer: result.employer,
        wages: result.wages,
        withheld: result.fedTax,
      };
    }
    if (result.formType === '1099-B') {
      return {
        type: '1099-B',
        payer: result.payer,
        realizedGainLoss: result.realizedGainLoss,
        shortTerm: result.shortTerm,
        longTerm: result.longTerm,
      };
    }
    if (result.formType === '1099') {
      return {
        type: '1099',
        payer: result.payer,
        amount: result.box1_compensation,
        isTip: !!result.isTip || (result.tips ?? 0) > 0,
      };
    }
    return null;
  } catch (e: unknown) {
    // In development, fall back to mock data so the UI is still testable
    // without a deployed edge function.
    if (__DEV__) {
      console.warn('scanTaxDocument: edge function unavailable, using mock data.', e);
      if (docType === '1099-B') return MOCK_1099_B_DATA;
      if (docType === '1099') return MOCK_1099_DATA;
      return MOCK_W2_DATA;
    }

    const msg = e instanceof Error ? e.message : 'Scan failed';
    if (msg.includes('JSON') || msg.includes('parse')) {
      throw new Error('Could not parse document. Please ensure the image is clear and try again.');
    }
    if (msg.includes('file') || msg.includes('read')) {
      throw new Error('Could not read image file. Please try taking the photo again.');
    }
    throw new Error('Failed to scan document. Please ensure the image is clear and contains a valid W-2 or 1099 form.');
  }
};
