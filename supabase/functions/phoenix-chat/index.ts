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

interface SearchResult {
  url: string;
  title: string;
  description: string;
  markdown?: string;
}

// Detect if user needs real-time information
function needsWebSearch(message: string): { needed: boolean; query: string } {
  const lowerMsg = message.toLowerCase();
  
  // Patterns that indicate need for live data
  const patterns = [
    /what('s| is) (the )?(latest|current|recent|today'?s?|new)/i,
    /news (about|on|regarding)/i,
    /(price|stock|weather|score|result|update) (of|for|on)/i,
    /who (won|is winning|leads?)/i,
    /tell me about (current|latest|recent)/i,
    /search (for|about)/i,
    /look up/i,
    /find (me |out )?(information|info|details|news)/i,
    /(what|who|when|where|how) .* (today|right now|currently|2024|2025|2026)/i,
    /crypto(currency)? (price|market)/i,
    /\b(bitcoin|btc|ethereum|eth)\b.*(price|worth|value)/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lowerMsg)) {
      // Extract the search query
      const query = message
        .replace(/^(hey |hi |hello |okay |ok )/i, '')
        .replace(/\?$/g, '')
        .trim();
      return { needed: true, query };
    }
  }
  
  return { needed: false, query: '' };
}

// Detect if user wants to read a URL
function extractUrl(message: string): string | null {
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const matches = message.match(urlPattern);
  return matches ? matches[0] : null;
}

async function performWebSearch(query: string): Promise<SearchResult[]> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('Firecrawl API key not configured, skipping search');
    return [];
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

async function scrapeUrl(url: string): Promise<string | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('Firecrawl API key not configured, skipping scrape');
    return null;
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl scrape failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.markdown || data.markdown || null;
  } catch (error) {
    console.error('URL scrape error:', error);
    return null;
  }
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

    // Get the latest user message
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    
    // Check if we need to search the web or scrape a URL
    let webContext = '';
    const urlToRead = extractUrl(lastUserMessage);
    const searchCheck = needsWebSearch(lastUserMessage);
    
    if (urlToRead) {
      console.log('Detected URL to scrape:', urlToRead);
      const content = await scrapeUrl(urlToRead);
      if (content) {
        // Truncate if too long
        const truncated = content.length > 8000 ? content.slice(0, 8000) + '...\n[Content truncated]' : content;
        webContext = `\n\n📄 **Content from ${urlToRead}:**\n\n${truncated}`;
      }
    } else if (searchCheck.needed) {
      console.log('Performing web search for:', searchCheck.query);
      const results = await performWebSearch(searchCheck.query);
      if (results.length > 0) {
        webContext = '\n\n🔍 **Live Web Search Results:**\n\n';
        for (const result of results) {
          webContext += `### ${result.title}\n`;
          webContext += `*Source: ${result.url}*\n\n`;
          if (result.markdown) {
            const truncated = result.markdown.length > 1500 ? result.markdown.slice(0, 1500) + '...' : result.markdown;
            webContext += `${truncated}\n\n---\n\n`;
          } else if (result.description) {
            webContext += `${result.description}\n\n---\n\n`;
          }
        }
      }
    }

    // Build system prompt based on preferences
    let systemPrompt = `You are Phoenix AI, an intelligent and adaptive personal assistant created by IYANU and the Phoenix Team. You are helpful, accurate, engaging, and slightly witty.

Your tagline is: "Rising to every question, in real time."

Your core capabilities:
- Answer questions with up-to-date knowledge (you have access to live web search)
- Generate content: blogs, tweets, summaries, reports, SEO content
- Read and summarize web pages when users share URLs
- Explain complex topics clearly at the user's level
- Help with creative writing, brainstorming, and analysis
- Provide personalized responses based on user preferences

IMPORTANT BEHAVIOR:
- You understand natural language - users don't need special commands
- When users ask about current events, news, or real-time information, you CAN access live web data
- When users share a URL, you CAN read and summarize the content
- Always cite your sources when using web search results
- Be conversational and helpful, adapt to the user's communication style
- If you used web search, mention that you searched for updated information`;
    
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

    // Add web context to the last message if we have it
    const processedMessages = [...messages];
    if (webContext && processedMessages.length > 0) {
      const lastIdx = processedMessages.length - 1;
      processedMessages[lastIdx] = {
        ...processedMessages[lastIdx],
        content: processedMessages[lastIdx].content + '\n\n---\n**Context from live web search:**' + webContext,
      };
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
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...processedMessages,
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
