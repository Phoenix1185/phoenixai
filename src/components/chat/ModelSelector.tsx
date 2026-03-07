import React from 'react';
import { Zap, Brain, Sparkles, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ModelSpeed = 'auto' | 'fast' | 'balanced' | 'powerful';

interface ModelSelectorProps {
  value: ModelSpeed;
  onChange: (value: ModelSpeed) => void;
  disabled?: boolean;
}

const modelOptions: { value: ModelSpeed; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Smart routing by complexity',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: 'fast',
    label: 'Fast',
    description: 'Gemini 3 Flash Lite — instant',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Good speed & quality',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: 'powerful',
    label: 'Powerful',
    description: 'Best quality, complex tasks',
    icon: <Brain className="h-4 w-4" />,
  },
];

const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, disabled }) => {
  const selected = modelOptions.find(o => o.value === value) || modelOptions[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
        >
          {selected.icon}
          <span className="hidden sm:inline">{selected.label}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-52">
        <DropdownMenuLabel className="text-xs">Response Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modelOptions.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn('gap-2 cursor-pointer', value === option.value && 'bg-accent')}
          >
            {option.icon}
            <div className="flex flex-col">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModelSelector;
