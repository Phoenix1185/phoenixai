import React from 'react';
import { cn } from '@/lib/utils';

interface PhoenixLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
}

const PhoenixLogo: React.FC<PhoenixLogoProps> = ({ 
  className, 
  showText = true,
  size = 'md',
  animate = false
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'relative flex items-center justify-center rounded-xl gradient-phoenix',
        animate && 'animate-float',
        sizeClasses[size]
      )}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-2/3 h-2/3 text-primary-foreground"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Phoenix bird shape */}
          <path
            d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z"
            fill="currentColor"
            className="animate-phoenix-wings"
          />
          <path
            d="M12 16C12 16 8 18 6 22M12 16C12 16 16 18 18 22"
            strokeLinecap="round"
          />
          <path
            d="M7 8C5 7 3 8 3 8C3 8 4 10 6 11"
            strokeLinecap="round"
          />
          <path
            d="M17 8C19 7 21 8 21 8C21 8 20 10 18 11"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 rounded-xl phoenix-glow opacity-50" />
      </div>
      {showText && (
        <span className={cn(
          'font-bold font-["Poppins"] phoenix-text-glow text-foreground',
          textSizeClasses[size]
        )}>
          Phoenix <span className="text-primary">AI</span>
        </span>
      )}
    </div>
  );
};

export default PhoenixLogo;
