import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, Mic, MicOff, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import StreamingIndicator from './StreamingIndicator';
import QuickActions from './QuickActions';
import PhoenixLoader from './PhoenixLoader';
import PhoenixBootAnimation from './PhoenixBootAnimation';
import ImageGenerationLoader from './ImageGenerationLoader';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ElevenLabsCallButton from './ElevenLabsCallButton';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rating?: number;
  created_at: string;
}

interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phoenix-chat`;
const MAX_CONTEXT_MESSAGES = 15; // Limit context to prevent confusion

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  conversationId, 
  onConversationCreated 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ file: File; preview: string } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showBootAnimation, setShowBootAnimation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Get display name from user metadata
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  // Voice hooks
  const { 
    isListening, 
    isSupported: voiceInputSupported, 
    startListening, 
    stopListening 
  } = useVoiceInput({
    onResult: (transcript) => {
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    },
    onError: (error) => {
      toast({ variant: 'destructive', description: error });
    },
  });

  const { 
    isSpeaking, 
    isSupported: voiceOutputSupported, 
    speak, 
    stop: stopSpeaking 
  } = useVoiceOutput();

  useEffect(() => {
    if (conversationId && user) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const fetchMessages = async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as Message[]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const streamChat = useCallback(async (
    chatMessages: { role: string; content: string | any[] }[],
    onDelta: (deltaText: string) => void,
    onDone: (fullText: string) => void,
    imageUrl?: string,
    imagePrompt?: string
  ) => {
    const body: any = { 
      messages: chatMessages,
      userId: user?.id,
      conversationId,
      userName: displayName,
    };

    if (imageUrl) {
      body.imageUrl = imageUrl;
      body.imagePrompt = imagePrompt;
    }

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 429) {
        toast({ variant: 'destructive', description: 'Rate limit exceeded. Please wait a moment.' });
      } else if (resp.status === 402) {
        toast({ variant: 'destructive', description: 'AI credits depleted. Please add credits.' });
      }
      throw new Error(errorData.error || 'Failed to start stream');
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let fullContent = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            onDelta(content);
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            onDelta(content);
          }
        } catch { /* ignore */ }
      }
    }

    onDone(fullContent);
  }, [user?.id, conversationId, toast, displayName]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', description: 'Please upload an image file.' });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'Image must be under 10MB.' });
      return;
    }

    const preview = URL.createObjectURL(file);
    setUploadedImage({ file, preview });
    
    // Focus textarea so user can add a prompt
    textareaRef.current?.focus();
  };

  const removeUploadedImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage.preview);
      setUploadedImage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !uploadedImage) || isLoading || !user) return;

    // Stop voice input if active
    if (isListening) {
      stopListening();
    }

    const userMessage = input.trim();
    const hasImage = !!uploadedImage;
    let imageBase64: string | undefined;

    if (uploadedImage) {
      imageBase64 = await fileToBase64(uploadedImage.file);
    }

    setInput('');
    removeUploadedImage();
    setIsLoading(true);

    let currentConversationId = conversationId;

    // Create new conversation if needed
    if (!currentConversationId) {
      const title = userMessage || (hasImage ? 'Image conversation' : 'New chat');
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: title.slice(0, 50) + (title.length > 50 ? '...' : ''),
        })
        .select()
        .single();

      if (newConv) {
        currentConversationId = newConv.id;
        onConversationCreated?.(newConv.id);
      }
    }

    // Create display message with image if present
    let displayContent = userMessage;
    if (hasImage && imageBase64) {
      // Include the image in the message content so it shows in chat
      const imageMarkdown = `\n\n![Uploaded Image](${imageBase64})`;
      displayContent = `${userMessage || 'Sent an image'}${imageMarkdown}`;
    }

    // Add user message
    const tempUserMessage: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    // Save user message to database
    if (currentConversationId) {
      const { data: savedUserMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversationId,
          user_id: user.id,
          role: 'user',
          content: displayContent,
        })
        .select()
        .single();

      if (savedUserMsg) {
        setMessages(prev => 
          prev.map(m => m.id === tempUserMessage.id ? savedUserMsg as Message : m)
        );
      }
    }

    // Check if this looks like an image generation request
    const isImageGenRequest = /generate|create|make|draw|design|paint|imagine|visualize|illustrate/i.test(userMessage) &&
      /image|picture|photo|art|artwork|illustration|graphic|logo|banner/i.test(userMessage);

    // Show boot animation for first message in conversation
    if (messages.length === 0 && !showBootAnimation) {
      setShowBootAnimation(true);
    }

    // Start streaming - show image generation loader if needed
    setIsStreaming(true);
    if (isImageGenRequest) {
      setIsGeneratingImage(true);
    }
    let assistantContent = '';

    // Limit context to last N messages to prevent confusion
    const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
    const chatHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: 'user', content: userMessage || 'Please analyze this image.' });

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      // Once we get content, hide the image generation loader
      if (assistantContent.length > 0) {
        setIsGeneratingImage(false);
      }
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id.startsWith('stream-')) {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: 'stream-' + Date.now(),
          role: 'assistant' as const,
          content: assistantContent,
          created_at: new Date().toISOString(),
        }];
      });
    };

    try {
      await streamChat(
        chatHistory,
        updateAssistant,
        async (fullText: string) => {
          setIsStreaming(false);
          setIsLoading(false);
          setIsGeneratingImage(false);
          setShowBootAnimation(false);
          // Auto-speak if enabled
          if (autoSpeak && voiceOutputSupported && fullText) {
            const plainText = fullText
              .replace(/```[\s\S]*?```/g, 'code block')
              .replace(/[*_`#]/g, '')
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            speak(plainText);
          }

          // Save assistant message to database
          if (currentConversationId && fullText) {
            const { data: savedAssistantMsg } = await supabase
              .from('messages')
              .insert({
                conversation_id: currentConversationId,
                user_id: user.id,
                role: 'assistant',
                content: fullText,
              })
              .select()
              .single();

            if (savedAssistantMsg) {
              setMessages(prev =>
                prev.map(m => m.id.startsWith('stream-') ? savedAssistantMsg as Message : m)
              );
            }

            // Update conversation timestamp
            await supabase
              .from('conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', currentConversationId);
          }
        },
        imageBase64,
        userMessage
      );
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      }]);
      setIsStreaming(false);
      setIsLoading(false);
      setIsGeneratingImage(false);
      setShowBootAnimation(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleRating = async (messageId: string, rating: number) => {
    if (!user || messageId.startsWith('temp-') || messageId.startsWith('error-') || messageId.startsWith('stream-')) return;

    await supabase
      .from('messages')
      .update({ rating })
      .eq('id', messageId);

    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, rating } : m)
    );

    await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        message_id: messageId,
        feedback_type: rating === 1 ? 'positive' : 'negative',
      });
  };

  const handleSpeakMessage = (content: string) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      const plainText = content
        .replace(/```[\s\S]*?```/g, 'code block')
        .replace(/[*_`#]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      speak(plainText);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages area - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-4">
            <PhoenixLoader size="lg" animate={false} />
            <h2 className="text-2xl font-bold mb-2 font-['Poppins'] mt-6">
              Welcome{displayName !== 'User' ? `, ${displayName}` : ''} to <span className="text-primary">Phoenix AI</span>
            </h2>
            <p className="text-muted-foreground max-w-md mb-2">
              Your intelligent assistant with live web search. Just ask naturally – 
              no commands needed!
            </p>
            <p className="text-xs text-muted-foreground mb-8">
              Created by <span className="text-primary">IYANU</span> & Phoenix Team
            </p>
            
            <QuickActions onSelect={handleQuickAction} />
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Boot animation for first message */}
            {showBootAnimation && messages.length === 1 && (
              <PhoenixBootAnimation 
                userName={displayName !== 'User' ? displayName : undefined}
                onComplete={() => setShowBootAnimation(false)}
              />
            )}
            
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onRate={(rating) => handleRating(message.id, rating)}
                onSpeak={voiceOutputSupported ? handleSpeakMessage : undefined}
                isSpeaking={isSpeaking}
                isStreaming={isStreaming && message.id.startsWith('stream-')}
              />
            ))}
            
            {/* Image generation loader */}
            {isGeneratingImage && (
              <div className="flex justify-start gap-3">
                <div className="w-8 h-8 rounded-lg gradient-phoenix flex items-center justify-center shrink-0 shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary-foreground animate-pulse">
                    <path d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z" fill="currentColor" />
                  </svg>
                </div>
                <ImageGenerationLoader />
              </div>
            )}
            
            {isLoading && !isStreaming && !isGeneratingImage && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area - FIXED at bottom */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* Image preview */}
          {uploadedImage && (
            <div className="relative inline-block mb-3">
              <img 
                src={uploadedImage.preview} 
                alt="Upload preview" 
                className="h-20 w-20 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={removeUploadedImage}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/80 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="relative glass-card rounded-2xl">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={user ? (uploadedImage ? "Describe what to do with this image..." : "Ask Phoenix anything... (Ctrl+Enter to send)") : "Sign in to start chatting..."}
              disabled={!user || isLoading}
              className="min-h-[56px] max-h-[200px] resize-none border-0 bg-transparent pr-36 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* Image upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!user || isLoading}
                    className="h-10 w-10 rounded-xl transition-all"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Upload image</p>
                </TooltipContent>
              </Tooltip>

              {/* ElevenLabs voice call */}
              <ElevenLabsCallButton disabled={!user || isLoading} />

              {voiceInputSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={toggleVoiceInput}
                      disabled={!user}
                      className={cn(
                        'h-10 w-10 rounded-xl transition-all',
                        isListening && 'bg-destructive/20 text-destructive animate-pulse'
                      )}
                    >
                      {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isListening ? 'Stop listening' : 'Voice input'}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && !uploadedImage) || isLoading || !user}
                className={cn(
                  'h-10 w-10 rounded-xl transition-all',
                  (input.trim() || uploadedImage) ? 'gradient-phoenix text-primary-foreground' : 'bg-muted'
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            {isStreaming ? (
              <StreamingIndicator text="Phoenix is typing..." />
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Phoenix AI with live web search • {voiceInputSupported ? 'Voice enabled' : 'Voice not supported'} • Image upload ready
                </p>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
