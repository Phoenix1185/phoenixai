import React from 'react';
import { cn } from '@/lib/utils';

interface PhoenixLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

const PhoenixLoader: React.FC<PhoenixLoaderProps> = ({ 
  size = 'md', 
  animate = true,
  className 
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className={cn(
      'relative flex items-center justify-center rounded-2xl gradient-phoenix',
      sizeClasses[size],
      animate && 'animate-float',
      className
    )}>
      {/* Phoenix SVG */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={cn(
          'w-2/3 h-2/3 text-primary-foreground',
          animate && 'animate-phoenix-wings'
        )}
      >
        {/* Body */}
        <path
          d="M24 4C24 4 18 12 18 20C18 28 24 32 24 32C24 32 30 28 30 20C30 12 24 4 24 4Z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* Left wing */}
        <path
          d="M14 16C10 14 6 16 6 16C6 16 8 20 12 22C14 23 16 22 18 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="currentColor"
          opacity="0.7"
        />
        {/* Right wing */}
        <path
          d="M34 16C38 14 42 16 42 16C42 16 40 20 36 22C34 23 32 22 30 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="currentColor"
          opacity="0.7"
        />
        {/* Tail feathers */}
        <path
          d="M24 32C24 32 16 36 12 44"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M24 32C24 32 32 36 36 44"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M24 32C24 32 24 38 24 44"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Eye glow */}
        <circle cx="24" cy="14" r="2" fill="currentColor" opacity="0.5" />
      </svg>
      
      {/* Glow effect */}
      {animate && (
        <div className="absolute inset-0 rounded-2xl phoenix-glow opacity-60 animate-pulse" />
      )}
    </div>
  );
};

export default PhoenixLoader;
