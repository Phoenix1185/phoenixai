import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PhoenixBootAnimationProps {
  onComplete: () => void;
  userName?: string;
  className?: string;
}

const bootMessages = [
  'Initializing Phoenix AI...',
  'Loading neural pathways...',
  'Connecting to knowledge base...',
  'Activating web search...',
  'Rising from the ashes...',
];

const PhoenixBootAnimation: React.FC<PhoenixBootAnimationProps> = ({ 
  onComplete, 
  userName,
  className 
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex(prev => {
        if (prev >= bootMessages.length - 1) {
          clearInterval(interval);
          setTimeout(() => {
            setIsComplete(true);
            setTimeout(onComplete, 500);
          }, 800);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            'flex flex-col items-center justify-center py-8',
            className
          )}
        >
          {/* Phoenix rising animation */}
          <motion.div
            className="relative w-32 h-32 mb-6"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Fire/flames effect */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary)/0.3) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />

            {/* Phoenix body */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{
                y: [0, -10, 0],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="w-24 h-24 rounded-2xl gradient-phoenix flex items-center justify-center shadow-xl">
                <motion.svg
                  viewBox="0 0 48 48"
                  fill="none"
                  className="w-14 h-14 text-primary-foreground"
                  animate={{ 
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {/* Body */}
                  <path
                    d="M24 4C24 4 18 12 18 20C18 28 24 32 24 32C24 32 30 28 30 20C30 12 24 4 24 4Z"
                    fill="currentColor"
                  />
                  {/* Wings */}
                  <motion.g
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ transformOrigin: 'center' }}
                  >
                    <path
                      d="M14 16C10 14 6 16 6 16C6 16 8 20 12 22C14 23 16 22 18 20"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="currentColor"
                      opacity="0.8"
                    />
                    <path
                      d="M34 16C38 14 42 16 42 16C42 16 40 20 36 22C34 23 32 22 30 20"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="currentColor"
                      opacity="0.8"
                    />
                  </motion.g>
                  {/* Tail feathers */}
                  <path d="M24 32C24 32 16 36 12 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M24 32C24 32 32 36 36 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M24 32C24 32 24 38 24 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </motion.svg>
              </div>
            </motion.div>

            {/* Rising particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary/60"
                style={{
                  left: `${30 + Math.random() * 40}%`,
                  bottom: 0,
                }}
                animate={{
                  y: [-20, -100],
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>

          {/* Boot messages */}
          <div className="h-8 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm font-medium text-primary"
              >
                {bootMessages[currentMessageIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="w-48 h-1 bg-muted rounded-full mt-4 overflow-hidden">
            <motion.div
              className="h-full gradient-phoenix"
              initial={{ width: 0 }}
              animate={{ width: `${((currentMessageIndex + 1) / bootMessages.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {userName && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-4 text-muted-foreground text-sm"
            >
              Welcome back, {userName}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PhoenixBootAnimation;
