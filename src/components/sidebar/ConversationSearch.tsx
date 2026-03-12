import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, FileText, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ConversationSearchProps {
  onSearch: (query: string) => void;
}

interface MessageSearchResult {
  id: string;
  content: string;
  role: string;
  conversation_id: string;
  conversation_title: string;
  created_at: string;
}

const ConversationSearch: React.FC<ConversationSearchProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (!isDeepSearch) {
      onSearch(val);
      return;
    }

    // Debounced deep search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setMessageResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!user || val.trim().length < 2) return;
      setIsSearching(true);
      setShowResults(true);

      try {
        // Search across all user messages
        const { data: messages } = await supabase
          .from('messages')
          .select('id, content, role, conversation_id, created_at')
          .eq('user_id', user.id)
          .ilike('content', `%${val.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (messages && messages.length > 0) {
          // Get conversation titles for the results
          const convIds = [...new Set(messages.map(m => m.conversation_id))];
          const { data: convs } = await supabase
            .from('conversations')
            .select('id, title')
            .in('id', convIds);

          const convMap = new Map(convs?.map(c => [c.id, c.title]) || []);

          const results: MessageSearchResult[] = messages.map(m => ({
            id: m.id,
            content: m.content,
            role: m.role,
            conversation_id: m.conversation_id,
            conversation_title: convMap.get(m.conversation_id) || 'Unknown chat',
            created_at: m.created_at,
          }));

          setMessageResults(results);
        } else {
          setMessageResults([]);
        }
      } catch (error) {
        console.error('Message search error:', error);
        setMessageResults([]);
      }

      setIsSearching(false);
    }, 400);
  }, [onSearch, isDeepSearch, user]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    setMessageResults([]);
    setShowResults(false);
  }, [onSearch]);

  const toggleDeepSearch = useCallback(() => {
    setIsDeepSearch(prev => {
      const next = !prev;
      if (!next) {
        setMessageResults([]);
        setShowResults(false);
        onSearch(query);
      }
      return next;
    });
  }, [onSearch, query]);

  const handleResultClick = (conversationId: string) => {
    navigate(`/chat/${conversationId}`);
    setShowResults(false);
    setQuery('');
  };

  // Highlight matching text
  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;
    const truncated = text.length > 120 ? text.slice(0, 120) + '...' : text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = truncated.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">{part}</mark>
        : part
    );
  };

  // Close results on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative px-2 mb-2" ref={resultsRef}>
      <div className="relative flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={handleChange}
            placeholder={isDeepSearch ? 'Search messages...' : 'Search chats...'}
            className="pl-8 pr-8 h-9 text-sm bg-sidebar-accent/50 border-sidebar-border"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button
          variant={isDeepSearch ? 'secondary' : 'ghost'}
          size="icon"
          className={cn('h-9 w-9 shrink-0', isDeepSearch && 'bg-primary/20 text-primary')}
          onClick={toggleDeepSearch}
          title={isDeepSearch ? 'Search messages (deep)' : 'Search titles only'}
        >
          <FileText className="h-4 w-4" />
        </Button>
      </div>

      {/* Deep search results dropdown */}
      {showResults && isDeepSearch && (
        <div className="absolute top-full left-2 right-2 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
          {isSearching ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Searching messages...
            </div>
          ) : messageResults.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No messages found
            </div>
          ) : (
            <div className="py-1">
              {messageResults.map(result => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result.conversation_id)}
                  className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {result.conversation_title}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                      {result.role === 'user' ? 'You' : 'Phoenix'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-snug">
                    {highlightMatch(result.content, query)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConversationSearch;
