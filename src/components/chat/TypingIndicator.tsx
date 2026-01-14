import React from 'react';
import PhoenixLoader from './PhoenixLoader';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-lg gradient-phoenix flex items-center justify-center shrink-0 shadow-lg">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-4 h-4 text-primary-foreground animate-phoenix-wings"
        >
          <path
            d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="glass-card rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Phoenix is thinking</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full gradient-phoenix animate-typing-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full gradient-phoenix animate-typing-pulse" style={{ animationDelay: '200ms' }} />
            <span className="w-2 h-2 rounded-full gradient-phoenix animate-typing-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
