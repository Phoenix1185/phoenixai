import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import { cn } from '@/lib/utils';

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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  conversationId, 
  onConversationCreated 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (conversationId && user) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    let currentConversationId = conversationId;

    // Create new conversation if needed
    if (!currentConversationId && user) {
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

    // Add user message optimistically
    const tempUserMessage: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    // Save user message to database
    if (currentConversationId && user) {
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

    // Show typing indicator
    setIsTyping(true);

    try {
      // Call AI edge function
      const response = await supabase.functions.invoke('phoenix-chat', {
        body: {
          message: userMessage,
          conversationId: currentConversationId,
          userId: user?.id,
        },
      });

      if (response.data?.reply) {
        const assistantMessage: Message = {
          id: response.data.messageId || 'ai-' + Date.now(),
          role: 'assistant',
          content: response.data.reply,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      // Add error message
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleRating = async (messageId: string, rating: number) => {
    if (!user || messageId.startsWith('temp-') || messageId.startsWith('error-')) return;

    await supabase
      .from('messages')
      .update({ rating })
      .eq('id', messageId);

    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, rating } : m)
    );

    // Store feedback for learning
    await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        message_id: messageId,
        feedback_type: rating === 1 ? 'positive' : 'negative',
      });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-2xl gradient-phoenix flex items-center justify-center mb-6 animate-float">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-10 h-10 text-primary-foreground"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z"
                  fill="currentColor"
                />
                <path d="M12 16C12 16 8 18 6 22M12 16C12 16 16 18 18 22" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 font-['Poppins']">
              Welcome to <span className="text-primary">Phoenix AI</span>
            </h2>
            <p className="text-muted-foreground max-w-md">
              Your intelligent assistant that learns from every conversation. 
              Ask me anything, search the web, or let me help you create content.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg w-full">
              {[
                '🔍 Search the latest news',
                '📝 Help me write a blog post',
                '💡 Explain quantum computing',
                '🎨 Generate creative ideas',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion.slice(2).trim())}
                  className="p-3 rounded-xl glass-card hover:bg-accent/50 transition-colors text-sm text-left"
                >
                  {suggestion}
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
              />
            ))}
            {isTyping && <TypingIndicator />}
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
              placeholder={user ? "Ask Phoenix anything..." : "Sign in to start chatting..."}
              disabled={!user || isLoading}
              className="min-h-[56px] max-h-[200px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || !user}
              className={cn(
                'absolute right-2 bottom-2 h-10 w-10 rounded-xl transition-all',
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
          <p className="text-xs text-muted-foreground text-center mt-2">
            Phoenix AI learns from your feedback to provide better responses
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
