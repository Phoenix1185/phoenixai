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
  detectImageGenerationRequest,
  generateImage,
  searchKnowledgeBase,
  saveToKnowledgeBase,
  detectCorrection,
  extractQueryPattern,
  learnFromWebSearch,
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

  try {
    const update: TelegramUpdate = await req.json();
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

    // Check for special commands
    const command = parseCommand(messageText);
    
    if (command.isCommand) {
      if (command.command === 'help') {
        await sendMessage(chatId, getHelpMessage(), botToken);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (command.command === 'clear') {
        if (conversation) {
          await supabase
            .from('telegram_messages')
            .delete()
            .eq('conversation_id', conversation.id);
        }
        await sendMessage(chatId, '🔥 *Phoenix memory cleared!*\n\nStarting fresh. How can I help you?', botToken);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command.command === 'language' && command.language) {
        await supabase
          .from('telegram_conversations')
          .update({ preferred_language: command.language })
          .eq('id', conversation.id);
        await sendMessage(chatId, `✅ *Language updated!*\n\nI'll now respond in your preferred language.`, botToken);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle photo messages
    let imageAnalysis = '';
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const photoUrl = await getFileUrl(largestPhoto.file_id, botToken);
      
      if (photoUrl) {
        // Check if user wants to generate art from this image
        const wantsArt = messageText && (
          /edit|art|transform|style|painting|cartoon|anime/i.test(messageText)
        );
        
        if (wantsArt) {
          await sendMessage(chatId, '🎨 _Creating art from your image..._', botToken);
          const result = await generateImage(messageText + ' based on the uploaded image', 'high', lovableApiKey);
          if (result.success && result.imageBase64) {
            await sendPhoto(
              chatId,
              `data:image/png;base64,${result.imageBase64}`,
              `🎨 *Generated Art*\n\n_${messageText}_`,
              botToken
            );
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        // Default: analyze the image
        imageAnalysis = await analyzeImage(photoUrl, messageText, lovableApiKey) || '';
        if (imageAnalysis) {
          await sendMessage(chatId, `🖼️ *Image Analysis*\n\n${imageAnalysis}`, botToken);
          
          // Save to conversation history
          if (conversation) {
            await supabase.from('telegram_messages').insert([
              { conversation_id: conversation.id, chat_id: chatIdStr, role: 'user', content: messageText || '[Image]' },
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
    if (!messageText.trim() && !imageAnalysis) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for time queries
    const timeCheck = isTimeQuery(messageText);
    if (timeCheck.isTime && timeCheck.location) {
      const timeInfo = getTimeForLocation(timeCheck.location);
      if (timeInfo) {
        await sendMessage(chatId, `🕐 ${timeInfo}`, botToken);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check for image generation request
    const imageRequest = detectImageGenerationRequest(messageText);
    if (imageRequest.shouldGenerate) {
      // Send "generating" message that we'll edit later
      const loadingMsgId = await sendMessage(chatId, '🎨 _Generating your image..._', botToken);
      
      const result = await generateImage(imageRequest.prompt, imageRequest.quality, lovableApiKey);
      
      if (result.success && result.imageBase64) {
        await sendPhoto(
          chatId,
          `data:image/png;base64,${result.imageBase64}`,
          `🎨 *Generated Image*\n\n_${imageRequest.prompt}_`,
          botToken
        );
        
        // Edit the loading message to show completion
        if (loadingMsgId) {
          await sendMessage(chatId, '✅ Image generated!', botToken, loadingMsgId);
        }
      } else {
        if (loadingMsgId) {
          await sendMessage(chatId, `😔 Couldn't generate that image. ${result.error || 'Please try again.'}`, botToken, loadingMsgId);
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    conversationHistory.push({ role: 'user', content: messageText });

    // Web search
    const searchCheck = needsWebSearch(messageText);
    let webContext = '';

    // Check knowledge base first
    const knowledgeEntry = await searchKnowledgeBase(supabase, messageText);
    if (knowledgeEntry) {
      webContext += `\n\n📚 *VERIFIED KNOWLEDGE:*\n${knowledgeEntry.verified_answer}`;
    }

    // URL scraping
    const urls = extractUrls(messageText);
    if (urls.length > 0 && firecrawlApiKey) {
      for (const url of urls.slice(0, 2)) {
        const content = await scrapeUrl(url, firecrawlApiKey);
        if (content) {
          webContext += `\n\n📄 *Content from ${url}:*\n${content.slice(0, 3000)}`;
        }
      }
    }

    // Social media search
    const socialQuery = extractSocialMediaQuery(messageText);
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

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      senderName,
      isWhatsApp: true, // Use WhatsApp formatting for Telegram too
      savedLanguage: conversation?.preferred_language,
    });

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
    const model = selectModel(messageText, !!message.photo, !!message.voice);

    // Send "Phoenix is thinking" message for longer responses
    let thinkingMsgId: number | null = null;
    if (searchCheck.needed || messageText.length > 100) {
      thinkingMsgId = await sendMessage(chatId, '🔥 _Phoenix is thinking..._', botToken);
    }

    // Call AI
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
        max_tokens: 4096,
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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        { conversation_id: conversation.id, chat_id: chatIdStr, role: 'user', content: messageText },
        { conversation_id: conversation.id, chat_id: chatIdStr, role: 'assistant', content: reply },
      ]);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
