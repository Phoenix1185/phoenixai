import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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
  selectModel,
  analyzeImage,
  transcribeAudio,
  generateVoiceResponse,
  detectImageGenerationRequest,
  generateImage,
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
        quotedMessage?: {
          stanzaId?: string;
          participant?: string;
          conversation?: string;
          extendedTextMessage?: {
            text?: string;
          };
        };
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
      conversation?: string;
    };
  };
  // For incoming calls
  from?: string;
  status?: string;
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

// Send text message with chunking for long messages
async function sendMessage(chatId: string, message: string, idInstance: string, apiToken: string): Promise<void> {
  try {
    // Always normalize formatting for WhatsApp (prevents **bold** etc.)
    const formatted = formatForWhatsApp(message);

    const maxLength = 4000;
    const chunks: string[] = [];

    if (formatted.length > maxLength) {
      let remaining = formatted;
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
      chunks.push(formatted);
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

// Send voice/audio message via GreenAPI
async function sendVoiceMessage(chatId: string, audioBuffer: ArrayBuffer, idInstance: string, apiToken: string): Promise<boolean> {
  try {
    console.log('📤 Sending voice message to WhatsApp');

    // Convert to base64 for fallback JSON-mode
    const base64Audio = base64Encode(audioBuffer);

    // Prefer multipart/form-data (recommended by GreenAPI docs)
    try {
      const form = new FormData();
      form.append('chatId', chatId);
      form.append('fileName', 'voice_response.mp3');
      form.append('caption', '');

      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      form.append('file', blob, 'voice_response.mp3');

      const resp = await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendFileByUpload/${apiToken}`, {
        method: 'POST',
        body: form,
      });

      if (resp.ok) {
        console.log('✅ Voice message sent (multipart)');
        return true;
      }

      console.warn('Voice upload (multipart) failed:', await resp.text());
    } catch (e) {
      console.warn('Voice upload (multipart) error:', e);
    }

    // Fallback: JSON with data URI (some setups support this)
    const response = await fetch(`https://api.greenapi.com/waInstance${idInstance}/sendFileByUpload/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        file: `data:audio/mpeg;base64,${base64Audio}`,
        fileName: 'voice_response.mp3',
        caption: '',
      }),
    });

    if (!response.ok) {
      console.error('Voice message JSON fallback failed:', await response.text());
      return false;
    }

    console.log('✅ Voice message sent (json fallback)');
    return true;
  } catch (error) {
    console.error('Voice message error:', error);
    return false;
  }
}

// Resolve a media download URL when GreenAPI doesn't include it in the webhook payload
async function resolveDownloadUrl(
  chatId: string,
  messageId: string | undefined,
  idInstance: string,
  apiToken: string
): Promise<string | null> {
  if (!messageId) return null;

  try {
    const url = new URL(`https://api.greenapi.com/waInstance${idInstance}/downloadFile/${apiToken}`);
    url.searchParams.set('chatId', chatId);
    url.searchParams.set('messageId', messageId);

    const resp = await fetch(url.toString(), { method: 'GET' });
    if (!resp.ok) {
      console.error('downloadFile failed:', await resp.text());
      return null;
    }

    const data = await resp.json().catch(() => ({} as any));
    return (data.downloadUrl || data.urlFile || data.url) ?? null;
  } catch (e) {
    console.error('downloadFile error:', e);
    return null;
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
      console.log('Native poll failed, using text fallback');
      await sendMessage(chatId, formatPoll(question, options), idInstance, apiToken);
    }
  } catch (error) {
    console.error('Poll error, using fallback:', error);
    await sendMessage(chatId, formatPoll(question, options), idInstance, apiToken);
  }
}

// Send image message via GreenAPI
async function sendImageMessage(
  chatId: string, 
  imageBase64: string, 
  caption: string,
  idInstance: string, 
  apiToken: string
): Promise<boolean> {
  try {
    console.log('📤 Sending generated image to WhatsApp');
    
    // Use GreenAPI's sendFileByUpload with base64 data URI
    const response = await fetch(
      `https://api.greenapi.com/waInstance${idInstance}/sendFileByUpload/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          file: `data:image/png;base64,${imageBase64}`,
          fileName: 'phoenix_generated.png',
          caption: caption || '🎨 Generated by Phoenix AI',
        }),
      }
    );

    if (response.ok) {
      console.log('✅ Image sent to WhatsApp');
      return true;
    }

    const errorText = await response.text();
    console.error('Image send failed:', errorText);
    
    // Fallback: Try multipart form data
    try {
      const form = new FormData();
      form.append('chatId', chatId);
      form.append('fileName', 'phoenix_generated.png');
      form.append('caption', caption || '🎨 Generated by Phoenix AI');
      
      // Decode base64 to binary
      const binaryString = atob(imageBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      form.append('file', blob, 'phoenix_generated.png');

      const resp = await fetch(
        `https://api.greenapi.com/waInstance${idInstance}/sendFileByUpload/${apiToken}`,
        { method: 'POST', body: form }
      );

      if (resp.ok) {
        console.log('✅ Image sent (multipart fallback)');
        return true;
      }
    } catch (e) {
      console.error('Multipart fallback failed:', e);
    }
    
    return false;
  } catch (error) {
    console.error('Image send error:', error);
    return false;
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

// Get conversation history - get RECENT messages in chronological order
async function getConversationHistory(
  supabase: any, 
  chatId: string, 
  limit: number = 20  // Reduced to 20 for better context management
): Promise<ConversationMessage[]> {
  // First get the most recent messages in descending order
  const { data: messages, error } = await supabase
    .from('whatsapp_messages')
    .select('role, content, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Reverse to get chronological order (oldest first for AI context)
  // This ensures we have the MOST RECENT messages, not the oldest
  const chronological = messages.reverse().map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  console.log(`📚 Loaded ${chronological.length} messages from history`);
  return chronological;
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

// Normalize WID format for comparison (strip @c.us and @s.whatsapp.net)
function normalizeWid(wid: string): string {
  return wid.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '').trim();
}

// Check if bot is mentioned in group OR if the message is a reply to the bot's message
function isBotMentioned(webhook: GreenAPIMessage, botWid: string): boolean {
  const normalizedBotWid = normalizeWid(botWid);
  console.log('🔍 Checking mention for bot:', normalizedBotWid);
  
  // Check direct mentions in the mentionedJidList
  const mentionedList = webhook.messageData?.extendedTextMessageData?.contextInfo?.mentionedJidList;
  if (mentionedList && mentionedList.length > 0) {
    console.log('👥 Mentioned list:', mentionedList);
    for (const mentioned of mentionedList) {
      if (normalizeWid(mentioned) === normalizedBotWid) {
        console.log('✅ Bot directly mentioned in list');
        return true;
      }
    }
  }
  
  // Check if this is a reply to the bot's message (quoted message)
  const quotedParticipant = webhook.messageData?.extendedTextMessageData?.contextInfo?.quotedMessage?.participant;
  if (quotedParticipant && normalizeWid(quotedParticipant) === normalizedBotWid) {
    console.log('👥 Message is a reply to bot\'s message');
    return true;
  }
  
  // Also check the legacy quotedMessage format
  const legacyQuoted = webhook.messageData?.quotedMessage?.participant;
  if (legacyQuoted && normalizeWid(legacyQuoted) === normalizedBotWid) {
    console.log('👥 Message is a reply to bot\'s message (legacy format)');
    return true;
  }
  
  // Check for @mentions in text with phone number
  const messageText = webhook.messageData?.textMessageData?.textMessage || 
                      webhook.messageData?.extendedTextMessageData?.text || '';
  const lowerText = messageText.toLowerCase();
  
  // Check for @phoenixai, @phoenix, or bot's number mentioned with @
  if (lowerText.includes('@phoenix') || lowerText.includes('phoenix ai') || lowerText.includes('hey phoenix')) {
    console.log('✅ Bot mentioned by name in text');
    return true;
  }
  
  // Check if the bot's phone number is mentioned with @ (e.g., @2341234567890)
  if (normalizedBotWid) {
    // Check both formats
    if (messageText.includes(`@${normalizedBotWid}`)) {
      console.log('✅ Bot mentioned by number in text');
      return true;
    }
  }
  
  return false;
}

// Get context from quoted/replied message
function getQuotedMessageContext(webhook: GreenAPIMessage): string | null {
  const quotedMessage = webhook.messageData?.extendedTextMessageData?.contextInfo?.quotedMessage;
  if (quotedMessage) {
    const quotedText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;
    if (quotedText) {
      return quotedText;
    }
  }
  
  // Check legacy format
  const legacyQuoted = webhook.messageData?.quotedMessage;
  if (legacyQuoted?.conversation) {
    return legacyQuoted.conversation;
  }
  
  return null;
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
  preferredLanguage?: string,
  messageContext?: string
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

  let webContext = messageContext || '';

  // Check for time queries first
  const timeCheck = isTimeQuery(message);
  if (timeCheck.isTime && timeCheck.location) {
    const timeInfo = getTimeForLocation(timeCheck.location);
    if (timeInfo) {
      webContext += `\n\n⏰ TIME INFO: ${timeInfo}`;
    }
  }

  // Check for URLs
  const urls = extractUrls(message);
  if (urls.length > 0 && firecrawlApiKey) {
    console.log('🔗 Scraping URLs:', urls);
    for (const url of urls.slice(0, 2)) {
      const content = await scrapeUrl(url, firecrawlApiKey);
      if (content) {
        const truncated = content.length > 5000 ? content.slice(0, 5000) + '...' : content;
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
      for (const r of results.results.slice(0, 5)) {
        webContext += `• ${r.title}: ${r.content.slice(0, 400)}\nSource: ${r.url}\n\n`;
      }
    }
  }

  // Check for general search needs
  const searchCheck = needsWebSearch(message);
  if (searchCheck.needed && !socialQuery && tavilyApiKey && webContext.length < 500) {
    console.log('🔍 General search:', searchCheck.query);
    const results = await performTavilySearch(searchCheck.query, tavilyApiKey);
    if (results.results.length > 0) {
      webContext += '\n\n🔍 Live Web Search Results:\n';
      if (results.answer) webContext += `Quick Answer: ${results.answer}\n\n`;
      for (const r of results.results.slice(0, 6)) {
        webContext += `• ${r.title}: ${r.content.slice(0, 500)}\nSource: ${r.url}\n\n`;
      }
    }
  }

  const userContent = message + webContext;
  
  // Select the right model for complexity
  const model = selectModel(message, false, false);

  // Build messages array with full context
  const messagesForAI = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  console.log(`🤖 Using model: ${model}`);

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messagesForAI,
      stream: false,
      max_tokens: 3000,
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
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!idInstance || !apiToken) {
      return new Response(
        JSON.stringify({ error: 'GreenAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const webhook: GreenAPIMessage = await req.json();
    
    console.log('📱 Webhook:', webhook.typeWebhook, webhook.senderData?.chatId, 'Type:', webhook.messageData?.typeMessage);

    // Handle incoming voice calls - inform user about voice call feature
    if (webhook.typeWebhook === 'incomingCall') {
      console.log('📞 Incoming call from:', webhook.from || webhook.senderData?.chatId);
      const callerId = webhook.from || webhook.senderData?.chatId;
      if (callerId && webhook.status === 'offer') {
        // Send a message explaining voice call limitations
        await sendMessage(
          callerId,
          "📞 *Incoming Call Detected*\n\nHey! I noticed you're trying to call me. WhatsApp voice calls can't be answered by AI yet, but I'm fully available here in chat! 🔥\n\nYou can:\n• Send me text messages\n• Send voice notes (I'll transcribe and respond)\n• Send images (I'll analyze them)\n\nI respond instantly! What can I help you with?",
          idInstance,
          apiToken
        );
      }
      return new Response(
        JSON.stringify({ status: 'handled', type: 'incomingCall' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (webhook.typeWebhook !== 'incomingMessageReceived') {
      return new Response(
        JSON.stringify({ status: 'ignored', reason: webhook.typeWebhook }),
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
    
    // Get or create conversation early for all message types
    const conversation = await getOrCreateConversation(supabase, chatId, senderName);
    const history = await getConversationHistory(supabase, chatId, 30);

    // Handle image messages
    if (webhook.messageData?.typeMessage === 'imageMessage') {
      console.log('🖼️ Processing image message');

      const anyData: any = webhook.messageData as any;
      const caption: string | undefined =
        webhook.messageData?.imageMessage?.caption ||
        anyData?.imageMessageData?.caption ||
        anyData?.caption;

      let imageUrl: string | null =
        webhook.messageData?.imageMessage?.downloadUrl ||
        anyData?.imageMessageData?.downloadUrl ||
        anyData?.fileMessageData?.downloadUrl ||
        null;

      // Some GreenAPI payloads omit downloadUrl; request it using the message id
      if (!imageUrl) {
        imageUrl = await resolveDownloadUrl(chatId, webhook.idMessage, idInstance, apiToken);
      }

      if (!imageUrl) {
        await sendMessage(
          chatId,
          "🖼️ I received your image, but WhatsApp didn't include a downloadable file link. Please resend the image (or add a caption/question) and I'll analyze it. 🔥",
          idInstance,
          apiToken
        );

        return new Response(
          JSON.stringify({ status: 'partial', type: 'image', error: 'missing_download_url' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageAnalysis = await analyzeImage(imageUrl, caption, lovableApiKey);

      if (imageAnalysis) {
        // Save to history
        await saveMessage(
          supabase,
          conversation.id,
          chatId,
          'user',
          `[Sent an image${caption ? `: "${caption}"` : ''}]`
        );

        // Process with full AI context if caption suggests a question
        let finalResponse = imageAnalysis;
        if (caption && (caption.includes('?') || caption.length > 10)) {
          // Use AI to generate a contextual response
          finalResponse = await processWithPhoenixAI(
            caption || 'Describe this image',
            senderName,
            history,
            conversation.preferred_language,
            `\n\n🖼️ IMAGE ANALYSIS:\n${imageAnalysis}`
          );
        } else {
          finalResponse = `🖼️ *Image Analysis:*\n\n${imageAnalysis}`;
        }

        await saveMessage(supabase, conversation.id, chatId, 'assistant', finalResponse);
        await sendMessage(chatId, finalResponse, idInstance, apiToken);

        return new Response(
          JSON.stringify({ status: 'success', type: 'image' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Image analysis failed, acknowledge and ask to try again
      await sendMessage(
        chatId,
        "🖼️ I received your image but had trouble analyzing it. Could you try sending it again? 🔥",
        idInstance,
        apiToken
      );

      return new Response(
        JSON.stringify({ status: 'partial', type: 'image', error: 'analysis_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle audio/voice messages
    const isVoiceMessage =
      webhook.messageData?.typeMessage === 'audioMessage' ||
      webhook.messageData?.typeMessage === 'voiceMessage' ||
      webhook.messageData?.typeMessage === 'pttMessage';

    if (isVoiceMessage) {
      console.log('🎤 Processing voice message');

      const anyData: any = webhook.messageData as any;

      let audioUrl: string | null =
        webhook.messageData?.audioMessage?.downloadUrl ||
        anyData?.audioMessageData?.downloadUrl ||
        anyData?.fileMessageData?.downloadUrl ||
        null;

      // Some GreenAPI payloads omit downloadUrl; request it using the message id
      if (!audioUrl) {
        audioUrl = await resolveDownloadUrl(chatId, webhook.idMessage, idInstance, apiToken);
      }

      if (!audioUrl) {
        await sendMessage(
          chatId,
          "🎤 I received your voice note, but WhatsApp didn't include a downloadable audio link. Please resend it and I'll transcribe + reply. 🔥",
          idInstance,
          apiToken
        );

        return new Response(
          JSON.stringify({ status: 'partial', type: 'voice', error: 'missing_download_url' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let transcription: string | null = null;

      // Use ElevenLabs for transcription if available
      if (elevenLabsKey) {
        transcription = await transcribeAudio(audioUrl, elevenLabsKey);
      }

      if (transcription) {
        console.log('✅ Transcribed:', transcription.slice(0, 100));

        // Save transcription
        await saveMessage(supabase, conversation.id, chatId, 'user', `[Voice message]: ${transcription}`);

        // Process the transcribed text through the full AI pipeline
        const aiResponse = await processWithPhoenixAI(
          transcription,
          senderName,
          history,
          conversation.preferred_language
        );

        await saveMessage(supabase, conversation.id, chatId, 'assistant', aiResponse);

        // Try to send voice response back if ElevenLabs is available
        let voiceSent = false;
        if (elevenLabsKey && aiResponse.length < 1000) {
          const voiceBuffer = await generateVoiceResponse(aiResponse, elevenLabsKey);
          if (voiceBuffer) {
            voiceSent = await sendVoiceMessage(chatId, voiceBuffer, idInstance, apiToken);
          }
        }

        // Always send text response (as backup or primary)
        if (!voiceSent) {
          await sendMessage(chatId, aiResponse, idInstance, apiToken);
        } else {
          // Send text as well for reference
          await sendMessage(
            chatId,
            `📝 _Transcription: "${transcription.slice(0, 100)}${transcription.length > 100 ? '...' : ''}"_\n\n${aiResponse}`,
            idInstance,
            apiToken
          );
        }

        return new Response(
          JSON.stringify({ status: 'success', type: 'voice', voiceResponse: voiceSent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transcription failed
      await sendMessage(
        chatId,
        "🎤 I received your voice message but had trouble transcribing it. Please try again, or type your message and I'll respond right away. 🔥",
        idInstance,
        apiToken
      );

      return new Response(
        JSON.stringify({ status: 'partial', type: 'voice', error: 'transcription_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      // This should rarely happen now since we handle images and voice above
      const msgType = webhook.messageData?.typeMessage || 'unknown';
      console.log('⚠️ No text extracted from message type:', msgType);
      
      // Don't send generic welcome for stickers, reactions, etc.
      if (msgType === 'stickerMessage' || msgType === 'reactionMessage') {
        return new Response(
          JSON.stringify({ status: 'ignored', type: msgType }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      await sendMessage(
        chatId,
        `🔥 Hey ${senderName}! I received your ${msgType === 'documentMessage' ? 'document' : 'message'}. Try sending me text, an image, or a voice note and I'll help you out!`,
        idInstance,
        apiToken
      );
      return new Response(
        JSON.stringify({ status: 'handled', type: 'non-text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          await sendMessage(chatId, `🧹 Done ${senderName}! I've cleared our conversation history. Let's start fresh! 🔥\n\nWhat would you like to talk about?`, idInstance, apiToken);
          return new Response(
            JSON.stringify({ status: 'success', command: 'clear' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        case 'save':
          await sendMessage(chatId, `💾 Conversation saved ${senderName}! All our chat history is securely stored and I'll remember everything we've discussed. 🔥`, idInstance, apiToken);
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
              ha: 'Hausa', ig: 'Igbo', pcm: 'Nigerian Pidgin',
            };
            await sendMessage(chatId, `🗣️ Got it ${senderName}! From now on, I'll respond in *${langNames[command.language] || command.language}*. 🔥`, idInstance, apiToken);
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

    // Check for image generation request BEFORE regular AI processing
    const imageRequest = detectImageGenerationRequest(messageText);
    if (imageRequest.shouldGenerate) {
      console.log('🎨 WhatsApp image generation request detected');
      
      // Send typing indicator while generating
      await sendTypingIndicator(chatId, idInstance, apiToken);
      
      // Generate the image
      const result = await generateImage(
        imageRequest.prompt,
        imageRequest.quality,
        lovableApiKey
      );
      
      if (result.success && result.imageBase64) {
        // Save to history
        await saveMessage(supabase, conversation.id, chatId, 'user', messageText);
        
        // Send the image
        const imageSent = await sendImageMessage(
          chatId,
          result.imageBase64,
          `🎨 *${imageRequest.prompt.slice(0, 100)}${imageRequest.prompt.length > 100 ? '...' : ''}*`,
          idInstance,
          apiToken
        );
        
        if (imageSent) {
          await saveMessage(supabase, conversation.id, chatId, 'assistant', `[Generated image: ${imageRequest.prompt}]`);
          return new Response(
            JSON.stringify({ status: 'success', type: 'image_generation' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Image send failed, send as text fallback
        await sendMessage(chatId, `🎨 I generated your image, but had trouble sending it. Please try again! 🔥`, idInstance, apiToken);
      } else {
        // Generation failed
        await saveMessage(supabase, conversation.id, chatId, 'user', messageText);
        await sendMessage(
          chatId,
          `😔 Sorry ${senderName}, I couldn't generate that image. ${result.error || 'Please try again with a different description.'} 🔥`,
          idInstance,
          apiToken
        );
        await saveMessage(supabase, conversation.id, chatId, 'assistant', `[Image generation failed: ${result.error}]`);
      }
      
      return new Response(
        JSON.stringify({ status: 'handled', type: 'image_generation', error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🧠 Processing: ${senderName} (${history.length} messages in history)`);
    console.log(`📝 Message: "${messageText.slice(0, 100)}${messageText.length > 100 ? '...' : ''}"`);

    // Get context from quoted/replied message if any
    const quotedContext = getQuotedMessageContext(webhook);
    let contextualMessage = messageText;
    
    if (quotedContext) {
      console.log(`💬 Reply to: "${quotedContext.slice(0, 50)}..."`);
      contextualMessage = `[Replying to: "${quotedContext.slice(0, 300)}"]\n\n${messageText}`;
    }

    // Save user message (including the reply context for clarity)
    await saveMessage(supabase, conversation.id, chatId, 'user', contextualMessage);

    // Keep typing while processing
    sendTypingIndicator(chatId, idInstance, apiToken);

    // Process with Phoenix AI - pass the full context with TRY-CATCH for error handling
    let aiResponse: string;
    try {
      aiResponse = await processWithPhoenixAI(
        contextualMessage, 
        senderName, 
        history,
        conversation.preferred_language
      );
    } catch (error) {
      console.error('AI processing failed:', error);
      // Provide a friendly fallback response instead of failing
      aiResponse = `Hey ${senderName}! 🔥 I had a brief hiccup processing that. Could you rephrase your message or try again? I'm here to help!`;
    }

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
