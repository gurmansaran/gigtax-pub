/**
 * Robinhood Theme Hook
 * Uses ThemePreferenceContext when available (instant theme updates).
 * Falls back to local state + AsyncStorage when outside provider.
 */

import { useContext } from 'react';
import { Colors, type ColorScheme, type ThemeColors } from '@/constants/Colors';
import {
  ThemePreferenceContext,
  type ThemePreference,
} from '@/lib/ThemePreferenceContext';

export type { ThemePreference, ThemeColors };

export function useRobinhoodTheme() {
  const ctx = useContext(ThemePreferenceContext);

  if (ctx) {
    return {
      colors: Colors[ctx.colorScheme] as ThemeColors,
      colorScheme: ctx.colorScheme,
      themePreference: ctx.themePreference,
      isDark: ctx.isDark,
      isLight: !ctx.isDark,
      isLoading: ctx.isLoading,
      setThemePreference: ctx.setThemePreference,
    };
  }

  // Fallback when outside ThemePreferenceProvider (e.g. tests)
  return {
    colors: Colors.dark as ThemeColors,
    colorScheme: 'dark' as ColorScheme,
    themePreference: 'dark' as ThemePreference,
    isDark: true,
    isLight: false,
    isLoading: false,
    setThemePreference: async () => {},
  };
}
