import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  UserPreferences,
  ConversationMessage,
  needsWebSearch,
  performTavilySearch,
  scrapeUrl,
  buildSystemPrompt,
  extractUrls,
  isTimeQuery,
  getTimeForLocation,
  extractSocialMediaQuery,
  detectImageGenerationRequest,
  generateImage,
  searchKnowledgeBase,
  saveToKnowledgeBase,
  detectCorrection,
  extractQueryPattern,
  learnFromWebSearch,
} from "../_shared/phoenix-core.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Analyze image with Gemini Vision
async function analyzeImage(imageUrl: string, prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log('🖼️ Analyzing image:', imageUrl.slice(0, 100));
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'Describe this image in detail. What do you see?' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      console.error('Image analysis failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Image analysis error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId, imageUrl, imagePrompt } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const lastUserMessage = messages[messages.length - 1]?.content || '';
    console.log('📨 Message:', lastUserMessage.slice(0, 100));

    // Handle image analysis if provided
    if (imageUrl) {
      console.log('🖼️ Image provided, analyzing...');
      const imageAnalysis = await analyzeImage(imageUrl, imagePrompt || lastUserMessage, lovableApiKey);
      
      if (imageAnalysis) {
        // Return image analysis directly
        const analysisResponse = `🖼️ **Image Analysis:**\n\n${imageAnalysis}`;
        
        // Stream this as a response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const data = `data: ${JSON.stringify({ choices: [{ delta: { content: analysisResponse } }] })}\n\n`;
            controller.enqueue(encoder.encode(data));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      }
    }

    // Check for time queries first - handle directly
    const timeCheck = isTimeQuery(lastUserMessage);
    if (timeCheck.isTime && timeCheck.location) {
      const timeInfo = getTimeForLocation(timeCheck.location);
      if (timeInfo) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const data = `data: ${JSON.stringify({ choices: [{ delta: { content: `🕐 ${timeInfo}` } }] })}\n\n`;
            controller.enqueue(encoder.encode(data));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      }
    }

    // Check for image generation request
    const imageRequest = detectImageGenerationRequest(lastUserMessage);
    if (imageRequest.shouldGenerate) {
      console.log('🎨 Web image generation request detected');
      
      const result = await generateImage(
        imageRequest.prompt, 
        imageRequest.quality, 
        lovableApiKey
      );
      
      if (result.success && result.imageBase64) {
        // Return image as a streamed response
        const imageResponse = `🎨 **Here's your generated image:**\n\n![Generated Image](data:image/png;base64,${result.imageBase64})\n\n_Prompt: "${imageRequest.prompt}"_`;
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const data = `data: ${JSON.stringify({ 
              choices: [{ 
                delta: { content: imageResponse }
              }] 
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      } else {
        // Generation failed - return error message
        const errorResponse = `😔 I couldn't generate that image. ${result.error || 'Please try again with a different description.'}`;
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const data = `data: ${JSON.stringify({ choices: [{ delta: { content: errorResponse } }] })}\n\n`;
            controller.enqueue(encoder.encode(data));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      }
    }

    // Get user preferences
    let preferences: UserPreferences | null = null;
    if (userId) {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      preferences = data as UserPreferences | null;
    }

    // Check for web search needs
    const searchCheck = needsWebSearch(lastUserMessage);
    console.log('🔎 Search check:', searchCheck.needed, '| Type:', searchCheck.searchType);

    let webContext = '';

    // FIRST: Check knowledge base for cached/learned information
    const knowledgeEntry = await searchKnowledgeBase(supabase, lastUserMessage);
    if (knowledgeEntry) {
      console.log('📚 Using knowledge base entry:', knowledgeEntry.query_pattern);
      webContext += `\n\n📚 **VERIFIED KNOWLEDGE (previously learned):**\n${knowledgeEntry.verified_answer}`;
      if (knowledgeEntry.source_url) {
        webContext += `\n*Source: ${knowledgeEntry.source_url}*`;
      }
    }

    // Check if user is making a correction (teaching the AI)
    const correctionCheck = detectCorrection(lastUserMessage);
    if (correctionCheck.isCorrection && correctionCheck.correctedInfo) {
      console.log('🧠 User correction detected, saving to knowledge base');
      const queryPattern = extractQueryPattern(correctionCheck.correctedInfo, messages as ConversationMessage[]);
      await saveToKnowledgeBase(supabase, queryPattern, correctionCheck.correctedInfo, undefined, 'user_correction');
      webContext += `\n\n✅ **LEARNING:** I've saved this correction and will remember it for all future conversations.`;
    }

    // Handle URL scraping
    const urls = extractUrls(lastUserMessage);
    if (urls.length > 0 && firecrawlApiKey) {
      console.log('🔗 Found URLs to scrape:', urls);
      const scrapedContents = await Promise.all(
        urls.slice(0, 3).map(url => scrapeUrl(url, firecrawlApiKey))
      );
      
      for (let i = 0; i < urls.length && i < 3; i++) {
        if (scrapedContents[i]) {
          const truncated = scrapedContents[i]!.length > 8000 
            ? scrapedContents[i]!.slice(0, 8000) + '...[truncated]' 
            : scrapedContents[i];
          webContext += `\n\n📄 **Content from ${urls[i]}:**\n${truncated}`;
        }
      }
    }

    // Handle social media queries
    const socialQuery = extractSocialMediaQuery(lastUserMessage);
    if (socialQuery && tavilyApiKey) {
      console.log('📱 Social media query:', socialQuery);
      const searchResults = await performTavilySearch(socialQuery.query, tavilyApiKey);
      
      if (searchResults.results.length > 0) {
        webContext += `\n\n🔍 **${socialQuery.platform} Search Results for ${socialQuery.handle || 'query'}:**\n`;
        if (searchResults.answer) {
          webContext += `\n📝 Summary: ${searchResults.answer}\n`;
        }
        for (const result of searchResults.results.slice(0, 5)) {
          webContext += `\n• **${result.title}**\n${result.content.slice(0, 500)}\nSource: ${result.url}\n`;
        }
        
        // Auto-learn from search results
        await learnFromWebSearch(supabase, socialQuery.query, searchResults, 'social_media');
      }
    }

    // Handle general web search - ALWAYS search if proper nouns detected or factual query
    if (searchCheck.needed && !socialQuery && tavilyApiKey && (!knowledgeEntry || webContext.length < 500)) {
      console.log('🔍 Performing general search:', searchCheck.query);
      const searchResults = await performTavilySearch(searchCheck.query, tavilyApiKey);
      
      if (searchResults.results.length > 0) {
        webContext += '\n\n🔍 **Live Web Search Results:**\n';
        if (searchResults.answer) {
          webContext += `\n📝 Quick Answer: ${searchResults.answer}\n`;
        }
        for (const result of searchResults.results.slice(0, 6)) {
          webContext += `\n### ${result.title}\n${result.content.slice(0, 800)}\n*Source: ${result.url}*\n`;
        }
        
        // Auto-learn from search results
        await learnFromWebSearch(supabase, searchCheck.query, searchResults, 'web_search');
      }
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      isWhatsApp: false,
      preferences,
    });

    // Add web context to the last message
    const processedMessages = [...messages];
    if (webContext) {
      const lastIdx = processedMessages.length - 1;
      processedMessages[lastIdx] = {
        ...processedMessages[lastIdx],
        content: processedMessages[lastIdx].content + '\n\n---\n**FRESH WEB DATA (use this to answer):**' + webContext,
      };
      console.log('✅ Added web context to message');
    }

    // Call Lovable AI Gateway with streaming
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        max_tokens: 8192,
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
