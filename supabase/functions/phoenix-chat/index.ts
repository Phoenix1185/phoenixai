import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserPreferences {
  preferred_style: 'formal' | 'casual' | 'witty';
  response_length: 'concise' | 'balanced' | 'detailed';
  expertise_level: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user preferences for personalization
    let preferences: UserPreferences | null = null;
    if (userId) {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      preferences = data as UserPreferences | null;
    }

    // Build system prompt based on preferences
    let systemPrompt = `You are Phoenix AI, an intelligent and adaptive assistant created by IYANU and the Phoenix Team. You are helpful, accurate, engaging, and slightly witty.

You have the following capabilities:
- Answer questions with real-time knowledge
- Generate content: blogs, tweets, summaries, reports
- Explain complex topics clearly
- Help with creative writing and brainstorming

Commands you understand:
- /search <topic> - Search the web for information
- /read <URL> - Read and summarize a webpage
- /blog <topic> - Generate a blog article
- /tweet <topic> - Generate a social media post
- /news <topic> - Get latest news summary
- /crypto <symbol> - Get cryptocurrency info

When users use commands, acknowledge the command and provide helpful responses based on your knowledge.`;
    
    if (preferences) {
      const styleMap: Record<string, string> = {
        formal: 'Respond in a formal, professional manner.',
        casual: 'Respond in a casual, friendly manner.',
        witty: 'Respond in a witty, playful manner with occasional humor.',
      };
      
      const lengthMap: Record<string, string> = {
        concise: 'Keep responses brief and to the point.',
        balanced: 'Provide balanced responses with appropriate detail.',
        detailed: 'Provide thorough, comprehensive responses.',
      };
      
      const expertiseMap: Record<string, string> = {
        beginner: 'Explain concepts simply, avoid jargon.',
        intermediate: 'Use moderate technical language when appropriate.',
        expert: 'Feel free to use technical terms and assume domain knowledge.',
      };

      const style = preferences.preferred_style || 'casual';
      const length = preferences.response_length || 'balanced';
      const expertise = preferences.expertise_level || 'intermediate';

      systemPrompt += `\n\nUser preferences:
- ${styleMap[style] || styleMap.casual}
- ${lengthMap[length] || lengthMap.balanced}
- ${expertiseMap[expertise] || expertiseMap.intermediate}`;
      
      if (preferences.interests && preferences.interests.length > 0) {
        systemPrompt += `\n- The user is interested in: ${preferences.interests.join(', ')}.`;
      }
    }

    // Call Lovable AI Gateway with streaming
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
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    // Return streaming response
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error: unknown) {
    console.error('Error in phoenix-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
