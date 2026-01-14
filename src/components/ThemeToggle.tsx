import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className }) => {
  const { theme, toggleTheme, isTransitioning } = useTheme();

  return (
    <Button
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      onClick={toggleTheme}
      className={cn(
        'relative overflow-hidden',
        showLabel && 'w-full justify-start gap-3',
        className
      )}
      disabled={isTransitioning}
    >
      <div className="relative">
        <Sun
          className={cn(
            'h-5 w-5 transition-all duration-500',
            theme === 'dark' 
              ? 'rotate-90 scale-0 opacity-0' 
              : 'rotate-0 scale-100 opacity-100 text-primary'
          )}
        />
        <Moon
          className={cn(
            'absolute inset-0 h-5 w-5 transition-all duration-500',
            theme === 'dark'
              ? 'rotate-0 scale-100 opacity-100 text-primary'
              : '-rotate-90 scale-0 opacity-0'
          )}
        />
      </div>
      {showLabel && (
        <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
      )}
      
      {/* Phoenix rise overlay effect */}
      {isTransitioning && (
        <div
          className={cn(
            'absolute inset-0 animate-phoenix-rise',
            theme === 'dark' ? 'bg-background' : 'bg-card'
          )}
          style={{
            background: theme === 'light' 
              ? 'linear-gradient(to top, hsl(var(--phoenix-orange) / 0.3), transparent)'
              : 'linear-gradient(to top, hsl(var(--phoenix-gold) / 0.2), transparent)'
          }}
        />
      )}
    </Button>
  );
};

export default ThemeToggle;
