import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VoiceButtonProps {
  type: 'input' | 'output';
  isActive: boolean;
  isSupported: boolean;
  onClick: () => void;
  isLoading?: boolean;
  className?: string;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({
  type,
  isActive,
  isSupported,
  onClick,
  isLoading = false,
  className,
}) => {
  if (!isSupported) return null;

  const inputIcons = {
    active: <Loader2 className="h-5 w-5 animate-spin" />,
    inactive: <Mic className="h-5 w-5" />,
    listening: <MicOff className="h-5 w-5" />,
  };

  const outputIcons = {
    active: <VolumeX className="h-5 w-5" />,
    inactive: <Volume2 className="h-5 w-5" />,
  };

  const getIcon = () => {
    if (type === 'input') {
      if (isLoading) return inputIcons.active;
      return isActive ? inputIcons.listening : inputIcons.inactive;
    }
    return isActive ? outputIcons.active : outputIcons.inactive;
  };

  const getTooltip = () => {
    if (type === 'input') {
      return isActive ? 'Stop listening' : 'Voice input';
    }
    return isActive ? 'Stop speaking' : 'Read aloud';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            'h-10 w-10 rounded-xl transition-all',
            isActive && type === 'input' && 'bg-destructive/20 text-destructive animate-pulse',
            isActive && type === 'output' && 'bg-primary/20 text-primary',
            className
          )}
        >
          {getIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltip()}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default VoiceButton;
