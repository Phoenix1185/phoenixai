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
    console.log('Typing indicator sent to:', chatId);
  } catch (error) {
    console.error('Failed to send typing indicator:', error);
  }
}

// Send message via GreenAPI
async function sendMessage(chatId: string, message: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    const response = await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendMessage/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send message:', await response.text());
    } else {
      console.log('Message sent successfully to:', chatId);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Process message with Phoenix AI (non-streaming for WhatsApp)
async function processWithPhoenixAI(message: string, senderName: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const systemPrompt = `You are Phoenix AI on WhatsApp, an intelligent assistant created by IYANU and the Phoenix Team.

Current date: ${new Date().toISOString().split('T')[0]}

IMPORTANT FOR WHATSAPP:
- Keep responses concise (under 1500 characters when possible)
- Use simple formatting (no markdown, just plain text with emojis)
- Be conversational and friendly
- You can use emojis sparingly for emphasis 🔥
- Don't use code blocks - describe code instead
- Break up long responses into readable paragraphs

The user's name is: ${senderName}

You have access to real-time web search. When asked about current events, news, or time-sensitive topics, you can search the web.`;

  // Check if web search is needed
  let webContext = '';
  const lowerMsg = message.toLowerCase();
  const needsSearch = /what('s| is) (the )?(latest|current|recent|today|new)|news|price|weather|score|2024|2025|2026|trending/i.test(lowerMsg);

  if (needsSearch) {
    const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    if (tavilyKey) {
      try {
        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: message,
            search_depth: 'basic',
            max_results: 3,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.results?.length > 0) {
            webContext = '\n\nWeb search results:\n' + searchData.results.map((r: any) => 
              `- ${r.title}: ${r.content.slice(0, 300)}... (${r.url})`
            ).join('\n');
          }
        }
      } catch (e) {
        console.error('Web search failed:', e);
      }
    }
  }

  const userContent = message + (webContext ? `\n\n[Context from web search]:${webContext}` : '');

  // Call Lovable AI Gateway (non-streaming)
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
        { role: 'user', content: userContent },
      ],
      stream: false,
      max_tokens: 1024,
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

    if (!idInstance || !apiToken) {
      console.error('GreenAPI credentials not configured');
      return new Response(
        JSON.stringify({ error: 'GreenAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhook: GreenAPIMessage = await req.json();
    console.log('Received webhook:', webhook.typeWebhook, webhook.senderData?.chatId);

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

    // Process with Phoenix AI
    console.log(`Processing message from ${senderName}: ${messageText.slice(0, 100)}...`);
    const aiResponse = await processWithPhoenixAI(messageText, senderName);

    // Send another typing indicator if AI took time
    sendTypingIndicator(chatId, idInstance, apiToken);

    // Send the response
    await sendMessage(chatId, aiResponse, idInstance, apiToken);

    return new Response(
      JSON.stringify({ status: 'success', processed: true }),
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
