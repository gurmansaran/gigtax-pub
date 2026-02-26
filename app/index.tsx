/**
 * App Entry Point
 * Handles auth state and redirects to appropriate screen:
 * - No language preference → Language selection (onboarding)
 * - Not logged in → Login
 * - Logged in + onboarding incomplete → Onboarding
 * - Logged in + onboarding complete → Dashboard
 */

import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/CtxProvider';
import { useLanguage } from '@/lib/LanguageContext';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getOnboardingStatus } from '@/lib/supabase';

const AUTH_TIMEOUT_MS = 10000;

export default function Index() {
  const { session, user, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const [onboardingStatus, setOnboardingStatus] = useState<{
    checked: boolean;
    completed: boolean;
  }>({ checked: false, completed: false });
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Timeout for auth/onboarding checks
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!onboardingStatus.checked) {
        setTimedOut(true);
        setOnboardingStatus({ checked: true, completed: false });
      }
    }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onboardingStatus.checked]);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) {
        setOnboardingStatus({ checked: true, completed: false });
        return;
      }

      try {
        const { completed } = await getOnboardingStatus(user.id);
        setOnboardingStatus({ checked: true, completed });
      } catch (err) {
        console.error('Error checking onboarding:', err);
        setError(t('app.error.accountStatus'));
        setOnboardingStatus({ checked: true, completed: false });
      }
    };

    if (!authLoading) {
      checkOnboarding();
    }
  }, [authLoading, user]);

  // Show loading while checking auth and onboarding status
  if (authLoading || !onboardingStatus.checked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C6FF5E" />
      </View>
    );
  }

  // Error or timeout fallback
  if (error || timedOut) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error || t('app.loading.timeout')}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setTimedOut(false);
            setOnboardingStatus({ checked: false, completed: false });
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>{t('app.loading.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Not logged in → Login screen
  if (!session) {
    return <Redirect href="/login" />;
  }

  // Logged in but onboarding incomplete
  if (!onboardingStatus.completed) {
    // If no language preference set, go to language selection first
    if (!language) {
      return <Redirect href="/onboarding/language" />;
    }
    return <Redirect href="/onboarding" />;
  }

  // Logged in and onboarding complete → Main app
  return <Redirect href="/(tabs)/dashboard" />;
}

const styles = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#0A0A0A',
    padding: 20,
  },
  errorText: {
    color: '#999999',
    fontSize: 16,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#C6FF5E',
    borderRadius: 12,
  },
  retryText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600' as const,
  },
};
