import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user } = useAuth();

  // Load theme from user preferences or system
  useEffect(() => {
    const loadTheme = async () => {
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('theme')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data?.theme) {
          setTheme(data.theme as Theme);
        }
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
      }
    };

    loadTheme();
  }, [user]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = async () => {
    setIsTransitioning(true);
    
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    
    // Phoenix rise animation timing
    setTimeout(() => {
      setTheme(newTheme);
    }, 100);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);

    // Save to database if user is logged in
    if (user) {
      await supabase
        .from('user_preferences')
        .update({ theme: newTheme })
        .eq('user_id', user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
