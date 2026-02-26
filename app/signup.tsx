/**
 * Sign Up Screen - Premium Robinhood-inspired design
 * Creates a new user account with email and password.
 * Waits for profile trigger, includes password strength meter.
 * Fully translated via LanguageContext.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase, getUserProfile } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import FormInput from '@/components/ui/FormInput';
import GradientButton from '@/components/ui/GradientButton';
import { useLanguage } from '@/lib/LanguageContext';

const colors = Colors.dark;

// Password strength levels
type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

function getPasswordStrength(pw: string): { level: StrengthLevel; color: string; width: string } {
  if (!pw) return { level: 'weak', color: colors.error, width: '0%' };

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 'weak', color: colors.error, width: '25%' };
  if (score === 2) return { level: 'fair', color: colors.warning, width: '50%' };
  if (score === 3) return { level: 'good', color: colors.primary, width: '75%' };
  return { level: 'strong', color: colors.success, width: '100%' };
}

export default function SignUpScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const passwordStrength = getPasswordStrength(password);

  const getStrengthLabel = (level: StrengthLevel): string => {
    return t(`signup.strength.${level}`);
  };

  // Handle sign up
  const handleSignUp = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('signup.error.emailRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert(t('common.error'), t('signup.error.emailInvalid'));
      return;
    }
    if (!password) {
      Alert.alert(t('common.error'), t('signup.error.passwordRequired'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('signup.error.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('signup.error.passwordMismatch'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        // Wait for profile trigger to complete before navigating
        let profileReady = false;
        console.log('🔍 Polling for profile creation...');
        for (let attempt = 0; attempt < 5; attempt++) {
          console.log(`⏳ Retry ${attempt + 1}/5...`);
          const profile = await getUserProfile(data.user.id);
          if (profile) {
            profileReady = true;
            console.log('✅ Profile created by trigger');
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }

        if (!profileReady) {
          // Trigger failed — manually create the profile row
          console.log('⚠️ Trigger failed, creating profile manually...');

          // Try insert with email column first (full schema)
          let { error: insertError } = await supabase.from('profiles').insert({
            id: data.user.id,
            email: email.trim().toLowerCase(),
            language_preference: language,
            onboarding_completed: false,
            onboarding_step: 1,
            full_name: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            gig_apps: [],
          });

          // If email column doesn't exist in schema cache, retry without it
          if (insertError?.message?.includes('schema cache')) {
            console.log('⚠️ Schema mismatch, retrying without email/language_preference...');
            ({ error: insertError } = await supabase.from('profiles').insert({
              id: data.user.id,
              onboarding_completed: false,
              onboarding_step: 1,
              full_name: '',
              phone: '',
              address: '',
              city: '',
              state: '',
              zip: '',
              gig_apps: [],
            }));
          }

          if (insertError) {
            console.error('❌ Manual profile creation failed:', insertError.message);
            // Sign the user out to avoid half-authenticated state
            await supabase.auth.signOut();
            Alert.alert(
              t('common.error'),
              "We couldn't create your account. Please check your internet connection and try again."
            );
            return;
          }
          console.log('✅ Profile created manually');
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/onboarding');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let errorMessage = t('signup.error.generic');
      if (error.message?.includes('already registered')) {
        errorMessage = t('signup.error.alreadyRegistered');
      } else if (error.message?.includes('invalid')) {
        errorMessage = t('signup.error.invalidEmail');
      } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorMessage = t('signup.error.network');
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(t('signup.error.title'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/login');
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
            <Text style={styles.title}>{t('signup.title')}</Text>
            <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
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
              label={t('signup.email.label')}
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder={t('signup.email.placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              editable={!loading}
              colorScheme="dark"
            />

            <FormInput
              label={t('signup.password.label')}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder={t('signup.password.placeholder')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              editable={!loading}
              secureToggle
              secureTextEntry
              colorScheme="dark"
            />

            {/* Password strength meter */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        backgroundColor: passwordStrength.color,
                        width: passwordStrength.width as any,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {getStrengthLabel(passwordStrength.level)}
                </Text>
              </View>
            )}

            <FormInput
              label={t('signup.confirmPassword.label')}
              icon="lock"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('signup.confirmPassword.placeholder')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              editable={!loading}
              secureToggle
              secureTextEntry
              colorScheme="dark"
              error={confirmPassword.length > 0 && password !== confirmPassword ? t('signup.confirmPassword.error') : undefined}
            />

            {/* Sign Up Button */}
            <GradientButton
              title={t('signup.button')}
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              colorScheme="dark"
              style={{ marginTop: 10 }}
            />

            {/* Terms */}
            <Text style={styles.termsText}>
              {t('signup.terms')}{' '}
              <Text style={styles.termsLink}>{t('signup.termsOfService')}</Text>
              {' '}{t('signup.and')}{' '}
              <Text style={styles.termsLink}>{t('signup.privacyPolicy')}</Text>
            </Text>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('signup.hasAccount')}</Text>
            <TouchableOpacity onPress={handleGoToLogin} disabled={loading}>
              <Text style={styles.linkText}>{t('signup.logIn')}</Text>
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
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -12,
    marginBottom: 16,
    gap: 8,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.progressBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 50,
  },
  termsText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
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
