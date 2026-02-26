/**
 * fetch-plaid-transactions — Supabase Edge Function
 *
 * Fetches bank transactions from Plaid on behalf of the authenticated user.
 * The Plaid access token is read from the database and decrypted server-side
 * using AES-256-GCM; it is never sent to the client.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
 *   SUPABASE_VAULT_KEY
 *
 * POST /fetch-plaid-transactions
 * Body: { start_date?: string, end_date?: string }
 * Returns: { transactions: PlaidTransaction[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";
const PLAID_BASE_URL: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

// ── AES-256-GCM decryption ────────────────────────────────────────────────────

function vaultKey(): Uint8Array {
  const raw = Deno.env.get("SUPABASE_VAULT_KEY") ?? "";
  if (!raw) throw new Error("SUPABASE_VAULT_KEY is not configured");
  const enc = new TextEncoder().encode(raw);
  const key = new Uint8Array(32);
  key.set(enc.slice(0, 32));
  return key;
}

async function decryptToken(encryptedStr: string): Promise<string> {
  if (!encryptedStr.startsWith("enc:")) {
    // Backward compatibility: return as-is if not encrypted
    return encryptedStr;
  }
  const b64 = encryptedStr.slice(4);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", vaultKey(), { name: "AES-GCM" }, false, ["decrypt"]
  );
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, cryptoKey, ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use anon key with user JWT to respect RLS
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Read the encrypted access token using service role (bypasses RLS for this read)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: bankAccount, error: dbError } = await supabaseAdmin
      .from("bank_accounts")
      .select("access_token")
      .eq("user_id", user.id)
      .single();

    if (dbError || !bankAccount) {
      return new Response(
        JSON.stringify({ error: "No linked bank account found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Decrypt the token server-side — never leaves this function
    const accessToken = await decryptToken(bankAccount.access_token);

    // 4. Parse request body for date range
    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().split("T")[0];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const startDate = body?.start_date || ninetyDaysAgo;
    const endDate = body?.end_date || today;

    // 5. Call Plaid /transactions/get
    const plaidRes = await fetch(
      `${PLAID_BASE_URL[PLAID_ENV] ?? PLAID_BASE_URL.sandbox}/transactions/get`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Deno.env.get("PLAID_CLIENT_ID"),
          secret: Deno.env.get("PLAID_SECRET"),
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
        }),
      }
    );

    if (!plaidRes.ok) {
      console.error("Plaid API error:", plaidRes.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transactions from Plaid" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plaidData = await plaidRes.json();

    // 6. Return transactions to the client (no token, no sensitive data)
    return new Response(
      JSON.stringify({ transactions: plaidData.transactions ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-plaid-transactions error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
