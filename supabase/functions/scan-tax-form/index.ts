/**
 * scan-tax-form — Supabase Edge Function
 *
 * Server-side tax form OCR using Claude API.
 * Accepts base64-encoded images or PDFs, returns structured tax data.
 *
 * Required env vars: ANTHROPIC_API_KEY
 *
 * POST /scan-tax-form
 * Body: { imageBase64: string, mediaType: string, formType?: string }
 * Returns: { success: true, data: ScannedFormData }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

const SYSTEM_PROMPT = `You are a tax document OCR engine. Extract data from the provided tax document image or PDF into pure JSON only.

RULES:
- Return ONLY valid JSON. No markdown, no code blocks, no extra text.
- Auto-detect the form type from the document content.
- Use null/0 for missing values. Extract names exactly as shown. All amounts as numbers.

SUPPORTED FORM TYPES:

W-2: { "formType": "W-2", "employer": string, "ein": string|null, "wages": number (Box 1), "fedTax": number (Box 2), "box3_ssWages": number|null, "box4_ssTax": number|null, "box5_medicareWages": number|null, "box6_medicareTax": number|null, "stateTax": number|null, "stateWages": number|null, "state": string|null }

1099-NEC: { "formType": "1099-NEC", "payer": string, "ein": string|null, "box1_compensation": number, "box4_fedWithheld": number|0, "tips": number|0 }

1099-K: { "formType": "1099-K", "payer": string, "ein": string|null, "box1a_grossAmount": number, "box4_fedWithheld": number|0, "numberOfTransactions": number|null }

1099-INT: { "formType": "1099-INT", "payer": string, "ein": string|null, "box1_interest": number, "box4_fedWithheld": number|0 }

1099-DIV: { "formType": "1099-DIV", "payer": string, "ein": string|null, "box1a_ordinaryDividends": number, "box1b_qualifiedDividends": number|0, "box4_fedWithheld": number|0 }

1099-B: { "formType": "1099-B", "payer": string, "realizedGainLoss": number, "shortTerm": number|null, "longTerm": number|null }

If the form type is ambiguous, choose the closest match. For 1099 variants (MISC/NEC/K), map to the appropriate type.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { imageBase64, mediaType, formType } = await req.json();

    if (!imageBase64) {
      throw new Error('Missing imageBase64 field');
    }

    const resolvedMediaType = mediaType || 'image/jpeg';
    const isPdf = resolvedMediaType === 'application/pdf';

    // Build content block
    const fileContent = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: imageBase64,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: resolvedMediaType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: imageBase64,
          },
        };

    const userPrompt = formType && formType !== 'auto'
      ? `Extract fields for ${formType} form. Return only valid JSON.`
      : 'Auto-detect the tax form type and extract all fields. Return only valid JSON.';

    const body = {
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user' as const,
          content: [
            fileContent,
            { type: 'text' as const, text: userPrompt },
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
      throw new Error(`Claude API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const block = data.content?.find((c: { type: string }) => c.type === 'text');
    const text = block?.text;

    if (!text) {
      throw new Error('No text response from Claude API');
    }

    // Clean markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.formType) {
      throw new Error('Could not determine form type from document');
    }

    // Sanitize amounts (ensure non-negative where appropriate)
    const nonNeg = (v: unknown): number => {
      const n = typeof v === 'number' ? v : 0;
      return n >= 0 ? n : 0;
    };

    // Apply validation based on form type
    const validated = { ...parsed };
    if (parsed.formType === 'W-2') {
      validated.wages = nonNeg(parsed.wages);
      validated.fedTax = Math.min(nonNeg(parsed.fedTax), validated.wages);
    } else if (parsed.formType === '1099-NEC') {
      validated.box1_compensation = nonNeg(parsed.box1_compensation);
      validated.box4_fedWithheld = Math.min(nonNeg(parsed.box4_fedWithheld), validated.box1_compensation);
    } else if (parsed.formType === '1099-K') {
      validated.box1a_grossAmount = nonNeg(parsed.box1a_grossAmount);
      validated.box4_fedWithheld = Math.min(nonNeg(parsed.box4_fedWithheld), validated.box1a_grossAmount);
    } else if (parsed.formType === '1099-INT') {
      validated.box1_interest = nonNeg(parsed.box1_interest);
    } else if (parsed.formType === '1099-DIV') {
      validated.box1a_ordinaryDividends = nonNeg(parsed.box1a_ordinaryDividends);
      validated.box1b_qualifiedDividends = nonNeg(parsed.box1b_qualifiedDividends);
    }
    // 1099-B allows negative (losses)

    return new Response(
      JSON.stringify({ success: true, data: validated }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
