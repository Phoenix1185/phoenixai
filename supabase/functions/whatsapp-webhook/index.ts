import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ConversationMessage,
  needsWebSearch,
  performTavilySearch,
  scrapeUrl,
  buildSystemPrompt,
  extractUrls,
  parseCommand,
  formatForWhatsApp,
  getHelpMessage,
  formatPoll,
  isTimeQuery,
  getTimeForLocation,
  extractSocialMediaQuery,
} from "../_shared/phoenix-core.ts";

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
    chatName?: string;
  };
  messageData?: {
    typeMessage: string;
    textMessageData?: {
      textMessage: string;
    };
    extendedTextMessageData?: {
      text: string;
      description?: string;
      title?: string;
      jpegThumbnail?: string;
      contextInfo?: {
        mentionedJidList?: string[];
      };
    };
    imageMessage?: {
      downloadUrl: string;
      caption?: string;
      jpegThumbnail?: string;
    };
    audioMessage?: {
      downloadUrl: string;
      seconds?: number;
    };
    documentMessage?: {
      downloadUrl: string;
      fileName?: string;
    };
    stickerMessage?: {
      downloadUrl: string;
    };
    quotedMessage?: {
      stanzaId: string;
      participant: string;
    };
  };
}

interface WhatsAppConversation {
  id: string;
  chat_id: string;
  sender_name: string;
  preferred_language?: string;
  created_at: string;
  updated_at: string;
}

// Send typing indicator
async function sendTypingIndicator(chatId: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendTyping/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, timeout: 10000 }),
    });
  } catch (error) {
    console.error('Typing indicator error:', error);
  }
}

// Send message with chunking for long messages
async function sendMessage(chatId: string, message: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    const maxLength = 4000;
    const chunks: string[] = [];
    
    if (message.length > maxLength) {
      let remaining = message;
      while (remaining.length > 0) {
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
        body: JSON.stringify({ chatId, message: chunk }),
      });

      if (!response.ok) {
        console.error('Send message failed:', await response.text());
      }
      
      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (error) {
    console.error('Send message error:', error);
  }
}

// Send poll via GreenAPI
async function sendPoll(chatId: string, question: string, options: string[], idInstance: string, apiToken: string): Promise<void> {
  try {
    const response = await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendPoll/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: question,
        options: options.map(opt => ({ optionName: opt })),
        multipleAnswers: false,
      }),
    });

    if (!response.ok) {
      // Fallback to text poll if native poll fails
      console.log('Native poll failed, using text fallback');
      await sendMessage(chatId, formatPoll(question, options), idInstance, apiToken);
    }
  } catch (error) {
    console.error('Poll error, using fallback:', error);
    await sendMessage(chatId, formatPoll(question, options), idInstance, apiToken);
  }
}

// Send sticker
async function sendSticker(chatId: string, stickerUrl: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendFileByUrl/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        urlFile: stickerUrl,
        fileName: 'sticker.webp',
      }),
    });
  } catch (error) {
    console.error('Sticker error:', error);
  }
}

// Get or create conversation
async function getOrCreateConversation(
  supabase: any, 
  chatId: string, 
  senderName: string
): Promise<WhatsAppConversation> {
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('chat_id', chatId)
    .single();

  if (existing) {
    await supabase
      .from('whatsapp_conversations')
      .update({ updated_at: new Date().toISOString(), sender_name: senderName })
      .eq('id', existing.id);
    return existing;
  }

  const { data: newConv, error } = await supabase
    .from('whatsapp_conversations')
    .insert({ chat_id: chatId, sender_name: senderName })
    .select('*')
    .single();

  if (error) throw error;
  return newConv;
}

// Get conversation history
async function getConversationHistory(
  supabase: any, 
  chatId: string, 
  limit: number = 30
): Promise<ConversationMessage[]> {
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);

  return messages || [];
}

// Save message
async function saveMessage(
  supabase: any,
  conversationId: string,
  chatId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    chat_id: chatId,
    role,
    content,
  });
}

// Clear conversation history
async function clearConversation(supabase: any, chatId: string): Promise<void> {
  await supabase.from('whatsapp_messages').delete().eq('chat_id', chatId);
}

// Update conversation language
async function updateConversationLanguage(supabase: any, conversationId: string, language: string): Promise<void> {
  await supabase
    .from('whatsapp_conversations')
    .update({ preferred_language: language })
    .eq('id', conversationId);
}

// Analyze image with Gemini Vision
async function analyzeImage(imageUrl: string, caption: string | undefined, apiKey: string): Promise<string | null> {
  try {
    console.log('🖼️ Analyzing WhatsApp image');
    
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
              { type: 'text', text: caption || 'Describe this image in detail. What do you see? Keep response under 500 words.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Image analysis error:', error);
    return null;
  }
}

// Transcribe audio with Gemini
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('🎤 Transcribing audio');
    
    // For audio, we'll use the model to process the audio file
    // Note: This is a simplified version - for production, you'd want proper audio processing
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
            content: `The user sent a voice message. Audio URL: ${audioUrl}. Please acknowledge that you received a voice message and ask them to type their message for now, as voice transcription is being set up.`,
          },
        ],
        max_tokens: 256,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

// Check if bot is mentioned in group
function isBotMentioned(webhook: GreenAPIMessage, botWid: string): boolean {
  const mentionedList = webhook.messageData?.extendedTextMessageData?.contextInfo?.mentionedJidList;
  if (mentionedList && mentionedList.includes(botWid)) {
    return true;
  }
  
  // Also check if the message text mentions the bot
  const messageText = webhook.messageData?.textMessageData?.textMessage || 
                      webhook.messageData?.extendedTextMessageData?.text || '';
  const lowerText = messageText.toLowerCase();
  
  // Common ways to mention the bot
  if (lowerText.includes('@phoenix') || lowerText.includes('phoenix ai') || lowerText.includes('hey phoenix')) {
    return true;
  }
  
  return false;
}

// Check if chat is a group
function isGroupChat(chatId: string): boolean {
  return chatId.includes('@g.us');
}

// Process message with Phoenix AI
async function processWithPhoenixAI(
  message: string, 
  senderName: string,
  conversationHistory: ConversationMessage[],
  preferredLanguage?: string
): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    senderName,
    isWhatsApp: true,
    savedLanguage: preferredLanguage,
  });

  let webContext = '';

  // Check for time queries first
  const timeCheck = isTimeQuery(message);
  if (timeCheck.isTime && timeCheck.location) {
    const timeInfo = getTimeForLocation(timeCheck.location);
    if (timeInfo) {
      webContext = `\n\n⏰ TIME INFO: ${timeInfo}`;
    }
  }

  // Check for URLs
  const urls = extractUrls(message);
  if (urls.length > 0 && firecrawlApiKey) {
    console.log('🔗 Scraping URLs:', urls);
    for (const url of urls.slice(0, 2)) {
      const content = await scrapeUrl(url, firecrawlApiKey);
      if (content) {
        const truncated = content.length > 4000 ? content.slice(0, 4000) + '...' : content;
        webContext += `\n\n📄 Content from ${url}:\n${truncated}`;
      }
    }
  }

  // Check for social media queries
  const socialQuery = extractSocialMediaQuery(message);
  if (socialQuery && tavilyApiKey) {
    console.log('📱 Social search:', socialQuery.query);
    const results = await performTavilySearch(socialQuery.query, tavilyApiKey);
    if (results.results.length > 0) {
      webContext += `\n\n🔍 ${socialQuery.platform} Search Results:\n`;
      if (results.answer) webContext += `Summary: ${results.answer}\n\n`;
      for (const r of results.results.slice(0, 4)) {
        webContext += `• ${r.title}: ${r.content.slice(0, 300)}\nSource: ${r.url}\n\n`;
      }
    }
  }

  // Check for general search needs
  const searchCheck = needsWebSearch(message);
  if (searchCheck.needed && !socialQuery && tavilyApiKey && webContext.length < 500) {
    console.log('🔍 General search:', searchCheck.query);
    const results = await performTavilySearch(searchCheck.query, tavilyApiKey);
    if (results.results.length > 0) {
      webContext += '\n\n🔍 Live Search Results:\n';
      if (results.answer) webContext += `Quick Answer: ${results.answer}\n\n`;
      for (const r of results.results.slice(0, 5)) {
        webContext += `• ${r.title}: ${r.content.slice(0, 400)}\nSource: ${r.url}\n\n`;
      }
    }
  }

  const userContent = message + webContext;

  // Build messages array with full context
  const messagesForAI = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

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
    if (aiResponse.status === 429) return "⚠️ Too many requests. Please wait a moment and try again.";
    if (aiResponse.status === 402) return "⚠️ Phoenix AI credits depleted. Please contact the administrator.";
    throw new Error('AI Gateway error: ' + aiResponse.status);
  }

  const data = await aiResponse.json();
  let response = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";
  
  // Format for WhatsApp
  response = formatForWhatsApp(response);
  
  return response;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response('Phoenix AI WhatsApp Webhook Active 🔥', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const idInstance = Deno.env.get('GREENAPI_ID_INSTANCE')!;
    const apiToken = Deno.env.get('GREENAPI_API_TOKEN_INSTANCE')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!idInstance || !apiToken) {
      return new Response(
        JSON.stringify({ error: 'GreenAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const webhook: GreenAPIMessage = await req.json();
    
    console.log('📱 Webhook:', webhook.typeWebhook, webhook.senderData?.chatId);

    if (webhook.typeWebhook !== 'incomingMessageReceived') {
      return new Response(
        JSON.stringify({ status: 'ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chatId = webhook.senderData?.chatId;
    const senderName = webhook.senderData?.senderName || 'User';
    const botWid = webhook.instanceData?.wid || '';

    if (!chatId) {
      return new Response(
        JSON.stringify({ error: 'No chat ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For group chats, only respond if mentioned
    if (isGroupChat(chatId)) {
      if (!isBotMentioned(webhook, botWid)) {
        console.log('👥 Group message, not mentioned - ignoring');
        return new Response(
          JSON.stringify({ status: 'ignored', reason: 'Not mentioned in group' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('👥 Mentioned in group, responding');
    }

    // Send typing immediately
    sendTypingIndicator(chatId, idInstance, apiToken);

    // Handle image messages
    if (webhook.messageData?.typeMessage === 'imageMessage' && webhook.messageData?.imageMessage?.downloadUrl) {
      console.log('🖼️ Processing image message');
      const imageAnalysis = await analyzeImage(
        webhook.messageData.imageMessage.downloadUrl,
        webhook.messageData.imageMessage.caption,
        lovableApiKey
      );

      if (imageAnalysis) {
        const conversation = await getOrCreateConversation(supabase, chatId, senderName);
        await saveMessage(supabase, conversation.id, chatId, 'user', `[Sent an image: ${webhook.messageData.imageMessage.caption || 'no caption'}]`);
        await saveMessage(supabase, conversation.id, chatId, 'assistant', imageAnalysis);
        await sendMessage(chatId, formatForWhatsApp(`🖼️ *Image Analysis:*\n\n${imageAnalysis}`), idInstance, apiToken);
        
        return new Response(
          JSON.stringify({ status: 'success', type: 'image' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle audio/voice messages
    if ((webhook.messageData?.typeMessage === 'audioMessage' || webhook.messageData?.typeMessage === 'voiceMessage') && 
        webhook.messageData?.audioMessage?.downloadUrl) {
      console.log('🎤 Processing voice message');
      const transcription = await transcribeAudio(
        webhook.messageData.audioMessage.downloadUrl,
        lovableApiKey
      );

      if (transcription) {
        await sendMessage(chatId, formatForWhatsApp(transcription), idInstance, apiToken);
        return new Response(
          JSON.stringify({ status: 'success', type: 'audio' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Extract text message
    let messageText = '';
    if (webhook.messageData?.textMessageData?.textMessage) {
      messageText = webhook.messageData.textMessageData.textMessage;
    } else if (webhook.messageData?.extendedTextMessageData?.text) {
      messageText = webhook.messageData.extendedTextMessageData.text;
    }

    // Remove bot mention from message for cleaner processing
    messageText = messageText.replace(/@\d+/g, '').trim();

    if (!messageText) {
      await sendMessage(
        chatId,
        "🔥 Hey! I'm Phoenix AI. Send me a text message, image, or voice note!",
        idInstance,
        apiToken
      );
      return new Response(
        JSON.stringify({ status: 'handled', type: 'non-text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(supabase, chatId, senderName);

    // Check for special commands
    const command = parseCommand(messageText);
    
    if (command.isCommand) {
      switch (command.command) {
        case 'help':
          await sendMessage(chatId, getHelpMessage(), idInstance, apiToken);
          return new Response(
            JSON.stringify({ status: 'success', command: 'help' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        case 'clear':
          await clearConversation(supabase, chatId);
          await sendMessage(chatId, "🧹 Done! I've cleared our conversation history. Let's start fresh! 🔥\n\nWhat would you like to talk about?", idInstance, apiToken);
          return new Response(
            JSON.stringify({ status: 'success', command: 'clear' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        case 'save':
          await sendMessage(chatId, "💾 Conversation saved! All our chat history is securely stored and I'll remember everything we've discussed. 🔥", idInstance, apiToken);
          return new Response(
            JSON.stringify({ status: 'success', command: 'save' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        case 'language':
          if (command.language) {
            await updateConversationLanguage(supabase, conversation.id, command.language);
            const langNames: Record<string, string> = {
              en: 'English', fr: 'French', es: 'Spanish', de: 'German',
              pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ar: 'Arabic',
              hi: 'Hindi', ru: 'Russian', it: 'Italian', yo: 'Yoruba',
            };
            await sendMessage(chatId, `🗣️ Got it! From now on, I'll respond in *${langNames[command.language] || command.language}*. 🔥`, idInstance, apiToken);
          }
          return new Response(
            JSON.stringify({ status: 'success', command: 'language' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        case 'poll':
          if (command.pollData) {
            await sendPoll(chatId, command.pollData.question, command.pollData.options, idInstance, apiToken);
          }
          return new Response(
            JSON.stringify({ status: 'success', command: 'poll' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    }

    // Get conversation history
    const history = await getConversationHistory(supabase, chatId, 30);
    console.log(`🧠 Processing: ${senderName} (${history.length} messages in history)`);

    // Save user message
    await saveMessage(supabase, conversation.id, chatId, 'user', messageText);

    // Keep typing while processing
    sendTypingIndicator(chatId, idInstance, apiToken);

    // Process with Phoenix AI
    const aiResponse = await processWithPhoenixAI(
      messageText, 
      senderName, 
      history,
      conversation.preferred_language
    );

    // Save assistant response
    await saveMessage(supabase, conversation.id, chatId, 'assistant', aiResponse);

    // Send response
    await sendMessage(chatId, aiResponse, idInstance, apiToken);

    return new Response(
      JSON.stringify({ status: 'success', historyLength: history.length + 2 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('WhatsApp webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
