import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "npm:plaid";

// ── AES-256-GCM token encryption ─────────────────────────────────────────────
function vaultKey(): Uint8Array {
  const raw = Deno.env.get("SUPABASE_VAULT_KEY") ?? "";
  if (!raw) throw new Error("SUPABASE_VAULT_KEY is not configured");
  const enc = new TextEncoder().encode(raw);
  const key = new Uint8Array(32);
  key.set(enc.slice(0, 32));
  return key;
}

async function encryptToken(token: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", vaultKey(), { name: "AES-GCM" }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(token)
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return "enc:" + btoa(String.fromCharCode(...combined));
}
// ─────────────────────────────────────────────────────────────────────────────

const configuration = new Configuration({
  basePath: PlaidEnvironments[(Deno.env.get("PLAID_ENV") ?? "sandbox") as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": Deno.env.get("PLAID_CLIENT_ID"),
      "PLAID-SECRET": Deno.env.get("PLAID_SECRET"),
    },
  },
});

const client = new PlaidApi(configuration);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { public_token, institution_name, institution_id } = body;
    if (!public_token) throw new Error("Missing public_token");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) throw new Error("Invalid user");

    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Encrypt the access token before storage — never stored in plaintext
    const encryptedToken = await encryptToken(accessToken);

    const { error: dbError } = await supabaseClient.from("user_bank_accounts").insert({
      user_id: user.id,
      access_token: encryptedToken,
      item_id: itemId,
      institution_name: institution_name ?? "Unknown",
      institution_id: institution_id ?? null,
    });

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
