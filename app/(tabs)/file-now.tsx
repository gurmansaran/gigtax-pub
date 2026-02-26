/**
 * File Now — Tax Filing Wizard Shell
 * Thin shell that manages section navigation and delegates to section components.
 * Uses TaxReturnProvider for state management and persistence.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  InputAccessoryView, Platform, Keyboard, Button,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { CardSkeleton } from '@/components/ui/Skeletons';
import { useTaxProfile } from '@/lib/CtxProvider';
import { TaxReturnProvider, useTaxReturn } from '@/lib/TaxReturnContext';
import { WIZARD_SECTIONS } from '@/lib/wizardSections';
import WizardProgressBar from '@/components/wizard/WizardProgressBar';

// Section components
import PersonalInfoSection from '@/components/wizard/sections/PersonalInfoSection';
import IncomeSection from '@/components/wizard/sections/IncomeSection';
import ExpensesSection from '@/components/wizard/sections/ExpensesSection';
import DeductionsSection from '@/components/wizard/sections/DeductionsSection';
import CreditsSection from '@/components/wizard/sections/CreditsSection';
import ReviewSection from '@/components/wizard/sections/ReviewSection';

const SECTION_COMPONENTS = [
  PersonalInfoSection,
  IncomeSection,
  ExpensesSection,
  DeductionsSection,
  CreditsSection,
  ReviewSection,
];

const DONE_ACCESSORY_ID = 'file-now-done-bar';

// ─── Inner Content (consumes context) ────────────────────────────────────────

function FileNowContent() {
  const { colors, isDark } = useRobinhoodTheme();
  const {
    data, currentSection, currentSubStep, loading, saving,
    goToSection, nextSubStep, prevSubStep, nextSection, prevSection,
    loadDraft, resetReturn, saveDraft,
  } = useTaxReturn();
  const { refreshProfile, updateTaxProfile, taxProfile } = useTaxProfile();

  const [initialized, setInitialized] = useState(false);
  const hasPrompted = useRef(false);

  // Refresh profile data whenever this tab gains focus (e.g. after onboarding or profile edits)
  useFocusEffect(useCallback(() => { refreshProfile(); }, [refreshProfile]));

  // ─── Load Draft on Mount ─────────────────────────────────────────────

  useEffect(() => {
    if (hasPrompted.current) return;
    hasPrompted.current = true;

    (async () => {
      const hasDraft = await loadDraft();
      if (hasDraft) {
        Alert.alert(
          'Resume Tax Return',
          'You have an unfinished tax return. Would you like to continue where you left off?',
          [
            {
              text: 'Start Fresh',
              style: 'destructive',
              onPress: () => {
                resetReturn();
                setInitialized(true);
              },
            },
            {
              text: 'Resume',
              style: 'default',
              onPress: () => setInitialized(true),
            },
          ],
        );
      } else {
        setInitialized(true);
      }
    })();
  }, []);

  // ─── Navigation Handlers ─────────────────────────────────────────────

  const section = WIZARD_SECTIONS[currentSection];
  const isFirstSubStep = currentSubStep === 0;
  const isLastSubStep = currentSubStep >= section.subStepCount - 1;
  const isFirstSection = currentSection === 0;
  const isLastSection = currentSection === WIZARD_SECTIONS.length - 1;

  const handleBack = useCallback(() => {
    if (!isFirstSubStep) {
      prevSubStep();
    } else if (!isFirstSection) {
      prevSection();
    }
  }, [isFirstSubStep, isFirstSection, prevSubStep, prevSection]);

  const handleNext = useCallback(() => {
    // Dismiss keyboard first so onBlur fires and auto-saves any pending edits
    Keyboard.dismiss();

    if (!isLastSubStep) {
      nextSubStep();
    } else if (!isLastSection) {
      nextSection();
    }
    // If last sub-step of last section, the ReviewSection handles completion
  }, [isLastSubStep, isLastSection, nextSubStep, nextSection]);

  const handleSectionPress = useCallback((sectionId: number) => {
    goToSection(sectionId, 0);
  }, [goToSection]);

  const handleSaveAndExit = useCallback(async () => {
    await saveDraft();
    Alert.alert('Saved', 'Your progress has been saved. You can resume anytime.');
  }, [saveDraft]);

  // ─── Render ──────────────────────────────────────────────────────────

  if (loading || !initialized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <CardSkeleton height={140} />
          <CardSkeleton height={80} />
          <CardSkeleton height={80} />
        </View>
      </SafeAreaView>
    );
  }

  const SectionComponent = SECTION_COMPONENTS[currentSection];
  const showBackButton = !(isFirstSection && isFirstSubStep);
  const isReviewSection = currentSection === WIZARD_SECTIONS.length - 1;

  // Continue button text
  let nextButtonText = 'Continue';
  if (isLastSubStep && !isLastSection) {
    nextButtonText = `Next: ${WIZARD_SECTIONS[currentSection + 1].title}`;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>File Now</Text>
          {saving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.savingText, { color: colors.textSecondary }]}>Saving...</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleSaveAndExit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="save" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ─── Progress Bar ───────────────────────────────────────── */}
      <WizardProgressBar
        currentSection={currentSection}
        data={data}
        onSectionPress={handleSectionPress}
      />

      {/* ─── Section Content ────────────────────────────────────── */}
      <View style={styles.sectionContent}>
        <SectionComponent />
      </View>

      {/* ─── Bottom Navigation ──────────────────────────────────── */}
      {!isReviewSection && (
        <View style={[styles.bottomNav, { borderTopColor: colors.border }]}>
          {showBackButton ? (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={18} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
          >
            <Text style={[styles.nextButtonText, { color: colors.background }]}>
              {nextButtonText}
            </Text>
            <Feather name="arrow-right" size={18} color={colors.background} />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── iOS Keyboard Done Button ───────────────────────────── */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
          <View style={[styles.doneBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Button title="Done" onPress={() => Keyboard.dismiss()} color={colors.primary} />
          </View>
        </InputAccessoryView>
      )}
    </SafeAreaView>
  );
}

// ─── Exported Screen (wraps in Provider) ─────────────────────────────────────

export default function FileNowScreen() {
  return (
    <TaxReturnProvider>
      <FileNowContent />
    </TaxReturnProvider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingText: {
    fontSize: 12,
  },

  // Section content
  sectionContent: {
    flex: 1,
  },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  backPlaceholder: {
    width: 80,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Keyboard done bar
  doneBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
