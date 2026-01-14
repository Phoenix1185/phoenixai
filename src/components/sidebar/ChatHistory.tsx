import React, { useEffect, useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const ChatHistory: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      fetchConversations();
    } else {
      setConversations([]);
      setLoading(false);
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setConversations(data);
    }
    setLoading(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    setConversations(prev => prev.filter(c => c.id !== id));
    
    if (location.pathname === `/chat/${id}`) {
      navigate('/');
    }
  };

  const groupedConversations = React.useMemo(() => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const thisWeek: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    conversations.forEach(conv => {
      const convDate = new Date(conv.updated_at);
      if (convDate >= todayStart) {
        today.push(conv);
      } else if (convDate >= yesterdayStart) {
        yesterday.push(conv);
      } else if (convDate >= weekStart) {
        thisWeek.push(conv);
      } else {
        older.push(conv);
      }
    });

    return { today, yesterday, thisWeek, older };
  }, [conversations]);

  if (!user) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Sign in to see your chat history
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-sidebar-accent/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    
    return (
      <div className="mb-4">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
        <SidebarMenu>
          {items.map(conv => (
            <SidebarMenuItem key={conv.id}>
              <SidebarMenuButton
                asChild
                className={cn(
                  'group relative cursor-pointer',
                  location.pathname === `/chat/${conv.id}` && 'bg-sidebar-accent'
                )}
              >
                <button
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="flex items-center gap-3 w-full"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => deleteConversation(conv.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    );
  };

  return (
    <div className="px-2">
      {renderGroup('Today', groupedConversations.today)}
      {renderGroup('Yesterday', groupedConversations.yesterday)}
      {renderGroup('This Week', groupedConversations.thisWeek)}
      {renderGroup('Older', groupedConversations.older)}
      {conversations.length === 0 && (
        <div className="p-4 text-center text-muted-foreground text-sm">
          No conversations yet
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
