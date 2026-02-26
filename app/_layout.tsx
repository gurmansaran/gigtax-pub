/**
 * Root Layout
 * Handles navigation, theme, language, and context providers.
 * Shows a loading gate while language preference loads from AsyncStorage.
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, RevenueCatProvider, OnboardingProvider, TaxProfileProvider } from '@/lib/CtxProvider';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/ThemePreferenceContext';
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext';
import { Colors } from '@/constants/Colors';

// Robinhood-inspired themes (unified with Colors.ts tokens)
const RobinhoodDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.borderLight,
    notification: Colors.dark.error,
  },
};

const RobinhoodLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.error,
  },
};

function ThemeWrapper() {
  const { colorScheme, isDark } = useThemePreference();
  const { isLoadingLanguage } = useLanguage();
  const theme = colorScheme === 'dark' ? RobinhoodDarkTheme : RobinhoodLightTheme;

  // Show loading gate while language preference loads from AsyncStorage
  // This prevents a flash of English content before Spanish is applied
  if (isLoadingLanguage) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <Stack key={colorScheme}>
        {/* Entry point - handles auth checks and redirects */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Auth screens */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />

        {/* Onboarding */}
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />

        {/* Main app tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Other screens */}
        <Stack.Screen name="paywall" options={{ headerShown: false }} />
        <Stack.Screen name="filing/expense-review" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RevenueCatProvider>
          <OnboardingProvider>
            <TaxProfileProvider>
              <ThemePreferenceProvider>
                <ThemeWrapper />
              </ThemePreferenceProvider>
            </TaxProfileProvider>
          </OnboardingProvider>
        </RevenueCatProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
