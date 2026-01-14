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
  language: string;
}

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

interface FirecrawlResult {
  url: string;
  title: string;
  description: string;
  markdown?: string;
}

// AGGRESSIVE search detection - now catches almost any factual question
function needsWebSearch(message: string): { needed: boolean; query: string } {
  const lowerMsg = message.toLowerCase();
  
  // Patterns that indicate need for live data - MUCH MORE COMPREHENSIVE
  const patterns = [
    // Current events and time-sensitive queries
    /what('s| is) (the )?(latest|current|recent|today'?s?|new)/i,
    /news (about|on|regarding)/i,
    /(price|stock|weather|score|result|update) (of|for|on)/i,
    
    // WHO/WHAT/WHERE questions about real entities
    /who (is|was|are|were) (the |a )?(president|prime minister|ceo|leader|founder|owner|king|queen|chancellor)/i,
    /who (is|are) .*('s|s') (president|leader|ceo|pm|prime minister)/i,
    /who (won|is winning|leads?|runs?|owns?|founded)/i,
    /who is [\w\s]+ (of|in|at|for)/i,
    
    // Questions about places, organizations, events
    /what is the (capital|population|gdp|currency|language) of/i,
    /where is (the |a )?[\w\s]+/i,
    /when (did|does|will|is) /i,
    
    // Current year references
    /(what|who|when|where|how|why) .* (today|right now|currently|2024|2025|2026)/i,
    /(in |as of )?202[4-9]/i,
    
    // Crypto and finance
    /crypto(currency)? (price|market)/i,
    /\b(bitcoin|btc|ethereum|eth|doge)\b.*(price|worth|value)/i,
    /(stock|share) (price|value)/i,
    
    // Real-time keywords
    /latest .*/i,
    /current .*/i,
    /recent .*/i,
    /trending/i,
    /happening (now|today|right now)/i,
    
    // Search intent
    /search (for|about)/i,
    /look up/i,
    /find (me |out )?(information|info|details|news|about)/i,
    /tell me (about|who|what|where|when|how|why)/i,
    /can you (search|find|look up|tell me)/i,
    
    // Social media and websites
    /(twitter|x\.com|instagram|facebook|tiktok|youtube|linkedin|reddit)/i,
    /on (twitter|x|instagram|facebook|tiktok|youtube|linkedin|reddit)/i,
    /social media/i,
    
    // General factual questions that need current info
    /who is [A-Z]/i,  // Proper nouns starting with capital
    /what happened/i,
    /how (many|much|old|tall|big|long)/i,
    /is .* (dead|alive|married|president|ceo)/i,
    
    // Sports and entertainment
    /(game|match|score|result|winner|champion)/i,
    /(movie|film|show|series|album|song) .*(released|coming|new|latest)/i,
    
    // Any question about real-world entities
    /\?(who|what|where|when|why|how)/i,  // Questions at end
    /^(who|what|where|when|why|how) /i,  // Questions at start
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lowerMsg) || pattern.test(message)) {
      // Extract the search query - clean it up
      const query = message
        .replace(/^(hey |hi |hello |okay |ok |please |can you |could you )/i, '')
        .replace(/\?$/g, '')
        .trim();
      return { needed: true, query };
    }
  }
  
  // If the message is a question (ends with ?) and mentions any proper noun, search
  if (message.includes('?') && /[A-Z][a-z]+/.test(message)) {
    return { needed: true, query: message.replace(/\?$/g, '').trim() };
  }
  
  return { needed: false, query: '' };
}

// Detect if user wants to read a URL
function extractUrl(message: string): string | null {
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const matches = message.match(urlPattern);
  return matches ? matches[0] : null;
}

// Tavily Search - Primary search engine (more up-to-date)
async function performTavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = Deno.env.get('TAVILY_API_KEY');
  if (!apiKey) {
    console.log('Tavily API key not configured, falling back to Firecrawl');
    return [];
  }

  try {
    console.log('🔍 Performing Tavily search for:', query);
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 8, // Increased for better coverage
        include_domains: [], // No restrictions - access all sites
        exclude_domains: [], // No exclusions
      }),
    });

    if (!response.ok) {
      console.error('Tavily search failed:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('✅ Tavily returned', data.results?.length || 0, 'results');
    
    // Also include the generated answer if available
    if (data.answer) {
      console.log('📝 Tavily provided answer:', data.answer.slice(0, 100) + '...');
    }
    
    return data.results || [];
  } catch (error) {
    console.error('Tavily search error:', error);
    return [];
  }
}

// Firecrawl Search - Fallback search
async function performFirecrawlSearch(query: string): Promise<FirecrawlResult[]> {
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
        limit: 8,
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

// Combined search - try Tavily first, fallback to Firecrawl
async function performWebSearch(query: string): Promise<string> {
  // Try Tavily first (more up-to-date)
  const tavilyResults = await performTavilySearch(query);
  
  if (tavilyResults.length > 0) {
    let context = '\n\n🔍 **Live Web Search Results (Real-time from Tavily):**\n\n';
    for (const result of tavilyResults) {
      context += `### ${result.title}\n`;
      context += `*Source: ${result.url}*\n\n`;
      const content = result.content.length > 2500 ? result.content.slice(0, 2500) + '...' : result.content;
      context += `${content}\n\n---\n\n`;
    }
    return context;
  }
  
  // Fallback to Firecrawl
  const firecrawlResults = await performFirecrawlSearch(query);
  
  if (firecrawlResults.length > 0) {
    let context = '\n\n🔍 **Live Web Search Results:**\n\n';
    for (const result of firecrawlResults) {
      context += `### ${result.title}\n`;
      context += `*Source: ${result.url}*\n\n`;
      if (result.markdown) {
        const truncated = result.markdown.length > 2000 ? result.markdown.slice(0, 2000) + '...' : result.markdown;
        context += `${truncated}\n\n---\n\n`;
      } else if (result.description) {
        context += `${result.description}\n\n---\n\n`;
      }
    }
    return context;
  }
  
  return '';
}

async function scrapeUrl(url: string): Promise<string | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('Firecrawl API key not configured, skipping scrape');
    return null;
  }

  try {
    console.log('📄 Scraping URL:', url);
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
        waitFor: 2000, // Wait for dynamic content
        timeout: 30000,
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

    // Get user preferences for personalization (parallel with search check)
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const urlToRead = extractUrl(lastUserMessage);
    const searchCheck = needsWebSearch(lastUserMessage);

    console.log('📨 Message:', lastUserMessage.slice(0, 100));
    console.log('🔎 Needs search:', searchCheck.needed, '| Query:', searchCheck.query);

    // Parallel fetch: preferences and web data
    const preferencesPromise = userId 
      ? supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null });
    
    const webContextPromise = urlToRead
      ? scrapeUrl(urlToRead).then(content => {
          if (content) {
            const truncated = content.length > 12000 ? content.slice(0, 12000) + '...\n[Content truncated]' : content;
            return `\n\n📄 **Content from ${urlToRead}:**\n\n${truncated}`;
          }
          return '';
        })
      : searchCheck.needed
        ? performWebSearch(searchCheck.query)
        : Promise.resolve('');

    const [preferencesResult, webContext] = await Promise.all([preferencesPromise, webContextPromise]);
    const preferences = preferencesResult.data as UserPreferences | null;

    // Build system prompt based on preferences
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let systemPrompt = `You are Phoenix AI, an intelligent and adaptive personal assistant created by IYANU and the Phoenix Team. You are helpful, accurate, engaging, and slightly witty.

Your tagline is: "Rising to every question, in real time."

CURRENT DATE: ${formattedDate} (Year: ${currentDate.getFullYear()})

Your core capabilities:
- Answer questions with up-to-date knowledge (you have access to LIVE web search via Tavily)
- Access ANY website including social media (Twitter/X, Instagram, Facebook, YouTube, etc.)
- Generate content: blogs, tweets, summaries, reports, SEO content
- Read and summarize web pages when users share URLs
- Explain complex topics clearly at the user's level
- Help with creative writing, brainstorming, and analysis
- Provide personalized responses based on user preferences

CRITICAL BEHAVIOR RULES:
1. You CAN and DO access real-time web information for current events, facts, and news
2. When web search results are provided, USE THEM to give accurate, up-to-date answers
3. Always cite your sources with clickable links when using web data
4. NEVER say you don't have access to current information - you DO via web search
5. NEVER truncate or cut off your responses - always provide complete information
6. Format responses nicely with headers, bullet points, and proper spacing
7. Be conversational and helpful, adapt to the user's communication style

IMPORTANT: If web search results are provided below your message, that data is FRESH and REAL-TIME. Use it to answer the user's question accurately.

Always respond in the user's preferred language.`;
    
    if (preferences) {
      const styleMap: Record<string, string> = {
        formal: 'Respond in a formal, professional manner.',
        casual: 'Respond in a casual, friendly manner.',
        witty: 'Respond in a witty, playful manner with occasional humor.',
      };
      
      const lengthMap: Record<string, string> = {
        concise: 'Keep responses brief and to the point.',
        balanced: 'Provide balanced responses with appropriate detail.',
        detailed: 'Provide thorough, comprehensive responses with full details.',
      };
      
      const expertiseMap: Record<string, string> = {
        beginner: 'Explain concepts simply, avoid jargon.',
        intermediate: 'Use moderate technical language when appropriate.',
        expert: 'Feel free to use technical terms and assume domain knowledge.',
      };
      
      const languageMap: Record<string, string> = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German',
        pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', 
        ar: 'Arabic', hi: 'Hindi', ru: 'Russian'
      };

      const style = preferences.preferred_style || 'casual';
      const length = preferences.response_length || 'balanced';
      const expertise = preferences.expertise_level || 'intermediate';
      const lang = preferences.language || 'en';

      systemPrompt += `\n\nUser preferences:
- ${styleMap[style] || styleMap.casual}
- ${lengthMap[length] || lengthMap.balanced}
- ${expertiseMap[expertise] || expertiseMap.intermediate}
- ALWAYS respond in ${languageMap[lang] || 'English'}.`;
      
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
        content: processedMessages[lastIdx].content + '\n\n---\n**FRESH WEB SEARCH RESULTS (use this data to answer):**' + webContext,
      };
      console.log('✅ Added web context to message');
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
        max_tokens: 8192, // Increased for complete responses
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
