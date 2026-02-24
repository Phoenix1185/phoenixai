import React, { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ConversationSearchProps {
  onSearch: (query: string) => void;
}

const ConversationSearch: React.FC<ConversationSearchProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch(val);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className="relative px-2 mb-2">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={handleChange}
        placeholder="Search chats..."
        className="pl-8 pr-8 h-9 text-sm bg-sidebar-accent/50 border-sidebar-border"
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5"
          onClick={handleClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export default ConversationSearch;
