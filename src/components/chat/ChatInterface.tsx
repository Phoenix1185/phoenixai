import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import PhoenixLoader from './PhoenixLoader';
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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  conversationId, 
  onConversationCreated 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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

  const streamChat = useCallback(async (
    chatMessages: { role: string; content: string }[],
    onDelta: (deltaText: string) => void,
    onDone: (fullText: string) => void
  ) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ 
        messages: chatMessages,
        userId: user?.id,
        conversationId 
      }),
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
  }, [user?.id, conversationId, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    // Stop voice input if active
    if (isListening) {
      stopListening();
    }

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    let currentConversationId = conversationId;

    // Create new conversation if needed
    if (!currentConversationId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
        })
        .select()
        .single();

      if (newConv) {
        currentConversationId = newConv.id;
        onConversationCreated?.(newConv.id);
      }
    }

    // Add user message
    const tempUserMessage: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: userMessage,
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
          content: userMessage,
        })
        .select()
        .single();

      if (savedUserMsg) {
        setMessages(prev => 
          prev.map(m => m.id === tempUserMessage.id ? savedUserMsg as Message : m)
        );
      }
    }

    // Start streaming
    setIsStreaming(true);
    let assistantContent = '';

    const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: 'user', content: userMessage });

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
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

          // Auto-speak if enabled
          if (autoSpeak && voiceOutputSupported && fullText) {
            // Strip markdown for speech
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
        }
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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter key should NOT send - only Ctrl+Enter or Cmd+Enter sends
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

  const examplePrompts = [
    { icon: '🔍', text: 'What are the latest news in AI?', label: 'Latest AI news' },
    { icon: '📖', text: 'Summarize this article for me', label: 'Summarize content' },
    { icon: '📝', text: 'Write a blog post about productivity', label: 'Write a blog post' },
    { icon: '💡', text: 'Give me startup ideas for 2025', label: 'Generate ideas' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <PhoenixLoader size="lg" animate={false} />
            <h2 className="text-2xl font-bold mb-2 font-['Poppins'] mt-6">
              Welcome to <span className="text-primary">Phoenix AI</span>
            </h2>
            <p className="text-muted-foreground max-w-md mb-2">
              Your intelligent assistant with live web search. Just ask naturally – 
              no commands needed!
            </p>
            <p className="text-xs text-muted-foreground mb-8">
              Created by <span className="text-primary">IYANU</span> & Phoenix Team
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {examplePrompts.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => setInput(cmd.text)}
                  className="p-4 rounded-xl glass-card hover:bg-accent/50 transition-all hover:scale-[1.02] text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cmd.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{cmd.label}</p>
                      <p className="text-xs text-muted-foreground">{cmd.text}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
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
            {isLoading && !isStreaming && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative glass-card rounded-2xl">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={user ? "Ask Phoenix anything... (Ctrl+Enter to send)" : "Sign in to start chatting..."}
              disabled={!user || isLoading}
              className="min-h-[56px] max-h-[200px] resize-none border-0 bg-transparent pr-28 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* ElevenLabs voice call (agent) */}
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
                disabled={!input.trim() || isLoading || !user}
                className={cn(
                  'h-10 w-10 rounded-xl transition-all',
                  input.trim() ? 'gradient-phoenix text-primary-foreground' : 'bg-muted'
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
            <Sparkles className="h-3 w-3 text-primary" />
            <p className="text-xs text-muted-foreground">
              Phoenix AI with live web search • {voiceInputSupported ? 'Voice enabled' : 'Voice not supported'}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
