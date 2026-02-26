/**
 * Theme preference context - single source of truth for light/dark/system.
 * Persists to AsyncStorage. When Profile toggles theme, root layout updates immediately.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';

const THEME_PREFERENCE_KEY = 'theme_preference';
export type ThemePreference = 'system' | 'light' | 'dark';

type ColorScheme = 'light' | 'dark';

interface ThemePreferenceContextType {
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => Promise<void>;
  colorScheme: ColorScheme;
  isDark: boolean;
  isLoading: boolean;
}

export const ThemePreferenceContext = createContext<ThemePreferenceContextType | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored && (stored === 'system' || stored === 'light' || stored === 'dark')) {
          setThemePreferenceState(stored as ThemePreference);
        }
      } catch (e) {
        console.error('Error loading theme preference:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setThemePreference = useCallback(async (p: ThemePreference) => {
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, p);
      setThemePreferenceState(p);
    } catch (e) {
      console.error('Error saving theme preference:', e);
    }
  }, []);

  const colorScheme: ColorScheme =
    themePreference === 'system' ? (systemScheme ?? 'dark') : themePreference;
  const isDark = colorScheme === 'dark';

  return (
    <ThemePreferenceContext.Provider
      value={{
        themePreference,
        setThemePreference,
        colorScheme,
        isDark,
        isLoading,
      }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }
  return ctx;
}
