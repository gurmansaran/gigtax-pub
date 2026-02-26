/**
 * Live AI Vision OCR Service
 * POST to Anthropic Messages API for tax document extraction.
 */

import { readAsStringAsync } from 'expo-file-system/legacy';

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

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

const SYSTEM_PROMPT = `You are a tax OCR engine. Extract data from the provided tax document image into pure JSON only.

RULES:
- Return ONLY valid JSON. No markdown, no code blocks, no extra text.
- W-2: { "formType": "W-2", "employer": string, "ein": string or null, "wages": number (Box 1), "fedTax": number (Box 2), "box3_ssWages": number or null, "box4_ssTax": number or null, "box5_medicareWages": number or null, "box6_medicareTax": number or null }
- 1099 (NEC/MISC/K): { "formType": "1099", "payer": string, "ein": string or null, "box1_compensation": number (Box 1), "box4_fedWithheld": number or 0, "tips": number or 0, "isTip": boolean }
- 1099-B (Brokerage): { "formType": "1099-B", "payer": string, "realizedGainLoss": number (net realized gain or loss; negative for loss), "shortTerm": number or null, "longTerm": number or null }
- Use null/0 for missing values. Extract names exactly as shown. All amounts as numbers.`;

function cleanJsonResponse(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```json')) s = s.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  else if (s.startsWith('```')) s = s.replace(/^```\n?/, '').replace(/\n?```$/, '');
  return s;
}

/**
 * Read file as Base64 string.
 */
async function readFileAsBase64(fileUri: string): Promise<string> {
  return readAsStringAsync(fileUri, {
    encoding: 'base64',
  });
}

/** Detect media type from file URI. */
function getMediaType(fileUri: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' {
  const lower = fileUri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg'; // default for jpg, heic, etc.
}

/**
 * Call Anthropic Messages API with image/PDF + prompt, return parsed JSON.
 */
export async function analyzeTaxDocument(
  fileUri: string,
  docType: DocType
): Promise<OcrTaxResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_KEY is not set. Configure it in your environment.');
  }

  const base64 = await readFileAsBase64(fileUri);
  const mediaType = getMediaType(fileUri);
  const userPrompt =
    docType === '1099-B'
      ? 'Extract fields for 1099-B form (Realized Gain/Loss). Return only valid JSON.'
      : `Extract fields for ${docType} form. Return only valid JSON.`;

  // Build content block: PDF uses document type, images use image type
  const fileContent = mediaType === 'application/pdf'
    ? {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64,
        },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64,
        },
      };

  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: [
          fileContent,
          {
            type: 'text' as const,
            text: userPrompt,
          },
        ],
      },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const block = data.content?.find((c) => c.type === 'text');
  const text = block?.text;
  if (!text) {
    console.warn('No text in Anthropic response');
    return null;
  }

  const cleaned = cleanJsonResponse(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('Failed to parse OCR JSON:', cleaned?.slice(0, 200));
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // P1-16: Helper to clamp non-negative amounts
  const nonNeg = (v: number) => (v >= 0 ? v : 0);

  if (obj.formType === 'W-2') {
    const w2 = obj as unknown as OcrW2Result;
    const wages = typeof w2.wages === 'number' ? nonNeg(w2.wages) : 0;
    const fedTax = typeof w2.fedTax === 'number' ? nonNeg(w2.fedTax) : 0;
    return {
      formType: 'W-2',
      employer: typeof w2.employer === 'string' ? w2.employer : 'Unknown',
      ein: typeof w2.ein === 'string' ? w2.ein : undefined,
      wages,
      fedTax: Math.min(fedTax, wages), // withholding cannot exceed wages
      box3_ssWages: typeof w2.box3_ssWages === 'number' ? nonNeg(w2.box3_ssWages) : undefined,
      box4_ssTax: typeof w2.box4_ssTax === 'number' ? nonNeg(w2.box4_ssTax) : undefined,
      box5_medicareWages: typeof w2.box5_medicareWages === 'number' ? nonNeg(w2.box5_medicareWages) : undefined,
      box6_medicareTax: typeof w2.box6_medicareTax === 'number' ? nonNeg(w2.box6_medicareTax) : undefined,
    };
  }

  if (obj.formType === '1099') {
    const c1099 = obj as unknown as Ocr1099Result;
    const comp = typeof c1099.box1_compensation === 'number' ? nonNeg(c1099.box1_compensation) : 0;
    const withheld = typeof c1099.box4_fedWithheld === 'number' ? nonNeg(c1099.box4_fedWithheld) : 0;
    return {
      formType: '1099',
      payer: typeof c1099.payer === 'string' ? c1099.payer : 'Unknown',
      ein: typeof c1099.ein === 'string' ? c1099.ein : undefined,
      box1_compensation: comp,
      box4_fedWithheld: Math.min(withheld, comp), // withholding cannot exceed income
      tips: typeof c1099.tips === 'number' ? nonNeg(c1099.tips) : 0,
      isTip: !!c1099.isTip,
    };
  }

  if (obj.formType === '1099-B') {
    const b = obj as unknown as Ocr1099BResult;
    const gainLoss = typeof b.realizedGainLoss === 'number' ? b.realizedGainLoss : 0;
    const shortTerm = typeof b.shortTerm === 'number' ? b.shortTerm : undefined;
    const longTerm = typeof b.longTerm === 'number' ? b.longTerm : undefined;
    return {
      formType: '1099-B',
      payer: typeof b.payer === 'string' ? b.payer : 'Unknown',
      realizedGainLoss: gainLoss,
      shortTerm,
      longTerm,
    };
  }

  console.warn('Unknown formType in OCR result:', obj.formType);
  return null;
}
