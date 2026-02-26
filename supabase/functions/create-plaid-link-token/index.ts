import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "npm:plaid";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("User not found");

    const request = {
      user: { client_user_id: user.id },
      client_name: "GigTax App",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      redirect_uri: "https://gigtaxus.com/oauth",
    };

    const createTokenResponse = await client.linkTokenCreate(request);

    return new Response(JSON.stringify(createTokenResponse.data), {
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
