/**
 * Login Screen - Premium Robinhood-inspired design
 * Authenticates existing users with email and password.
 * Checks onboarding status after login to redirect appropriately.
 * Fully translated via LanguageContext.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase, getOnboardingStatus } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import FormInput from '@/components/ui/FormInput';
import GradientButton from '@/components/ui/GradientButton';
import { useLanguage, syncLanguageFromProfile } from '@/lib/LanguageContext';

const colors = Colors.dark;

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const formTranslateY = useRef(new Animated.Value(40)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);
  }, []);

  // Validation helpers
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle login
  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('login.error.emailRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert(t('common.error'), t('login.error.emailInvalid'));
      return;
    }
    if (!password) {
      Alert.alert(t('common.error'), t('login.error.passwordRequired'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        // Sync language preference from Supabase profile (for reinstalls/new devices)
        await syncLanguageFromProfile(data.user.id);

        const { completed } = await getOnboardingStatus(data.user.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (completed) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/onboarding');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let errorMessage = t('login.error.generic');
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = t('login.error.invalidCredentials');
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = t('login.error.emailNotConfirmed');
      } else if (error.message?.includes('Too many requests')) {
        errorMessage = t('login.error.tooManyRequests');
      } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorMessage = t('login.error.network');
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(t('login.error.title'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('login.forgotPassword.enterEmailTitle'), t('login.forgotPassword.enterEmail'));
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert(t('common.error'), t('login.error.emailInvalid'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: 'gigtax://reset-password' }
      );
      if (error) throw error;
      Alert.alert(t('login.forgotPassword.successTitle'), t('login.forgotPassword.success'));
    } catch (error: any) {
      console.error('Forgot password error:', error);
      Alert.alert(t('common.error'), error.message || t('login.forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoToSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/signup');
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with animated logo */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.logoContainer}
            >
              <Feather name="dollar-sign" size={40} color={colors.background} />
            </LinearGradient>
            <Text style={styles.title}>{t('login.title')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
          </Animated.View>

          {/* Form with slide-up animation */}
          <Animated.View
            style={[
              styles.form,
              {
                opacity: formOpacity,
                transform: [{ translateY: formTranslateY }],
              },
            ]}
          >
            <FormInput
              label={t('login.email.label')}
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder={t('login.email.placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
              colorScheme="dark"
            />

            <FormInput
              label={t('login.password.label')}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder={t('login.password.placeholder')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              editable={!loading}
              secureToggle
              secureTextEntry
              colorScheme="dark"
            />

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <GradientButton
              title={t('login.button')}
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              colorScheme="dark"
              style={{ marginTop: 10 }}
            />
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={handleGoToSignUp} disabled={loading}>
              <Text style={styles.linkText}>{t('login.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -10,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    gap: 6,
  },
  footerText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
