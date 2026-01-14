import React, { useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rating?: number;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
  onRate: (rating: number) => void;
  isStreaming?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRate, isStreaming = false }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const isUser = message.role === 'user';

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast({
      description: 'Copied to clipboard',
      duration: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Enhanced markdown rendering
  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const firstNewline = code.indexOf('\n');
        const language = firstNewline > 0 ? code.slice(0, firstNewline) : '';
        const codeContent = firstNewline > 0 ? code.slice(firstNewline + 1) : code;
        
        return (
          <pre key={i} className="my-3 p-4 rounded-lg bg-muted overflow-x-auto border border-border">
            {language && (
              <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                {language}
              </div>
            )}
            <code className="text-sm font-mono">{codeContent}</code>
          </pre>
        );
      }
      
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part.split('\n').map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|#{1,3}\s.*)/g).map((segment, k) => {
                // Headers
                if (segment.match(/^###\s/)) {
                  return <strong key={k} className="text-base block mt-3 mb-1">{segment.slice(4)}</strong>;
                }
                if (segment.match(/^##\s/)) {
                  return <strong key={k} className="text-lg block mt-4 mb-2">{segment.slice(3)}</strong>;
                }
                if (segment.match(/^#\s/)) {
                  return <strong key={k} className="text-xl block mt-4 mb-2">{segment.slice(2)}</strong>;
                }
                // Bold
                if (segment.startsWith('**') && segment.endsWith('**')) {
                  return <strong key={k}>{segment.slice(2, -2)}</strong>;
                }
                // Italic
                if (segment.startsWith('*') && segment.endsWith('*')) {
                  return <em key={k}>{segment.slice(1, -1)}</em>;
                }
                // Inline code
                if (segment.startsWith('`') && segment.endsWith('`')) {
                  return (
                    <code key={k} className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm text-primary">
                      {segment.slice(1, -1)}
                    </code>
                  );
                }
                return segment;
              })}
            </React.Fragment>
          ))}
        </span>
      );
    });
  };

  return (
    <div
      className={cn(
        'flex gap-3 animate-fade-in',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-lg gradient-phoenix flex items-center justify-center shrink-0 shadow-lg">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn(
              'w-4 h-4 text-primary-foreground',
              isStreaming && 'animate-phoenix-wings'
            )}
          >
            <path
              d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z"
              fill="currentColor"
            />
            <path d="M12 16C12 16 8 18 6 22M12 16C12 16 16 18 18 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'gradient-phoenix text-primary-foreground'
            : 'glass-card'
        )}
      >
        <div className="text-sm leading-relaxed">
          {renderContent(message.content)}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse rounded-sm" />
          )}
        </div>

        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/30">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-accent"
              onClick={copyToClipboard}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7 hover:bg-accent', message.rating === 1 && 'text-green-500 bg-green-500/10')}
              onClick={() => onRate(1)}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7 hover:bg-accent', message.rating === -1 && 'text-destructive bg-destructive/10')}
              onClick={() => onRate(-1)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-xs font-medium">You</span>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
