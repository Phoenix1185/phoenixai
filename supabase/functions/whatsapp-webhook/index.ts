import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GreenAPIMessage {
  typeWebhook: string;
  instanceData?: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage?: string;
  senderData?: {
    chatId: string;
    sender: string;
    senderName: string;
  };
  messageData?: {
    typeMessage: string;
    textMessageData?: {
      textMessage: string;
    };
    extendedTextMessageData?: {
      text: string;
    };
  };
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Send typing indicator to WhatsApp
async function sendTypingIndicator(chatId: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendTyping/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        timeout: 5000,
      }),
    });
    console.log('⌨️ Typing indicator sent to:', chatId);
  } catch (error) {
    console.error('Failed to send typing indicator:', error);
  }
}

// Send message via GreenAPI
async function sendMessage(chatId: string, message: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    // WhatsApp has a character limit, split long messages
    const maxLength = 4000;
    const chunks = [];
    
    if (message.length > maxLength) {
      let remaining = message;
      while (remaining.length > 0) {
        // Try to split at a newline or space
        let splitIndex = maxLength;
        if (remaining.length > maxLength) {
          const lastNewline = remaining.lastIndexOf('\n', maxLength);
          const lastSpace = remaining.lastIndexOf(' ', maxLength);
          splitIndex = Math.max(lastNewline, lastSpace, maxLength / 2);
        }
        chunks.push(remaining.slice(0, splitIndex));
        remaining = remaining.slice(splitIndex).trim();
      }
    } else {
      chunks.push(message);
    }

    for (const chunk of chunks) {
      const response = await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendMessage/${apiToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          message: chunk,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send message:', await response.text());
      } else {
        console.log('✅ Message sent successfully to:', chatId);
      }
      
      // Small delay between chunks
      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Get or create conversation for a WhatsApp chat
async function getOrCreateConversation(
  supabase: any, 
  chatId: string, 
  senderName: string
): Promise<string> {
  // Check if conversation exists
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('chat_id', chatId)
    .single();

  if (existing) {
    // Update last activity
    await supabase
      .from('whatsapp_conversations')
      .update({ updated_at: new Date().toISOString(), sender_name: senderName })
      .eq('id', existing.id);
    return existing.id;
  }

  // Create new conversation
  const { data: newConv, error } = await supabase
    .from('whatsapp_conversations')
    .insert({ chat_id: chatId, sender_name: senderName })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return newConv.id;
}

// Get conversation history (last N messages for context)
async function getConversationHistory(
  supabase: any, 
  chatId: string, 
  limit: number = 20
): Promise<ConversationMessage[]> {
  const { data: messages, error } = await supabase
    .from('whatsapp_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }

  return messages || [];
}

// Save message to database
async function saveMessage(
  supabase: any,
  conversationId: string,
  chatId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      chat_id: chatId,
      role,
      content,
    });

  if (error) {
    console.error('Error saving message:', error);
  }
}

// Aggressive search detection (same as web version)
function needsWebSearch(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  const patterns = [
    /what('s| is) (the )?(latest|current|recent|today|new)/i,
    /news|price|weather|score|result|update/i,
    /who (is|was|are|were) (the )?(president|ceo|leader|founder|owner)/i,
    /who (won|is winning|leads?|runs?|owns?|founded)/i,
    /(what|who|when|where|how|why) .* (today|right now|currently|2024|2025|2026)/i,
    /202[4-9]/i,
    /crypto|bitcoin|btc|ethereum|stock|share/i,
    /latest|current|recent|trending|happening/i,
    /search|look up|find/i,
    /tell me (about|who|what)/i,
    /twitter|x\.com|instagram|facebook|tiktok|youtube|reddit/i,
    /who is [A-Z]/i,
    /\?$/,
  ];
  
  return patterns.some(p => p.test(lowerMsg) || p.test(message));
}

// Process message with Phoenix AI (non-streaming for WhatsApp)
async function processWithPhoenixAI(
  message: string, 
  senderName: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const systemPrompt = `You are Phoenix AI on WhatsApp, an intelligent assistant created by IYANU and the Phoenix Team.

CURRENT DATE: ${formattedDate} (Year: ${currentDate.getFullYear()})

The user's name is: ${senderName}

IMPORTANT FOR WHATSAPP:
- You REMEMBER the conversation history - this is an ongoing chat, not separate messages
- Refer back to previous messages when relevant
- Be natural and conversational, like texting a smart friend
- Use simple formatting (no markdown, just plain text with emojis)
- Keep responses under 2000 characters when possible
- You CAN use emojis for emphasis 🔥
- Don't use code blocks - explain code in plain text
- Break up long responses into readable paragraphs

You have access to REAL-TIME web search. When asked about current events, news, or factual questions, you WILL search the web and provide accurate, up-to-date information.

CRITICAL: You have access to live information via Tavily search. NEVER say you don't have current information - you DO.`;

  // Check if web search is needed
  let webContext = '';
  if (needsWebSearch(message)) {
    const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    if (tavilyKey) {
      try {
        console.log('🔍 WhatsApp: Searching for:', message);
        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: message,
            search_depth: 'advanced',
            include_answer: true,
            max_results: 5,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.results?.length > 0) {
            console.log('✅ Got', searchData.results.length, 'search results');
            webContext = '\n\n[LIVE WEB SEARCH RESULTS - USE THIS DATA]:\n' + 
              searchData.results.map((r: any) => 
                `• ${r.title}: ${r.content.slice(0, 500)} (Source: ${r.url})`
              ).join('\n\n');
            
            if (searchData.answer) {
              webContext = `\n\n[QUICK ANSWER]: ${searchData.answer}\n` + webContext;
            }
          }
        }
      } catch (e) {
        console.error('Web search failed:', e);
      }
    }
  }

  const userContent = message + webContext;

  // Build messages array with conversation history
  const messagesForAI = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  // Call Lovable AI Gateway (non-streaming)
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: messagesForAI,
      stream: false,
      max_tokens: 2048,
    }),
  });

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) {
      return "⚠️ I'm receiving too many requests right now. Please try again in a moment.";
    }
    if (aiResponse.status === 402) {
      return "⚠️ Phoenix AI credits are depleted. Please contact the administrator.";
    }
    throw new Error('AI Gateway error: ' + aiResponse.status);
  }

  const data = await aiResponse.json();
  return data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET for webhook verification
  if (req.method === 'GET') {
    return new Response('Phoenix AI WhatsApp Webhook Active 🔥', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const idInstance = Deno.env.get('GREENAPI_ID_INSTANCE');
    const apiToken = Deno.env.get('GREENAPI_API_TOKEN_INSTANCE');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!idInstance || !apiToken) {
      console.error('GreenAPI credentials not configured');
      return new Response(
        JSON.stringify({ error: 'GreenAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const webhook: GreenAPIMessage = await req.json();
    
    console.log('📱 Received webhook:', webhook.typeWebhook, webhook.senderData?.chatId);

    // Only process incoming messages
    if (webhook.typeWebhook !== 'incomingMessageReceived') {
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'Not an incoming message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chatId = webhook.senderData?.chatId;
    const senderName = webhook.senderData?.senderName || 'User';

    if (!chatId) {
      return new Response(
        JSON.stringify({ error: 'No chat ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract message text
    let messageText = '';
    if (webhook.messageData?.textMessageData?.textMessage) {
      messageText = webhook.messageData.textMessageData.textMessage;
    } else if (webhook.messageData?.extendedTextMessageData?.text) {
      messageText = webhook.messageData.extendedTextMessageData.text;
    }

    if (!messageText) {
      // Send response for non-text messages
      await sendMessage(
        chatId,
        "🔥 Hey! I'm Phoenix AI. I can only process text messages for now. Send me a question or topic you'd like to explore!",
        idInstance,
        apiToken
      );
      return new Response(
        JSON.stringify({ status: 'handled', type: 'non-text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send typing indicator immediately (non-blocking)
    sendTypingIndicator(chatId, idInstance, apiToken);

    // Get or create conversation & fetch history (parallel)
    const [conversationId, history] = await Promise.all([
      getOrCreateConversation(supabase, chatId, senderName),
      getConversationHistory(supabase, chatId, 20),
    ]);

    // Save the user message
    await saveMessage(supabase, conversationId, chatId, 'user', messageText);

    // Process with Phoenix AI (with conversation context)
    console.log(`🧠 Processing message from ${senderName} (${history.length} messages in history)`);
    const aiResponse = await processWithPhoenixAI(messageText, senderName, history);

    // Save the assistant response
    await saveMessage(supabase, conversationId, chatId, 'assistant', aiResponse);

    // Send another typing indicator before response (in case AI took time)
    sendTypingIndicator(chatId, idInstance, apiToken);

    // Send the response
    await sendMessage(chatId, aiResponse, idInstance, apiToken);

    return new Response(
      JSON.stringify({ status: 'success', processed: true, historyLength: history.length + 2 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('WhatsApp webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
