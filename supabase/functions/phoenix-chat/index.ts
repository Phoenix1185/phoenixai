import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, userId } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user preferences for personalization
    let preferences = null;
    if (userId) {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      preferences = data;
    }

    // Build system prompt based on preferences
    let systemPrompt = `You are Phoenix AI, an intelligent and adaptive assistant. You are helpful, accurate, and engaging.`;
    
    if (preferences) {
      const styleMap = {
        formal: 'Respond in a formal, professional manner.',
        casual: 'Respond in a casual, friendly manner.',
        witty: 'Respond in a witty, playful manner with occasional humor.',
      };
      
      const lengthMap = {
        concise: 'Keep responses brief and to the point.',
        balanced: 'Provide balanced responses with appropriate detail.',
        detailed: 'Provide thorough, comprehensive responses.',
      };
      
      const expertiseMap = {
        beginner: 'Explain concepts simply, avoid jargon.',
        intermediate: 'Use moderate technical language when appropriate.',
        expert: 'Feel free to use technical terms and assume domain knowledge.',
      };

      systemPrompt += ` ${styleMap[preferences.preferred_style] || styleMap.casual}`;
      systemPrompt += ` ${lengthMap[preferences.response_length] || lengthMap.balanced}`;
      systemPrompt += ` ${expertiseMap[preferences.expertise_level] || expertiseMap.intermediate}`;
      
      if (preferences.interests && preferences.interests.length > 0) {
        systemPrompt += ` The user is interested in: ${preferences.interests.join(', ')}.`;
      }
    }

    // Get conversation history for context
    let conversationHistory: { role: string; content: string }[] = [];
    if (conversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20);
      
      if (messages) {
        conversationHistory = messages.map(m => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    // Call Lovable AI Gateway
    const aiGatewayUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch(aiGatewayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message },
        ],
        max_tokens: 2048,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.';

    // Save assistant message to database
    let messageId = null;
    if (conversationId && userId) {
      const { data: savedMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: reply,
        })
        .select('id')
        .single();
      
      messageId = savedMsg?.id;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    return new Response(
      JSON.stringify({ reply, messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in phoenix-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
