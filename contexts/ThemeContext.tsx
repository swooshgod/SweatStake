import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors, Shadow, ShadowLight } from '@/constants/theme';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  Colors: typeof LightColors;
  Shadow: typeof Shadow;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  Colors: LightColors,
  Shadow: ShadowLight,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false); // Default light mode

  useEffect(() => {
    AsyncStorage.getItem('podium_theme').then((saved) => {
      if (saved !== null) setIsDark(saved === 'dark');
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem('podium_theme', next ? 'dark' : 'light');
  };

  const value: ThemeContextType = {
    isDark,
    toggleTheme,
    Colors: isDark ? DarkColors : LightColors,
    Shadow: isDark ? Shadow : ShadowLight,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
