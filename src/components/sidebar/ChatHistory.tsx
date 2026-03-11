import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Trash2, Download, Share2, Pin, PinOff } from 'lucide-react';
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
import ConversationSearch from './ConversationSearch';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
}

const ChatHistory: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [exportTarget, setExportTarget] = useState<Conversation | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

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

  const confirmDelete = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(conv);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);

    await supabase.from('conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));

    if (location.pathname === `/chat/${id}`) {
      navigate('/');
    }
  };

  const handleExportClick = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportTarget(conv);
  };

  const handleExportConfirm = async () => {
    if (!exportTarget || !user) return;
    const conv = exportTarget;
    setExportTarget(null);

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      toast({ description: 'No messages to export.', duration: 2000 });
      return;
    }

    let md = `# ${conv.title}\n\n_Exported on ${new Date().toLocaleDateString()}_\n\n---\n\n`;
    for (const msg of messages) {
      const role = msg.role === 'user' ? '**You**' : '**Phoenix AI**';
      const time = new Date(msg.created_at).toLocaleTimeString();
      const content = msg.content.replace(/!\[[^\]]*\]\(data:image[^)]+\)/g, '[image]');
      md += `${role} _(${time})_\n\n${content}\n\n---\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ description: 'Chat exported as Markdown.', duration: 2000 });
  };

  const handleShare = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    // Generate slug if not exists
    const slug = conv.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) + '-' + conv.id.slice(0, 8);

    const { error } = await supabase
      .from('conversations')
      .update({ is_shared: true, slug } as any)
      .eq('id', conv.id);

    if (error) {
      toast({ variant: 'destructive', description: 'Failed to share chat.' });
      return;
    }

    const shareUrl = `${window.location.origin}/s/${slug}`;
    await navigator.clipboard.writeText(shareUrl);
    toast({ description: 'Share link copied to clipboard!', duration: 3000 });
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredConversations = searchQuery
    ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  const groupedConversations = React.useMemo(() => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const thisWeek: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    filteredConversations.forEach(conv => {
      const convDate = new Date(conv.updated_at);
      if (convDate >= todayStart) today.push(conv);
      else if (convDate >= yesterdayStart) yesterday.push(conv);
      else if (convDate >= weekStart) thisWeek.push(conv);
      else older.push(conv);
    });

    return { today, yesterday, thisWeek, older };
  }, [filteredConversations]);

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
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleShare(conv, e)}>
                       <Share2 className="h-3 w-3 text-muted-foreground" />
                     </Button>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleExportClick(conv, e)}>
                       <Download className="h-3 w-3 text-muted-foreground" />
                     </Button>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => confirmDelete(conv, e)}>
                       <Trash2 className="h-3 w-3 text-destructive" />
                     </Button>
                   </div>
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
      <ConversationSearch onSearch={handleSearch} />
      {renderGroup('Today', groupedConversations.today)}
      {renderGroup('Yesterday', groupedConversations.yesterday)}
      {renderGroup('This Week', groupedConversations.thisWeek)}
      {renderGroup('Older', groupedConversations.older)}
      {filteredConversations.length === 0 && (
        <div className="p-4 text-center text-muted-foreground text-sm">
          {searchQuery ? 'No matching conversations' : 'No conversations yet'}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.title}
      />

      <AlertDialog open={!!exportTarget} onOpenChange={(open) => !open && setExportTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Download "{exportTarget?.title}" as a Markdown file?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExportConfirm}>Download</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatHistory;
