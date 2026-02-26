import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250514";

function cleanJsonResponse(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```json"))
    s = s.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  else if (s.startsWith("```"))
    s = s.replace(/^```\n?/, "").replace(/\n?```$/, "");
  return s;
}

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

  // ── Auth guard ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const image = body?.image;
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'image' (base64 string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const type = body?.type === "income" ? "income" : "expense";
    const contentType =
      typeof body?.contentType === "string" && body.contentType.trim().length > 0
        ? body.contentType
        : "image/jpeg";
    const isPdf = contentType === "application/pdf";

    const isIncome = type === "income";
    const system = isIncome
      ? "You are an accountant analyzing a Gig App Earnings Screen (DoorDash, Uber, etc.). Find the 'Total Payout', 'Weekly Earnings', or 'Transfer Amount'. Return JSON: { amount: number, date: string, source: string (e.g. 'DoorDash') }."
      : "You are an accountant analyzing a tax receipt. Find the Total, Date, Merchant, and Category. Return JSON: { amount: number, date: string, merchant: string, category: string }.";
    const userText = isIncome
      ? "Extract amount (number), date (YYYY-MM-DD or null), source (string, e.g. DoorDash, Uber). Return ONLY valid JSON, no markdown."
      : "Extract amount (number), date (YYYY-MM-DD or null), merchant (string), category (string). Return ONLY valid JSON, no markdown.";

    const fileBlock = isPdf
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: image,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: contentType,
            data: image,
          },
        };

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [
          {
            role: "user",
            content: [
              fileBlock,
              {
                type: "text",
                text: userText,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = data.content?.find((c) => c.type === "text");
    const text = block?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: "No text in AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleaned = cleanJsonResponse(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON from AI", raw: cleaned?.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-receipt error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
