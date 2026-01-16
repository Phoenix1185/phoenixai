import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ImageGenerationLoaderProps {
  className?: string;
}

const ImageGenerationLoader: React.FC<ImageGenerationLoaderProps> = ({ className }) => {
  return (
    <div className={cn('relative w-64 h-64 rounded-xl overflow-hidden', className)}>
      {/* Blurry placeholder with gradient animation */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/40"
        animate={{
          background: [
            'linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(var(--accent)/0.2), hsl(var(--primary)/0.4))',
            'linear-gradient(225deg, hsl(var(--accent)/0.3), hsl(var(--primary)/0.2), hsl(var(--accent)/0.4))',
            'linear-gradient(315deg, hsl(var(--primary)/0.3), hsl(var(--accent)/0.2), hsl(var(--primary)/0.4))',
            'linear-gradient(45deg, hsl(var(--accent)/0.3), hsl(var(--primary)/0.2), hsl(var(--accent)/0.4))',
            'linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(var(--accent)/0.2), hsl(var(--primary)/0.4))',
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ filter: 'blur(20px)' }}
      />
      
      {/* Noise overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />

      {/* Center loading indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full gradient-phoenix flex items-center justify-center shadow-lg"
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-primary-foreground">
            <path d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z" fill="currentColor" />
            <path d="M12 16C12 16 8 18 6 22M12 16C12 16 16 18 18 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.div>
        <motion.p
          className="mt-3 text-sm font-medium text-foreground/70"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Generating image...
        </motion.p>
      </div>
    </div>
  );
};

export default ImageGenerationLoader;
