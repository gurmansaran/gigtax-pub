/**
 * Language Context
 * Manages app-wide language preference (EN/ES).
 * Reads from AsyncStorage on startup, persists changes to AsyncStorage + Supabase.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTranslation, type Language } from '@/lib/translations';
import { supabase } from '@/lib/supabase';

const LANGUAGE_STORAGE_KEY = 'gigtax_language';

interface LanguageContextType {
  /** Current language, or null if not yet determined (triggers language selection) */
  language: Language | null;
  /** Whether the language preference is still loading from storage */
  isLoadingLanguage: boolean;
  /** Update the language preference (saves to AsyncStorage + Supabase) */
  setLanguage: (lang: Language) => Promise<void>;
  /** Translation helper - returns the translated string for a given key */
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: null,
  isLoadingLanguage: true,
  setLanguage: async () => {},
  t: (key: string) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(null);
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(true);

  // Load saved language preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored === 'en' || stored === 'es') {
          setLanguageState(stored);
        }
        // If no stored value, language remains null (triggers language selection screen)
      } catch (error) {
        console.error('Error loading language preference:', error);
      } finally {
        setIsLoadingLanguage(false);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);

    // Save to AsyncStorage (primary source of truth)
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (error) {
      console.error('Error saving language to AsyncStorage:', error);
    }

    // Save to Supabase (fire-and-forget for future-proofing)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ language_preference: lang })
          .eq('id', user.id);
      }
    } catch (error) {
      // Non-blocking: AsyncStorage is the primary source of truth
      console.warn('Failed to save language preference to Supabase:', error);
    }
  }, []);

  const t = useCallback((key: string): string => {
    // Default to English if language hasn't been set yet
    return getTranslation(language ?? 'en', key);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, isLoadingLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Sync language preference from Supabase profile after login.
 * Call this post-login to restore preference on new device installs.
 */
export async function syncLanguageFromProfile(userId: string): Promise<void> {
  try {
    const storedLocal = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    // Only sync from Supabase if there's no local preference
    if (storedLocal) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('language_preference')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.language_preference === 'en' || profile?.language_preference === 'es') {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, profile.language_preference);
    }
  } catch (error) {
    console.warn('Failed to sync language from profile:', error);
  }
}
