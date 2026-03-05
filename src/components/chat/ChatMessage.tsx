import React, { useState, useRef, useCallback } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Check, Volume2, VolumeX, Download, ZoomIn, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ImageViewer from './ImageViewer';
import FeedbackModal from './FeedbackModal';
import { Textarea } from '@/components/ui/textarea';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rating?: number;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
  onRate: (rating: number, feedbackText?: string) => void;
  onSpeak?: (content: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  isSpeaking?: boolean;
  isStreaming?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onRate, 
  onSpeak,
  onEdit,
  isSpeaking = false,
  isStreaming = false 
}) => {
  const [copied, setCopied] = useState(false);
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showEditPopup, setShowEditPopup] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const isUser = message.role === 'user';

  // Long press handlers for user messages
  const handlePointerDown = useCallback(() => {
    if (!isUser || !onEdit || isStreaming || message.id.startsWith('temp-')) return;
    longPressTimer.current = setTimeout(() => {
      setShowEditPopup(true);
    }, 500);
  }, [isUser, onEdit, isStreaming, message.id]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startEditing = () => {
    setEditContent(message.content.replace(/\n\n!\[.*\]\(data:image[^)]+\)/g, ''));
    setIsEditing(true);
    setShowEditPopup(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast({
      description: 'Copied to clipboard',
      duration: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleThumbsDown = () => {
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = (feedbackType: string, feedbackText: string) => {
    onRate(-1, feedbackText);
    toast({
      description: 'Thank you for your feedback! Phoenix will learn from this.',
      duration: 3000,
    });
  };

  const renderInlineFormatting = (text: string) => {
    return text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|#{1,3}\s.*|\[.*?\]\(.*?\))/g).map((segment, k) => {
      if (segment.match(/^###\s/)) {
        return <strong key={k} className="text-base block mt-3 mb-1">{segment.slice(4)}</strong>;
      }
      if (segment.match(/^##\s/)) {
        return <strong key={k} className="text-lg block mt-4 mb-2">{segment.slice(3)}</strong>;
      }
      if (segment.match(/^#\s/)) {
        return <strong key={k} className="text-xl block mt-4 mb-2">{segment.slice(2)}</strong>;
      }
      const linkMatch = segment.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        return (
          <a 
            key={k} 
            href={linkMatch[2]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            {linkMatch[1]}
            <span className="text-xs">↗</span>
          </a>
        );
      }
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={k}>{segment.slice(2, -2)}</strong>;
      }
      if (segment.startsWith('*') && segment.endsWith('*')) {
        return <em key={k}>{segment.slice(1, -1)}</em>;
      }
      if (segment.startsWith('`') && segment.endsWith('`')) {
        return (
          <code key={k} className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm text-primary">
            {segment.slice(1, -1)}
          </code>
        );
      }
      return segment;
    });
  };

  const renderTextContent = (content: string) => {
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
          {part.split('\n').map((line, j) => {
            if (line.match(/^[-*•]\s/)) {
              return (
                <React.Fragment key={j}>
                  {j > 0 && <br />}
                  <span className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{renderInlineFormatting(line.replace(/^[-*•]\s/, ''))}</span>
                  </span>
                </React.Fragment>
              );
            }
            
            if (line.match(/^\d+\.\s/)) {
              const match = line.match(/^(\d+)\.\s(.*)$/);
              if (match) {
                return (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    <span className="flex items-start gap-2">
                      <span className="text-primary font-medium">{match[1]}.</span>
                      <span>{renderInlineFormatting(match[2])}</span>
                    </span>
                  </React.Fragment>
                );
              }
            }
            
            return (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {renderInlineFormatting(line)}
              </React.Fragment>
            );
          })}
        </span>
      );
    });
  };

  const handleDownload = (src: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `phoenix-image-${Date.now()}.png`;
    link.click();
    toast({ description: 'Image downloading...', duration: 2000 });
  };

  const renderContent = (content: string) => {
    const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^\)]+|https?:\/\/[^\)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{renderTextContent(content.slice(lastIndex, match.index))}</span>);
      }
      
      const alt = match[1] || 'Generated Image';
      const src = match[2];
      
      parts.push(
        <motion.div 
          key={`img-${match.index}`} 
          className="my-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative group rounded-xl overflow-hidden shadow-lg border border-border/50">
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full max-h-[400px] object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
              onClick={() => setViewerImage({ src, alt })}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-end gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                      onClick={(e) => { e.stopPropagation(); setViewerImage({ src, alt }); }}
                    >
                      <ZoomIn className="h-4 w-4 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon"
                      className="h-8 w-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                      onClick={(e) => { e.stopPropagation(); handleDownload(src); }}
                    >
                      <Download className="h-4 w-4 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center italic">{alt}</p>
        </motion.div>
      );
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < content.length) {
      parts.push(<span key="text-end">{renderTextContent(content.slice(lastIndex))}</span>);
    }
    
    return parts.length > 0 ? parts : renderTextContent(content);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} className={cn('flex gap-3 relative', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <motion.div animate={isStreaming ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}} transition={{ duration: 1.5, repeat: isStreaming ? Infinity : 0 }} className="w-8 h-8 rounded-lg gradient-phoenix flex items-center justify-center shrink-0 shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4 text-primary-foreground', isStreaming && 'animate-phoenix-wings')}>
            <path d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z" fill="currentColor" />
            <path d="M12 16C12 16 8 18 6 22M12 16C12 16 16 18 18 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.div>
      )}

      <motion.div 
        layout 
        className={cn('max-w-[80%] rounded-2xl px-4 py-3 shadow-sm relative select-none', isUser ? 'gradient-phoenix text-primary-foreground' : 'glass-card hover-lift')}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => {
          if (isUser && onEdit && !isStreaming && !message.id.startsWith('temp-')) {
            e.preventDefault();
            setShowEditPopup(true);
          }
        }}
      >
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] text-sm bg-background/20 border-primary-foreground/30 text-inherit"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">Cancel</Button>
              <Button size="sm" onClick={() => {
                if (editContent.trim() && onEdit) {
                  onEdit(message.id, editContent.trim());
                  setIsEditing(false);
                }
              }} className="h-7 text-xs bg-background/20 hover:bg-background/30">Resend</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed">
            {renderContent(message.content)}
            {isStreaming && <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block w-2 h-5 bg-primary ml-1 rounded-sm" />}
          </div>
        )}

        {/* Long-press edit popup for user messages */}
        <AnimatePresence>
          {showEditPopup && isUser && (
            <>
              {/* Backdrop to close popup */}
              <div className="fixed inset-0 z-40" onClick={() => setShowEditPopup(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 5 }}
                transition={{ duration: 0.15 }}
                className="absolute -top-10 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg px-1 py-1"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5 text-popover-foreground"
                  onClick={startEditing}
                >
                  <Pencil className="h-3 w-3" />
                  Edit & Resend
                </Button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {!isUser && !isStreaming && message.content && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center gap-1 mt-3 pt-2 border-t border-border/30">
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-accent hover-scale" onClick={copyToClipboard}>{copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}</Button></TooltipTrigger><TooltipContent>Copy</TooltipContent></Tooltip>
            {onSpeak && (<Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn('h-7 w-7 hover:bg-accent hover-scale', isSpeaking && 'text-primary bg-primary/10')} onClick={() => onSpeak(message.content)}>{isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}</Button></TooltipTrigger><TooltipContent>{isSpeaking ? 'Stop' : 'Read aloud'}</TooltipContent></Tooltip>)}
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn('h-7 w-7 hover:bg-accent hover-scale', message.rating === 1 && 'text-green-500 bg-green-500/10')} onClick={() => onRate(1)}><ThumbsUp className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Good response</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn('h-7 w-7 hover:bg-accent hover-scale', message.rating === -1 && 'text-destructive bg-destructive/10')} onClick={handleThumbsDown}><ThumbsDown className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Poor response</TooltipContent></Tooltip>
          </motion.div>
        )}
      </motion.div>

      {isUser && <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-sm"><span className="text-xs font-medium">You</span></div>}
      
      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          alt={viewerImage.alt}
          isOpen={!!viewerImage}
          onClose={() => setViewerImage(null)}
        />
      )}
      
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </motion.div>
  );
};

export default ChatMessage;
