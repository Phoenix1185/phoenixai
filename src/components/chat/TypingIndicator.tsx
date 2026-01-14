import React from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';

interface TypingIndicatorProps {
  isSearching?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isSearching = false }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
    >
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="w-8 h-8 rounded-lg gradient-phoenix flex items-center justify-center shrink-0 shadow-lg animate-pulse-glow"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-4 h-4 text-primary-foreground animate-phoenix-wings"
        >
          <path
            d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z"
            fill="currentColor"
          />
          <path d="M12 16C12 16 8 18 6 22M12 16C12 16 16 18 18 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </motion.div>
      <div className="glass-card rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          {isSearching ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              >
                <Search className="w-4 h-4 text-primary" />
              </motion.div>
              <span className="text-sm text-muted-foreground">Searching the web for latest info...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">Phoenix is thinking</span>
            </>
          )}
          <div className="flex items-center gap-1.5">
            <motion.span 
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 rounded-full gradient-phoenix" 
            />
            <motion.span 
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 rounded-full gradient-phoenix" 
            />
            <motion.span 
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 rounded-full gradient-phoenix" 
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
