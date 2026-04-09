import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToBottomProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ScrollToBottom: React.FC<ScrollToBottomProps> = ({ scrollContainerRef }) => {
  const [visible, setVisible] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setVisible(distFromBottom > 200);
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll, scrollContainerRef]);

  const scrollDown = () => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  if (!visible) return null;

  return (
    <Button
      onClick={scrollDown}
      size="icon"
      className={cn(
        'fixed bottom-28 right-6 z-40 h-10 w-10 rounded-full shadow-lg',
        'gradient-phoenix text-primary-foreground',
        'animate-in fade-in slide-in-from-bottom-4'
      )}
    >
      <ArrowDown className="h-5 w-5" />
    </Button>
  );
};

export default ScrollToBottom;
