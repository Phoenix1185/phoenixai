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
  isTimeQuery,
  getTimeForLocation,
  extractSocialMediaQuery,
  selectModel,
  analyzeImage,
  transcribeAudio,
  generateVoiceResponse,
  detectImageGenerationRequest,
  generateImage,
  searchKnowledgeBase,
  saveToKnowledgeBase,
  detectCorrection,
  extractQueryPattern,
  learnFromWebSearch,
  detectMemoryCommand,
  saveUserMemory,
  getUserMemories,
  deleteUserMemories,
  formatMemoriesForPrompt,
  AI_MODELS,
} from "../_shared/phoenix-core.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      file_size?: number;
      width: number;
      height: number;
    }>;
    caption?: string;
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    reply_to_message?: {
      message_id: number;
      from?: {
        id: number;
        is_bot: boolean;
      };
    };
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
      user?: { id: number; username?: string };
    }>;
  };
  edited_message?: TelegramUpdate['message'];
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    message?: TelegramUpdate['message'];
    data?: string;
  };
}

interface TelegramConversation {
  id: string;
  chat_id: string;
  sender_name: string;
  preferred_language?: string;
  created_at: string;
  updated_at: string;
}

// Send typing action
async function sendTypingAction(chatId: number, botToken: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch (error) {
    console.error('Typing action error:', error);
  }
}

// Send message (with optional message editing)
async function sendMessage(
  chatId: number, 
  text: string, 
  botToken: string,
  editMessageId?: number
): Promise<number | null> {
  try {
    // Format text for Telegram (similar to WhatsApp)
    const formatted = formatForWhatsApp(text);
    
    const maxLength = 4096;
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

    let lastMessageId: number | null = null;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Only edit the first chunk if editMessageId is provided
      if (i === 0 && editMessageId) {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: editMessageId,
            text: chunk,
            parse_mode: 'Markdown',
          }),
        });
        
        if (!response.ok) {
          // If edit fails, send as new message
          const fallbackResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: chunk,
              parse_mode: 'Markdown',
            }),
          });
          const data = await fallbackResponse.json();
          lastMessageId = data.result?.message_id;
        } else {
          lastMessageId = editMessageId;
        }
      } else {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: 'Markdown',
          }),
        });

        if (!response.ok) {
          console.error('Send message failed:', await response.text());
        } else {
          const data = await response.json();
          lastMessageId = data.result?.message_id;
        }
      }

      if (chunks.length > 1 && i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return lastMessageId;
  } catch (error) {
    console.error('Send message error:', error);
    return null;
  }
}

// Send photo
async function sendPhoto(
  chatId: number,
  photoData: string, // base64 or URL
  caption: string,
  botToken: string
): Promise<void> {
  try {
    if (photoData.startsWith('data:')) {
      // Base64 image - need to upload as file
      const base64 = photoData.split(',')[1] || photoData.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const formData = new FormData();
      formData.append('chat_id', chatId.toString());
      formData.append('photo', new Blob([bytes], { type: 'image/png' }), 'image.png');
      formData.append('caption', caption.slice(0, 1024));
      formData.append('parse_mode', 'Markdown');
      
      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
    } else {
      // URL
      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoData,
          caption: caption.slice(0, 1024),
          parse_mode: 'Markdown',
        }),
      });
    }
  } catch (error) {
    console.error('Send photo error:', error);
  }
}

// Send voice note via Telegram
async function sendVoiceNote(
  chatId: number,
  audioBuffer: ArrayBuffer,
  botToken: string
): Promise<boolean> {
  try {
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    form.append('voice', blob, 'voice.mp3');

    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
      method: 'POST',
      body: form,
    });

    if (resp.ok) {
      console.log('✅ Voice note sent to Telegram');
      return true;
    }
    console.error('Voice note send failed:', await resp.text());
    return false;
  } catch (error) {
    console.error('Voice note error:', error);
    return false;
  }
}

// Check if chat is a group
function isGroupChat(chatType: string): boolean {
  return chatType === 'group' || chatType === 'supergroup';
}

// Check if bot is mentioned in a Telegram group message
function isBotMentionedTelegram(
  message: any,
  botToken: string
): boolean {
  const text = message.text || message.caption || '';
  const lowerText = text.toLowerCase();

  // Check for /phoenix command
  if (lowerText.startsWith('/phoenix')) return true;

  // Check for @mention via entities
  if (message.entities) {
    for (const entity of message.entities) {
      if (entity.type === 'mention') {
        const mentionText = text.substring(entity.offset, entity.offset + entity.length).toLowerCase();
        // We check against common bot names; the actual username check happens via entity.user
        if (mentionText.includes('phoenix')) return true;
      }
      if (entity.type === 'text_mention' && entity.user?.is_bot) {
        return true; // Direct mention of a bot user
      }
    }
  }

  // Check for name mentions in text
  if (lowerText.includes('@phoenix') || lowerText.includes('phoenix ai') || lowerText.includes('hey phoenix')) {
    return true;
  }

  // Check if replying to the bot's message
  if (message.reply_to_message?.from?.is_bot) {
    return true;
  }

  return false;
}

// Get file URL from Telegram
async function getFileUrl(fileId: string, botToken: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const data = await response.json();
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    return null;
  } catch (error) {
    console.error('Get file URL error:', error);
    return null;
  }
}

const MAX_CONTEXT_MESSAGES = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (browser visits, health checks)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'Phoenix Telegram Bot is running! 🔥',
      webhook: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check if request has a body
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ ok: true, message: 'No JSON body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    if (!body || body.trim() === '') {
      return new Response(JSON.stringify({ ok: true, message: 'Empty body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update: TelegramUpdate = JSON.parse(body);
    console.log('📱 Telegram update:', JSON.stringify(update).slice(0, 500));

    const message = update.message || update.edited_message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = message.chat.id;
    const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || 'User';
    const username = message.from.username;
    const messageText = message.text || message.caption || '';
    const isEdit = !!update.edited_message;

    // Get environment variables
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Bot not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GROUP CHAT: Only respond if mentioned or replied to
    if (isGroupChat(message.chat.type)) {
      console.log('👥 Telegram group message detected, chat type:', message.chat.type);
      if (!isBotMentionedTelegram(message, botToken)) {
        console.log('👥 Not mentioned in group - ignoring');
        return new Response(JSON.stringify({ ok: true, reason: 'not_mentioned_in_group' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log('👥 ✅ Mentioned in Telegram group, responding!');
    }

    // Clean bot mentions from text for group messages
    let processedText = messageText;
    if (isGroupChat(message.chat.type)) {
      processedText = processedText
        .replace(/^\/phoenix\s*/i, '')
        .replace(/@\w+bot\b/gi, '')
        .replace(/@phoenix\w*/gi, '')
        .trim();
    }

    // Send typing indicator
    await sendTypingAction(chatId, botToken);

    // Get or create conversation
    const chatIdStr = chatId.toString();
    let { data: conversation } = await supabase
      .from('telegram_conversations')
      .select('*')
      .eq('chat_id', chatIdStr)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('telegram_conversations')
        .insert({
          chat_id: chatIdStr,
          sender_name: senderName,
          username: username,
        })
        .select()
        .single();
      conversation = newConv;
    } else {
      await supabase
        .from('telegram_conversations')
        .update({ sender_name: senderName, updated_at: new Date().toISOString() })
        .eq('id', conversation.id);
    }

    // VOICE MESSAGE HANDLING
    if (message.voice) {
      console.log('🎤 Processing Telegram voice message, duration:', message.voice.duration);
      const voiceUrl = await getFileUrl(message.voice.file_id, botToken);
      
      if (voiceUrl && elevenLabsKey) {
        const transcription = await transcribeAudio(voiceUrl, elevenLabsKey);
        
        if (transcription) {
          console.log('✅ Voice transcribed:', transcription.slice(0, 100));
          
          // Get conversation history
          let history: ConversationMessage[] = [];
          if (conversation) {
            const { data: msgs } = await supabase
              .from('telegram_messages')
              .select('role, content')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: true })
              .limit(MAX_CONTEXT_MESSAGES);
            if (msgs) history = msgs.map((m: any) => ({ role: m.role, content: m.content }));
          }

          // Get user memories for context
          const memories = await getUserMemories(supabase, 'telegram', chatIdStr);
          const memoriesPrompt = formatMemoriesForPrompt(memories);
          
          const systemPrompt = buildSystemPrompt({
            senderName,
            isWhatsApp: true,
            savedLanguage: conversation?.preferred_language,
          }) + memoriesPrompt;

          const model = selectModel(transcription, false, true);
          
          const thinkingMsgId = await sendMessage(chatId, '🎤 _Transcribing your voice..._', botToken);

          const isOpenAI = model.startsWith('openai/');
          const tokenParam = isOpenAI ? { max_completion_tokens: 4096 } : { max_tokens: 4096 };
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: `[Voice message transcription]: ${transcription}` },
              ],
              ...tokenParam,
            }),
          });

          let reply = '❌ Could not process voice message.';
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            reply = aiData.choices?.[0]?.message?.content || reply;
          }

          // Edit thinking message with actual reply
          await sendMessage(chatId, reply, botToken, thinkingMsgId || undefined);

          // Try voice response
          let voiceSent = false;
          if (elevenLabsKey && reply.length < 1000) {
            const voiceBuffer = await generateVoiceResponse(reply, elevenLabsKey);
            if (voiceBuffer) {
              voiceSent = await sendVoiceNote(chatId, voiceBuffer, botToken);
            }
          }

          // Save to history
          if (conversation) {
            await supabase.from('telegram_messages').insert([
              { conversation_id: conversation.id, chat_id: chatIdStr, role: 'user', content: `[Voice]: ${transcription}` },
              { conversation_id: conversation.id, chat_id: chatIdStr, role: 'assistant', content: reply },
            ]);
          }

          return new Response(JSON.stringify({ ok: true, type: 'voice', voiceReply: voiceSent }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      
      // Voice transcription failed
      await sendMessage(chatId, '🎤 I received your voice message but couldn\'t transcribe it. Please try again or type your message! 🔥', botToken);
      return new Response(JSON.stringify({ ok: true, type: 'voice_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for memory commands BEFORE regular commands
    const memoryCmd = detectMemoryCommand(processedText);
    if (memoryCmd.type !== 'none') {
      if (memoryCmd.type === 'save' && memoryCmd.fact) {
        const saved = await saveUserMemory(supabase, 'telegram', chatIdStr, memoryCmd.fact);
        const reply = saved
          ? `🧠 Got it! I'll remember: "${memoryCmd.fact}" 🔥`
          : `😔 Couldn't save that memory. Please try again.`;
        await sendMessage(chatId, reply, botToken);
        return new Response(JSON.stringify({ ok: true, type: 'memory_save' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (memoryCmd.type === 'recall') {
        const memories = await getUserMemories(supabase, 'telegram', chatIdStr);
        const reply = memories.length > 0
          ? `🧠 *Here's what I remember about you:*\n\n${memories.map(m => `• ${m.fact}`).join('\n')}`
          : `🧠 I don't have any saved memories for you yet. Tell me things like "Remember that..." and I'll keep them! 🔥`;
        await sendMessage(chatId, reply, botToken);
        return new Response(JSON.stringify({ ok: true, type: 'memory_recall' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (memoryCmd.type === 'forget') {
        const count = await deleteUserMemories(supabase, 'telegram', chatIdStr, memoryCmd.forgetQuery);
        const reply = count > 0
          ? `🧠 Done! Forgotten ${count} ${count === 1 ? 'memory' : 'memories'}. 🔥`
          : `🧠 No matching memories found to forget.`;
        await sendMessage(chatId, reply, botToken);
        return new Response(JSON.stringify({ ok: true, type: 'memory_forget' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Check for special commands
    const command = parseCommand(processedText);
    
    if (command.isCommand) {
      if (command.command === 'help') {
        await sendMessage(chatId, getHelpMessage(), botToken);
        return new Response(JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      if (command.command === 'clear') {
        if (conversation) {
          await supabase
            .from('telegram_messages')
            .delete()
            .eq('conversation_id', conversation.id);
        }
        await sendMessage(chatId, '🔥 *Phoenix memory cleared!*\n\nStarting fresh. How can I help you?', botToken);
        return new Response(JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (command.command === 'language' && command.language) {
        await supabase
          .from('telegram_conversations')
          .update({ preferred_language: command.language })
          .eq('id', conversation.id);
        await sendMessage(chatId, `✅ *Language updated!*\n\nI'll now respond in your preferred language.`, botToken);
        return new Response(JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Handle photo messages
    let imageAnalysis = '';
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const photoUrl = await getFileUrl(largestPhoto.file_id, botToken);
      
      if (photoUrl) {
        // Check if user wants to generate art from this image
        const wantsArt = processedText && (
          /edit|art|transform|style|painting|cartoon|anime/i.test(processedText)
        );
        
        if (wantsArt) {
          await sendMessage(chatId, '🎨 _Creating art from your image..._', botToken);
          const result = await generateImage(processedText + ' based on the uploaded image', 'high', lovableApiKey);
          if (result.success && result.imageBase64) {
            await sendPhoto(
              chatId,
              `data:image/png;base64,${result.imageBase64}`,
              `🎨 *Generated Art*\n\n_${processedText}_`,
              botToken
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        // Default: analyze the image
        imageAnalysis = await analyzeImage(photoUrl, processedText, lovableApiKey) || '';
        if (imageAnalysis) {
          await sendMessage(chatId, `🖼️ *Image Analysis*\n\n${imageAnalysis}`, botToken);
          
          // Save to conversation history
          if (conversation) {
            await supabase.from('telegram_messages').insert([
              { conversation_id: conversation.id, chat_id: chatIdStr, role: 'user', content: processedText || '[Image]' },
              { conversation_id: conversation.id, chat_id: chatIdStr, role: 'assistant', content: imageAnalysis },
            ]);
          }
          
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Skip if no text
    if (!processedText.trim() && !imageAnalysis) {
      return new Response(JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for time queries
    const timeCheck = isTimeQuery(processedText);
    if (timeCheck.isTime && timeCheck.location) {
      const timeInfo = getTimeForLocation(timeCheck.location);
      if (timeInfo) {
        await sendMessage(chatId, `🕐 ${timeInfo}`, botToken);
        return new Response(JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Check for image generation request
    const imageRequest = detectImageGenerationRequest(processedText);
    if (imageRequest.shouldGenerate) {
      const loadingMsgId = await sendMessage(chatId, '🎨 _Generating your image..._', botToken);
      
      const result = await generateImage(imageRequest.prompt, imageRequest.quality, lovableApiKey);
      
      if (result.success && result.imageBase64) {
        await sendPhoto(
          chatId,
          `data:image/png;base64,${result.imageBase64}`,
          `🎨 *Generated Image*\n\n_${imageRequest.prompt}_`,
          botToken
        );
        if (loadingMsgId) {
          await sendMessage(chatId, '✅ Image generated!', botToken, loadingMsgId);
        }
      } else {
        if (loadingMsgId) {
          await sendMessage(chatId, `😔 Couldn't generate that image. ${result.error || 'Please try again.'}`, botToken, loadingMsgId);
        }
      }
      
      return new Response(JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get conversation history
    let conversationHistory: ConversationMessage[] = [];
    if (conversation) {
      const { data: messages } = await supabase
        .from('telegram_messages')
        .select('role, content')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(MAX_CONTEXT_MESSAGES);
      
      if (messages) {
        conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      }
    }

    // Add current message
    conversationHistory.push({ role: 'user', content: processedText });

    // Web search
    const searchCheck = needsWebSearch(processedText);
    let webContext = '';

    // Check knowledge base first
    const knowledgeEntry = await searchKnowledgeBase(supabase, processedText);
    if (knowledgeEntry) {
      webContext += `\n\n📚 *VERIFIED KNOWLEDGE:*\n${knowledgeEntry.verified_answer}`;
    }

    // URL scraping
    const urls = extractUrls(processedText);
    if (urls.length > 0 && firecrawlApiKey) {
      for (const url of urls.slice(0, 2)) {
        const content = await scrapeUrl(url, firecrawlApiKey);
        if (content) {
          webContext += `\n\n📄 *Content from ${url}:*\n${content.slice(0, 3000)}`;
        }
      }
    }

    // Social media search
    const socialQuery = extractSocialMediaQuery(processedText);
    if (socialQuery && tavilyApiKey) {
      const results = await performTavilySearch(socialQuery.query, tavilyApiKey);
      if (results.results.length > 0) {
        webContext += `\n\n🔍 *${socialQuery.platform} Results:*\n`;
        if (results.answer) webContext += `${results.answer}\n`;
        for (const r of results.results.slice(0, 3)) {
          webContext += `• ${r.title}: ${r.content.slice(0, 300)}\n`;
        }
      }
    }

    // General web search
    if (searchCheck.needed && !socialQuery && tavilyApiKey && webContext.length < 500) {
      const results = await performTavilySearch(searchCheck.query, tavilyApiKey);
      if (results.results.length > 0) {
        webContext += '\n\n🔍 *Web Search Results:*\n';
        if (results.answer) webContext += `${results.answer}\n`;
        for (const r of results.results.slice(0, 4)) {
          webContext += `• ${r.title}: ${r.content.slice(0, 400)}\n`;
        }
        await learnFromWebSearch(supabase, searchCheck.query, results, 'telegram_search');
      }
    }

    // Get user memories for prompt injection
    const memories = await getUserMemories(supabase, 'telegram', chatIdStr);
    const memoriesPrompt = formatMemoriesForPrompt(memories);

    // Build system prompt with memories
    const systemPrompt = buildSystemPrompt({
      senderName,
      isWhatsApp: true,
      savedLanguage: conversation?.preferred_language,
    }) + memoriesPrompt;

    // Add web context to message
    const processedHistory = [...conversationHistory];
    if (webContext) {
      const lastIdx = processedHistory.length - 1;
      processedHistory[lastIdx] = {
        ...processedHistory[lastIdx],
        content: processedHistory[lastIdx].content + '\n\n---\n*FRESH WEB DATA:*' + webContext,
      };
    }

    // Select best model
    const model = selectModel(processedText, !!message.photo, !!message.voice);

    // Send "Phoenix is thinking" message for longer responses
    let thinkingMsgId: number | null = null;
    if (searchCheck.needed || processedText.length > 100) {
      thinkingMsgId = await sendMessage(chatId, '🔥 _Phoenix is thinking..._', botToken);
    }

    // Call AI
    const isOpenAIModel = model.startsWith('openai/');
    const tokenParamMain = isOpenAIModel ? { max_completion_tokens: 4096 } : { max_tokens: 4096 };
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...processedHistory,
        ],
        ...tokenParamMain,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      const errorMsg = aiResponse.status === 429 
        ? '⏳ Rate limited. Please wait a moment.'
        : aiResponse.status === 402
        ? '💳 AI credits depleted.'
        : '❌ Something went wrong. Please try again.';
      await sendMessage(chatId, errorMsg, botToken, thinkingMsgId || undefined);
      return new Response(JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

    // Edit the thinking message or send new
    if (thinkingMsgId) {
      await sendMessage(chatId, reply, botToken, thinkingMsgId);
    } else {
      await sendMessage(chatId, reply, botToken);
    }

    // Save to history
    if (conversation) {
      await supabase.from('telegram_messages').insert([
        { conversation_id: conversation.id, chat_id: chatIdStr, role: 'user', content: processedText },
        { conversation_id: conversation.id, chat_id: chatIdStr, role: 'assistant', content: reply },
      ]);
    }

    return new Response(JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
