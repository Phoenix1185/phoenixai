// Phoenix AI Public API endpoint
// Developers use API keys to access Phoenix AI programmatically

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
      console.error("DB error looking up key:", keyError);
      return respond(500, { error: "Internal server error" });
    }

    if (!keyRecord) {
      return respond(401, { 
        error: "Invalid API key",
        hint: "This key does not exist or has been deactivated. Create a new key in Settings → API."
      });
    }

    // Check expiry
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return respond(401, { error: "API key has expired" });
    }

    // Check rate limit
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentRequests } = await supabase
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", keyRecord.id)
      .gte("created_at", oneMinuteAgo);

    if (recentRequests !== null && recentRequests >= keyRecord.rate_limit_per_minute) {
      return respond(429, { 
        error: "Rate limit exceeded",
        limit: keyRecord.rate_limit_per_minute,
        retry_after_seconds: 60,
      });
    }

    // Parse request path - handle both /phoenix-api/v1/chat and /v1/chat
    const url = new URL(req.url);
    const fullPath = url.pathname;
    const pathAfterFunction = fullPath.includes("/phoenix-api") 
      ? fullPath.split("/phoenix-api")[1] || "/"
      : fullPath;
    const path = pathAfterFunction.replace(/\/+$/, "") || "/"; // normalize trailing slashes

    // Parse body for POST
    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        return respond(400, { error: "Invalid JSON body" });
      }
    }

    let result: any;
    let endpoint = path;

    // Route endpoints
    if (path === "/v1/chat" || path === "/chat" || path === "/") {
      if (req.method !== "POST") {
        return respond(405, { 
          error: "Method not allowed. Use POST for /v1/chat.",
          hint: "Send a POST request with a JSON body containing a 'message' field."
        });
      }
      if (!keyRecord.permissions.includes("chat")) {
        return respond(403, { error: "API key lacks 'chat' permission" });
      }
      result = await handleChat(body, keyRecord);
      endpoint = "/v1/chat";
    } else if (path === "/v1/models" || path === "/models") {
      result = handleModels();
      endpoint = "/v1/models";
    } else if (path === "/v1/usage" || path === "/usage") {
      result = await handleUsage(supabase, keyRecord);
      endpoint = "/v1/usage";
    } else if (path === "/v1/health" || path === "/health") {
      result = { status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" };
      endpoint = "/v1/health";
    } else {
      return respond(404, { 
        error: "Unknown endpoint",
        available_endpoints: {
          "POST /v1/chat": "Send a message and get an AI response",
          "GET /v1/models": "List available AI models",
          "GET /v1/usage": "View your API usage statistics",
          "GET /v1/health": "Check API health status",
        }
      });
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
    const tokens = result._tokens;
    delete result._tokens;

    return respond(200, result);
  } catch (e: any) {
    console.error("API error:", e);
    const status = e.status || 500;
    return respond(status, { error: e.message || "Internal server error" });
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
  if (!lovableApiKey) {
    console.error("LOVABLE_API_KEY not configured");
    throw new Error("AI service not configured");
  }

  const validModels = [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash-lite",
    "openai/gpt-5-mini",
    "openai/gpt-5",
    "openai/gpt-5-nano",
  ];

  const selectedModel = model || "google/gemini-2.5-flash";
  if (!validModels.includes(selectedModel)) {
    throw Object.assign(new Error(`Invalid model '${selectedModel}'. Valid models: ${validModels.join(", ")}`), { status: 400 });
  }

  const systemContent = typeof system_prompt === "string" && system_prompt.length > 0
    ? system_prompt
    : "You are Phoenix AI, an intelligent, helpful, and friendly assistant. Respond naturally and helpfully.";

  const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
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
    if (aiResponse.status === 429) {
      throw Object.assign(new Error("AI service rate limited. Try again shortly."), { status: 429 });
    }
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
      { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Fastest, cheapest" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Strong reasoning, lower cost" },
      { id: "openai/gpt-5", name: "GPT-5", description: "Most capable, higher cost" },
      { id: "openai/gpt-5-nano", name: "GPT-5 Nano", description: "Ultra-fast, cost-effective" },
    ],
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
