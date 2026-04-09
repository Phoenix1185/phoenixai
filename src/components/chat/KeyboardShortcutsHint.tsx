import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const shortcuts = [
  { keys: ['Ctrl', 'Enter'], desc: 'Send message' },
  { keys: ['Shift', 'Enter'], desc: 'New line' },
  { keys: ['Esc'], desc: 'Stop generating' },
  { keys: ['Long press'], desc: 'Edit sent message' },
];

const KeyboardShortcutsHint: React.FC = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center" side="top">
        <p className="text-xs font-medium mb-2">Keyboard Shortcuts</p>
        <div className="space-y-1.5">
          {shortcuts.map(s => (
            <div key={s.desc} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default KeyboardShortcutsHint;
