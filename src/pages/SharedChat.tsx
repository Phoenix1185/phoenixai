import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from '@/components/chat/ChatMessage';
import PhoenixLogo from '@/components/PhoenixLogo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Check, MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/auth/AuthModal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rating?: number;
  created_at: string;
}

const SharedChat: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [forking, setForking] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (slug) fetchSharedChat();
  }, [slug]);

  const fetchSharedChat = async () => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, title, is_shared')
      .eq('slug', slug)
      .eq('is_shared', true)
      .maybeSingle();

    if (!conv) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setTitle(conv.title);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    if (msgs) setMessages(msgs as Message[]);
    setLoading(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({ description: 'Link copied!', duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const continueConversation = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setForking(true);
    try {
      // Create a new conversation for this user with context about the fork
      const newTitle = `Continued: ${title}`.slice(0, 50);
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: newTitle,
        })
        .select()
        .single();

      if (convError || !newConv) {
        toast({ variant: 'destructive', description: 'Failed to create conversation.' });
        return;
      }

      // Copy all messages into the new conversation so AI has full context
      const messagesToInsert = messages.map((msg) => ({
        conversation_id: newConv.id,
        user_id: user.id,
        role: msg.role,
        content: msg.content,
      }));

      if (messagesToInsert.length > 0) {
        const { error: msgError } = await supabase
          .from('messages')
          .insert(messagesToInsert);

        if (msgError) {
          toast({ variant: 'destructive', description: 'Failed to copy messages.' });
          return;
        }
      }

      // Add a system-context message so the AI knows this is a continued conversation
      await supabase.from('messages').insert({
        conversation_id: newConv.id,
        user_id: user.id,
        role: 'assistant',
        content: `👋 Welcome! You're continuing a shared conversation about "${title}". I have the full context of what was discussed above. Feel free to pick up where things left off or ask me anything new! 🔥`,
      });

      toast({ description: 'Conversation forked! You can continue chatting.' });
      navigate(`/chat/${newConv.id}`);
    } catch {
      toast({ variant: 'destructive', description: 'Something went wrong.' });
    } finally {
      setForking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading shared chat...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <PhoenixLogo size="lg" />
        <h1 className="text-2xl font-bold">Chat Not Found</h1>
        <p className="text-muted-foreground">This shared chat doesn't exist or is no longer public.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PhoenixLogo size="sm" />
          <span className="text-sm font-medium truncate max-w-[200px]">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground mt-1">Shared Phoenix AI conversation</p>
          </div>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onRate={() => {}}
            />
          ))}
        </div>
      </main>

      {/* Sticky continue button */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={continueConversation}
            disabled={forking}
            className="w-full gradient-phoenix text-primary-foreground"
            size="lg"
          >
            <MessageSquarePlus className="h-5 w-5 mr-2" />
            {forking ? 'Creating your copy...' : 'Continue this conversation'}
          </Button>
          {!user && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              You'll need to sign in to continue this conversation
            </p>
          )}
        </div>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
};

export default SharedChat;
