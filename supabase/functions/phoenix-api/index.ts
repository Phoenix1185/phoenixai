// Phoenix AI Public API endpoint
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function respond(status: number, data: any): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

const CHAT_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
];

const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
  "google/gemini-3.1-flash-image-preview",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Extract API key
    const apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!apiKey || !apiKey.startsWith("phx_")) {
      return respond(401, { 
        error: "Missing or invalid API key",
        hint: "Include your API key in the 'x-api-key' header. Keys start with 'phx_'."
      });
    }

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError) {
      console.error("DB error:", keyError);
      return respond(500, { error: "Internal server error" });
    }
    if (!keyRecord) {
      return respond(401, { error: "Invalid API key", hint: "This key does not exist or has been deactivated." });
    }
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return respond(401, { error: "API key has expired" });
    }

    // Rate limit
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentRequests } = await supabase
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", keyRecord.id)
      .gte("created_at", oneMinuteAgo);

    if (recentRequests !== null && recentRequests >= keyRecord.rate_limit_per_minute) {
      return respond(429, { error: "Rate limit exceeded", limit: keyRecord.rate_limit_per_minute, retry_after_seconds: 60 });
    }

    // Parse path
    const url = new URL(req.url);
    const fullPath = url.pathname;
    const pathAfterFunction = fullPath.includes("/phoenix-api") 
      ? fullPath.split("/phoenix-api")[1] || "/"
      : fullPath;
    const path = pathAfterFunction.replace(/\/+$/, "") || "/";

    // Parse body
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { return respond(400, { error: "Invalid JSON body" }); }
    }

    let result: any;
    let endpoint = path;

    // Route
    if (path === "/v1/chat" || path === "/chat" || path === "/") {
      if (req.method !== "POST") return respond(405, { error: "Use POST for /v1/chat" });
      if (!keyRecord.permissions.includes("chat")) return respond(403, { error: "API key lacks 'chat' permission" });
      result = await handleChat(body, keyRecord);
      endpoint = "/v1/chat";
    } else if (path === "/v1/images" || path === "/images") {
      if (req.method !== "POST") return respond(405, { error: "Use POST for /v1/images" });
      if (!keyRecord.permissions.includes("chat")) return respond(403, { error: "API key lacks 'chat' permission" });
      result = await handleImageGeneration(body);
      endpoint = "/v1/images";
    } else if (path === "/v1/models" || path === "/models") {
      result = handleModels();
      endpoint = "/v1/models";
    } else if (path === "/v1/usage" || path === "/usage") {
      result = await handleUsage(supabase, keyRecord);
      endpoint = "/v1/usage";
    } else if (path === "/v1/health" || path === "/health") {
      result = { status: "ok", timestamp: new Date().toISOString(), version: "1.1.0" };
      endpoint = "/v1/health";
    } else {
      return respond(404, { 
        error: "Unknown endpoint",
        available_endpoints: {
          "POST /v1/chat": "Send a message and get an AI response",
          "POST /v1/images": "Generate an image from a text prompt",
          "GET /v1/models": "List available AI models",
          "GET /v1/usage": "View your API usage statistics",
          "GET /v1/health": "Check API health status",
        }
      });
    }

    const responseTime = Date.now() - startTime;

    // Log usage (fire-and-forget)
    supabase.from("api_usage_logs").insert({
      api_key_id: keyRecord.id, endpoint, status_code: 200,
      response_time_ms: responseTime, tokens_used: result._tokens || 0,
    }).then(() => {});
    supabase.from("api_keys").update({
      total_requests: keyRecord.total_requests + 1,
      last_used_at: new Date().toISOString(),
    }).eq("id", keyRecord.id).then(() => {});

    delete result._tokens;
    return respond(200, result);
  } catch (e: any) {
    console.error("API error:", e);
    return respond(e.status || 500, { error: e.message || "Internal server error" });
  }
});

async function handleChat(body: any, keyRecord: any) {
  const { message, model, system_prompt } = body;
  if (!message || typeof message !== "string") {
    throw Object.assign(new Error("'message' field is required and must be a string"), { status: 400 });
  }
  if (message.length > 32000) {
    throw Object.assign(new Error("Message too long. Maximum 32,000 characters."), { status: 400 });
  }

  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) throw new Error("AI service not configured");

  const selectedModel = model || "google/gemini-3-flash-preview";
  if (!CHAT_MODELS.includes(selectedModel)) {
    throw Object.assign(new Error(`Invalid model '${selectedModel}'. Valid: ${CHAT_MODELS.join(", ")}`), { status: 400 });
  }

  const systemContent = typeof system_prompt === "string" && system_prompt.length > 0
    ? system_prompt
    : "You are Phoenix AI, an intelligent, helpful, and friendly assistant.";

  const aiResponse = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message },
      ],
      max_tokens: 4096,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI API error:", aiResponse.status, errText);
    if (aiResponse.status === 429) throw Object.assign(new Error("AI rate limited. Try again shortly."), { status: 429 });
    if (aiResponse.status === 402) throw Object.assign(new Error("AI credits exhausted."), { status: 402 });
    throw Object.assign(new Error("AI service error: " + errText.substring(0, 200)), { status: 502 });
  }

  const aiData = await aiResponse.json();
  const reply = aiData.choices?.[0]?.message?.content || "No response generated.";
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

async function handleImageGeneration(body: any) {
  const { prompt, model, size } = body;
  if (!prompt || typeof prompt !== "string") {
    throw Object.assign(new Error("'prompt' field is required and must be a string"), { status: 400 });
  }
  if (prompt.length > 4000) {
    throw Object.assign(new Error("Prompt too long. Maximum 4,000 characters."), { status: 400 });
  }

  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) throw new Error("AI service not configured");

  const selectedModel = model || "google/gemini-3.1-flash-image-preview";
  if (!IMAGE_MODELS.includes(selectedModel)) {
    throw Object.assign(new Error(`Invalid image model '${selectedModel}'. Valid: ${IMAGE_MODELS.join(", ")}`), { status: 400 });
  }

  const aiResponse = await fetch(IMAGE_GATEWAY_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selectedModel,
      prompt,
      n: 1,
      size: size || "1024x1024",
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("Image API error:", aiResponse.status, errText);
    if (aiResponse.status === 429) throw Object.assign(new Error("Rate limited. Try again shortly."), { status: 429 });
    if (aiResponse.status === 402) throw Object.assign(new Error("Credits exhausted."), { status: 402 });
    throw Object.assign(new Error("Image generation error: " + errText.substring(0, 200)), { status: 502 });
  }

  const data = await aiResponse.json();
  return {
    id: crypto.randomUUID(),
    model: selectedModel,
    images: data.data || [],
    created_at: new Date().toISOString(),
    _tokens: 0,
  };
}

function handleModels() {
  return {
    models: {
      chat: CHAT_MODELS.map(id => ({
        id,
        name: id.split("/")[1],
        type: "chat",
        default: id === "google/gemini-3-flash-preview",
      })),
      image: IMAGE_MODELS.map(id => ({
        id,
        name: id.split("/")[1],
        type: "image",
        default: id === "google/gemini-3.1-flash-image-preview",
      })),
    },
  };
}

async function handleUsage(supabase: any, keyRecord: any) {
  const { data: logs } = await supabase
    .from("api_usage_logs")
    .select("endpoint, status_code, tokens_used, response_time_ms, created_at")
    .eq("api_key_id", keyRecord.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const totalTokens = (logs || []).reduce((sum: number, l: any) => sum + (l.tokens_used || 0), 0);

  return {
    key_name: keyRecord.name,
    total_requests: keyRecord.total_requests,
    total_tokens_used: totalTokens,
    rate_limit_per_minute: keyRecord.rate_limit_per_minute,
    last_used: keyRecord.last_used_at,
    recent_logs: logs || [],
  };
}
