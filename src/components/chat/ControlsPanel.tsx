import React from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ElevenLabsCallButton from './ElevenLabsCallButton';

interface ControlsPanelProps {
  onImageUpload: () => void;
  onToggleVoice: () => void;
  isListening: boolean;
  voiceInputSupported: boolean;
  disabled: boolean;
  isLoading: boolean;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({
  onImageUpload,
  onToggleVoice,
  isListening,
  voiceInputSupported,
  disabled,
  isLoading,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute bottom-full left-0 right-0 mb-2 flex items-center justify-center"
    >
      <div className="glass-card rounded-2xl p-2 flex items-center gap-2 shadow-lg border border-border/50">
        {/* Image upload */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onImageUpload}
              disabled={disabled || isLoading}
              className="h-10 w-10 rounded-xl hover:bg-accent transition-all"
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Upload image</p>
          </TooltipContent>
        </Tooltip>

        {/* ElevenLabs voice call */}
        <ElevenLabsCallButton disabled={disabled || isLoading} />

        {/* Voice input */}
        {voiceInputSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleVoice}
                disabled={disabled}
                className={cn(
                  'h-10 w-10 rounded-xl transition-all',
                  isListening && 'bg-destructive/20 text-destructive animate-pulse'
                )}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isListening ? 'Stop listening' : 'Voice input'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </motion.div>
  );
};

export default ControlsPanel;
