// Supabase Edge Function: Exchange Plaid Public Token
// This function exchanges the public token for an access token and stores it securely

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── AES-256-GCM token encryption ─────────────────────────────────────────────
// Stored format: "enc:<base64(12-byte-iv + ciphertext)>"
// Key is sourced from SUPABASE_VAULT_KEY env var (set in Supabase dashboard).

function vaultKey(): Uint8Array {
  const raw = Deno.env.get('SUPABASE_VAULT_KEY') ?? '';
  if (!raw) throw new Error('SUPABASE_VAULT_KEY is not configured');
  const enc = new TextEncoder().encode(raw);
  const key = new Uint8Array(32);
  key.set(enc.slice(0, 32));
  return key;
}

async function encryptToken(token: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', vaultKey(), { name: 'AES-GCM' }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(token)
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return 'enc:' + btoa(String.fromCharCode(...combined));
}
// ─────────────────────────────────────────────────────────────────────────────

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') || '';
const PLAID_SECRET = Deno.env.get('PLAID_SECRET') || '';
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

const PLAID_BASE_URL = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}[PLAID_ENV] || 'https://sandbox.plaid.com';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { public_token } = await req.json();

    if (!public_token) {
      return new Response(
        JSON.stringify({ error: 'Missing public_token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token: public_token,
      }),
    });

    if (!exchangeResponse.ok) {
      const errorData = await exchangeResponse.text();
      console.error('Plaid exchange error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange public token', details: errorData }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const exchangeData = await exchangeResponse.json();
    const { access_token, item_id } = exchangeData;

    // Get institution information
    let institutionName = 'Unknown Bank';
    try {
      const itemResponse = await fetch(`${PLAID_BASE_URL}/item/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: access_token,
        }),
      });

      if (itemResponse.ok) {
        const itemData = await itemResponse.json();
        // Get institution details
        if (itemData.item.institution_id) {
          const instResponse = await fetch(`${PLAID_BASE_URL}/institutions/get_by_id`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: PLAID_CLIENT_ID,
              secret: PLAID_SECRET,
              institution_id: itemData.item.institution_id,
              country_codes: ['US'],
            }),
          });

          if (instResponse.ok) {
            const instData = await instResponse.json();
            institutionName = instData.institution.name || 'Unknown Bank';
          }
        }
      }
    } catch (error) {
      console.error('Error fetching institution info:', error);
      // Continue even if we can't get institution name
    }

    // Encrypt the access token before storage — never stored in plaintext
    const encryptedToken = await encryptToken(access_token);

    // Store encrypted access token in Supabase
    const { data: bankAccount, error: dbError } = await supabaseClient
      .from('bank_accounts')
      .upsert(
        {
          user_id: user.id,
          access_token: encryptedToken,
          item_id: item_id,
          institution_name: institutionName,
        },
        {
          onConflict: 'user_id',
          // If user already has a bank account, update it
        }
      )
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save bank account', details: dbError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        bank_account_id: bankAccount.id,
        institution_name: institutionName,
        message: 'Bank account linked successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in exchange-plaid-public-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
