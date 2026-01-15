// Backend function: generate ElevenLabs Conversational AI conversation tokens
// Keeps ELEVENLABS_API_KEY private server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_AGENT_ID = "agent_7201kf096j8re2qt50hs3yjxphhg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Backend not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!elevenlabsApiKey) {
      return new Response(JSON.stringify({ error: "ElevenLabs not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require an authenticated user (prevents public token minting)
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: allow overriding agentId via body, but default to configured agent
    const body = await req.json().catch(() => ({} as any));
    const agentId = (body?.agentId as string) || DEFAULT_AGENT_ID;

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: {
          "xi-api-key": elevenlabsApiKey,
        },
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: "ElevenLabs token request failed", details: txt }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const token = data?.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "No token received" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
