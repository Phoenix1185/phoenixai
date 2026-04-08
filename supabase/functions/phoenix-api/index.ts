// Phoenix AI Public API endpoint
// Developers use API keys to access Phoenix AI programmatically

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Extract API key from header
    const apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!apiKey || !apiKey.startsWith("phx_")) {
      return respond(401, { error: "Missing or invalid API key. Keys start with 'phx_'" });
    }

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError || !keyRecord) {
      return respond(401, { error: "Invalid API key" });
    }

    // Check expiry
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return respond(401, { error: "API key has expired" });
    }

    // Parse request
    const url = new URL(req.url);
    const path = url.pathname.split("/phoenix-api")[1] || "/";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    let result: any;
    let endpoint = path;

    // Route endpoints
    if (path === "/v1/chat" || path === "/chat" || path === "/") {
      if (!keyRecord.permissions.includes("chat")) {
        return respond(403, { error: "API key lacks 'chat' permission" });
      }
      result = await handleChat(supabase, body, keyRecord);
      endpoint = "/v1/chat";
    } else if (path === "/v1/models" || path === "/models") {
      result = handleModels();
      endpoint = "/v1/models";
    } else if (path === "/v1/usage" || path === "/usage") {
      result = await handleUsage(supabase, keyRecord);
      endpoint = "/v1/usage";
    } else {
      return respond(404, { error: "Unknown endpoint", available: ["/v1/chat", "/v1/models", "/v1/usage"] });
    }

    const responseTime = Date.now() - startTime;

    // Log usage & update counter (fire-and-forget)
    supabase.from("api_usage_logs").insert({
      api_key_id: keyRecord.id,
      endpoint,
      status_code: 200,
      response_time_ms: responseTime,
      tokens_used: result._tokens || 0,
    }).then(() => {});
    
    supabase.from("api_keys").update({
      total_requests: keyRecord.total_requests + 1,
      last_used_at: new Date().toISOString(),
    }).eq("id", keyRecord.id).then(() => {});

    // Remove internal field
    delete result._tokens;

    return respond(200, result);
  } catch (e) {
    console.error("API error:", e);
    return respond(500, { error: "Internal server error" });
  }

  function respond(status: number, data: any) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleChat(supabase: any, body: any, keyRecord: any) {
  const { message, conversation_id, model, stream } = body;
  
  if (!message || typeof message !== "string") {
    throw Object.assign(new Error("'message' field is required"), { status: 400 });
  }

  // Use phoenix-core for AI response
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("AI service not configured");
  }

  const selectedModel = model || "google/gemini-2.5-flash";
  
  const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: "You are Phoenix AI, an intelligent, helpful, and friendly assistant. Respond naturally and helpfully."
        },
        { role: "user", content: message }
      ],
      max_tokens: 4096,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI API error:", errText);
    throw new Error("AI service error");
  }

  const aiData = await aiResponse.json();
  const reply = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";
  const tokensUsed = aiData.usage?.total_tokens || 0;

  return {
    id: crypto.randomUUID(),
    model: selectedModel,
    message: reply,
    usage: {
      prompt_tokens: aiData.usage?.prompt_tokens || 0,
      completion_tokens: aiData.usage?.completion_tokens || 0,
      total_tokens: tokensUsed,
    },
    created_at: new Date().toISOString(),
    _tokens: tokensUsed,
  };
}

function handleModels() {
  return {
    models: [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast & balanced", default: true },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Best for complex reasoning" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Strong reasoning, lower cost" },
      { id: "openai/gpt-5", name: "GPT-5", description: "Most capable, higher cost" },
      { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Fastest, cheapest" },
    ],
  };
}

async function handleUsage(supabase: any, keyRecord: any) {
  const { data: logs } = await supabase
    .from("api_usage_logs")
    .select("endpoint, status_code, tokens_used, created_at")
    .eq("api_key_id", keyRecord.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    key_name: keyRecord.name,
    total_requests: keyRecord.total_requests,
    last_used: keyRecord.last_used_at,
    recent_logs: logs || [],
  };
}
