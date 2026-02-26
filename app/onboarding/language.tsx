/**
 * Language Selection Screen
 * Step 0 of onboarding - user selects English or Spanish.
 * Must appear before any other onboarding step.
 * Bilingual headline to avoid chicken-and-egg problem.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/lib/LanguageContext';
import type { Language } from '@/lib/translations';

const colors = {
  background: Colors.dark.background,
  card: Colors.dark.card,
  text: Colors.dark.text,
  textSecondary: Colors.dark.textSecondary,
  accent: Colors.dark.primary,
  accentDark: Colors.dark.primaryDark,
  border: Colors.dark.borderLight,
};

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { setLanguage } = useLanguage();
  const [selected, setSelected] = useState<Language | null>(null);
  const [loading, setLoading] = useState(false);

  // Card animations
  const enScale = useRef(new Animated.Value(1)).current;
  const esScale = useRef(new Animated.Value(1)).current;

  const handleSelect = (lang: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(lang);

    // Animate selection
    const targetScale = lang === 'en' ? enScale : esScale;
    const otherScale = lang === 'en' ? esScale : enScale;

    Animated.parallel([
      Animated.spring(targetScale, {
        toValue: 1.03,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(otherScale, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleContinue = async () => {
    if (!selected) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      await setLanguage(selected);
      router.replace('/onboarding');
    } catch (error) {
      console.error('Error saving language:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            style={styles.logoContainer}
          >
            <Feather name="dollar-sign" size={40} color={colors.background} />
          </LinearGradient>
        </View>

        {/* Bilingual Headline */}
        <View style={styles.headlineSection}>
          <Text style={styles.headlineEn}>Choose your language</Text>
          <Text style={styles.headlineEs}>Elige tu idioma</Text>
        </View>

        {/* Language Cards */}
        <View style={styles.cardsContainer}>
          <Animated.View style={{ transform: [{ scale: enScale }] }}>
            <TouchableOpacity
              style={[
                styles.languageCard,
                selected === 'en' && styles.languageCardSelected,
              ]}
              onPress={() => handleSelect('en')}
              activeOpacity={0.8}
            >
              <Text style={styles.flagEmoji}>🇺🇸</Text>
              <Text
                style={[
                  styles.languageLabel,
                  selected === 'en' && styles.languageLabelSelected,
                ]}
              >
                English
              </Text>
              {selected === 'en' && (
                <View style={styles.checkmarkBadge}>
                  <Feather name="check" size={16} color={colors.background} />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: esScale }] }}>
            <TouchableOpacity
              style={[
                styles.languageCard,
                selected === 'es' && styles.languageCardSelected,
              ]}
              onPress={() => handleSelect('es')}
              activeOpacity={0.8}
            >
              <Text style={styles.flagEmoji}>🇲🇽</Text>
              <Text
                style={[
                  styles.languageLabel,
                  selected === 'es' && styles.languageLabelSelected,
                ]}
              >
                Español
              </Text>
              {selected === 'es' && (
                <View style={styles.checkmarkBadge}>
                  <Feather name="check" size={16} color={colors.background} />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Continue Button */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!selected || loading}
          activeOpacity={0.8}
          style={styles.continueButtonWrapper}
        >
          <LinearGradient
            colors={
              selected
                ? [colors.accent, colors.accentDark]
                : [colors.border, colors.border]
            }
            style={styles.continueButton}
          >
            <Text
              style={[
                styles.continueButtonText,
                !selected && styles.continueButtonTextDisabled,
              ]}
            >
              {selected === 'es' ? 'Continuar' : 'Continue'}
            </Text>
            <Feather
              name="arrow-right"
              size={20}
              color={selected ? colors.background : colors.textSecondary}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoSection: {
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headlineSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headlineEn: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  headlineEs: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  cardsContainer: {
    width: '100%',
    gap: 16,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
    position: 'relative',
  },
  languageCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(198, 255, 94, 0.08)',
  },
  flagEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  languageLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  languageLabelSelected: {
    color: colors.text,
  },
  checkmarkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    padding: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButtonWrapper: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  continueButton: {
    flex: 1,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.background,
  },
  continueButtonTextDisabled: {
    color: colors.textSecondary,
  },
});
