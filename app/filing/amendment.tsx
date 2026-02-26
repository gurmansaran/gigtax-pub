/**
 * Amendment Wizard - Form 1040-X
 * 6-step wizard for correcting previously filed tax returns.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { printToFileAsync } from 'expo-print';
import { shareAsync, isAvailableAsync } from 'expo-sharing';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useAuth } from '@/lib/CtxProvider';
import { formatMMDDYYYY, isValidMMDDYYYY } from '@/lib/dateUtils';
import KeyboardDoneButton from '@/components/KeyboardDoneButton';

type AmendmentStep = 1 | 2 | 3 | 4 | 5 | 6;

type AmendmentReason =
  | 'income'
  | 'deductions'
  | 'credits'
  | 'filing_status'
  | 'dependents'
  | 'other';

const AMENDMENT_REASONS: { id: AmendmentReason; label: string; icon: string }[] = [
  { id: 'income', label: 'Income was incorrect', icon: 'dollar-sign' },
  { id: 'deductions', label: 'Missed deductions', icon: 'file-minus' },
  { id: 'credits', label: 'Missed tax credits', icon: 'gift' },
  { id: 'filing_status', label: 'Filing status was wrong', icon: 'users' },
  { id: 'dependents', label: 'Dependents changed', icon: 'user-plus' },
  { id: 'other', label: 'Other reason', icon: 'more-horizontal' },
];

const TOTAL_STEPS = 6;

export default function AmendmentWizard() {
  const { colors, isDark } = useRobinhoodTheme();
  const { user } = useAuth();
  const doneAccessoryId = 'amendment-done';

  const [currentStep, setCurrentStep] = useState<AmendmentStep>(1);
  const [generating, setGenerating] = useState(false);

  // Step 1
  const [taxYear, setTaxYear] = useState('');
  // Step 2
  const [originalFiledDate, setOriginalFiledDate] = useState('');
  // Step 3
  const [reason, setReason] = useState<AmendmentReason | null>(null);
  const [reasonExplanation, setReasonExplanation] = useState('');
  // Step 4 & 5: Original vs Corrected
  const [originalIncome, setOriginalIncome] = useState('');
  const [correctedIncome, setCorrectedIncome] = useState('');
  const [originalDeductions, setOriginalDeductions] = useState('');
  const [correctedDeductions, setCorrectedDeductions] = useState('');
  const [originalTax, setOriginalTax] = useState('');
  const [correctedTax, setCorrectedTax] = useState('');

  const percentComplete = Math.round((currentStep / TOTAL_STEPS) * 100);

  const parseNum = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;

  const handleNext = () => {
    if (currentStep >= TOTAL_STEPS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentStep((currentStep + 1) as AmendmentStep);
  };

  const handleBack = () => {
    if (currentStep <= 1) {
      router.back();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((currentStep - 1) as AmendmentStep);
  };

  const handleGenerate1040X = async () => {
    setGenerating(true);
    try {
      const incomeChange = parseNum(correctedIncome) - parseNum(originalIncome);
      const deductionChange = parseNum(correctedDeductions) - parseNum(originalDeductions);
      const taxChange = parseNum(correctedTax) - parseNum(originalTax);

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; }
              h1 { border-bottom: 2px solid #000; padding-bottom: 10px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
              .header-row { display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 12px; }
              .box { border: 1px solid #ccc; padding: 16px; margin-top: 20px; background: #f9f9f9; border-radius: 8px; }
              .change-positive { color: #C6FF5E; }
              .change-negative { color: #FF3B30; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #ccc; padding: 10px; text-align: right; }
              th { background: #f0f0f0; font-weight: 600; }
              td:first-child, th:first-child { text-align: left; }
            </style>
          </head>
          <body>
            <h1>Form 1040-X: Amended U.S. Individual Income Tax Return</h1>
            <p><strong>Tax Year Being Amended:</strong> ${taxYear}</p>
            <p><strong>Original Return Filed:</strong> ${originalFiledDate}</p>
            <p><strong>Reason for Amendment:</strong> ${AMENDMENT_REASONS.find(r => r.id === reason)?.label || 'Not specified'}</p>
            ${reasonExplanation ? `<p><strong>Explanation:</strong> ${reasonExplanation}</p>` : ''}

            <div class="box">
              <h3>Part I - Income, Deductions, and Tax</h3>
              <table>
                <tr>
                  <th>Item</th>
                  <th>A. Original Amount</th>
                  <th>B. Net Change</th>
                  <th>C. Correct Amount</th>
                </tr>
                <tr>
                  <td>Adjusted Gross Income</td>
                  <td>$${parseNum(originalIncome).toLocaleString()}</td>
                  <td class="${incomeChange >= 0 ? 'change-positive' : 'change-negative'}">
                    ${incomeChange >= 0 ? '+' : ''}$${incomeChange.toLocaleString()}
                  </td>
                  <td>$${parseNum(correctedIncome).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Itemized/Standard Deductions</td>
                  <td>$${parseNum(originalDeductions).toLocaleString()}</td>
                  <td class="${deductionChange >= 0 ? 'change-positive' : 'change-negative'}">
                    ${deductionChange >= 0 ? '+' : ''}$${deductionChange.toLocaleString()}
                  </td>
                  <td>$${parseNum(correctedDeductions).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Tax</td>
                  <td>$${parseNum(originalTax).toLocaleString()}</td>
                  <td class="${taxChange >= 0 ? 'change-negative' : 'change-positive'}">
                    ${taxChange >= 0 ? '+' : ''}$${taxChange.toLocaleString()}
                  </td>
                  <td>$${parseNum(correctedTax).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <div class="box">
              <h3>Part III - Explanation of Changes</h3>
              <p>${reasonExplanation || `Amendment filed to correct ${AMENDMENT_REASONS.find(r => r.id === reason)?.label?.toLowerCase() || 'tax return'} on original ${taxYear} return.`}</p>
            </div>

            <p style="margin-top: 40px; font-size: 12px; color: #666;">
              This is a preliminary Form 1040-X draft generated by GigTax. Mail to the IRS address for your state.
              Processing typically takes 8-12 weeks.
            </p>
          </body>
        </html>
      `;

      const { uri } = await printToFileAsync({ html: htmlContent, base64: false });
      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Form 1040-X' });
      }

      Alert.alert(
        'Amendment Generated',
        'Your Form 1040-X draft has been generated. Mail it to the IRS at the address for your state. Processing typically takes 8-12 weeks.',
        [
          { text: 'Done', onPress: () => router.back() },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate amendment.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardDoneButton accessoryID={doneAccessoryId} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>File an Amendment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressStepText, { color: colors.textSecondary }]}>
            Step {currentStep} of {TOTAL_STEPS}
          </Text>
          <Text style={[styles.progressPercentText, { color: colors.primary }]}>
            {percentComplete}%
          </Text>
        </View>
        <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressBarFill, { width: `${percentComplete}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Step 1: Tax Year */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Which year are you amending?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              You can amend returns for the past 3 years
            </Text>

            <View style={{ gap: 10 }}>
              {['2024', '2023', '2022'].map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    taxYear === year && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => {
                    setTaxYear(year);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{year} Tax Return</Text>
                  {taxYear === year && <Feather name="check-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.back()}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  !taxYear && styles.primaryButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!taxYear}>
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Original Filing Date */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>When did you file your original return?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              This date is on your original tax return confirmation
            </Text>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Original Filing Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.textSecondary}
                value={originalFiledDate}
                onChangeText={(text) => setOriginalFiledDate(formatMMDDYYYY(text))}
                keyboardType="number-pad"
                maxLength={10}
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleBack}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  !isValidMMDDYYYY(originalFiledDate) && styles.primaryButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!isValidMMDDYYYY(originalFiledDate)}>
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Reason for Amendment */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What needs to be corrected?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Select the primary reason for your amendment
            </Text>

            <View style={{ gap: 10 }}>
              {AMENDMENT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    reason === r.id && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => {
                    setReason(r.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Feather name={r.icon as any} size={22} color={reason === r.id ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.optionTitle, { color: colors.text }]}>{r.label}</Text>
                  </View>
                  {reason === r.id && <Feather name="check-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleBack}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  !reason && styles.primaryButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!reason}>
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: Original Values */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Original Return Values</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Enter the amounts from your original {taxYear} return
            </Text>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Adjusted Gross Income (Line 11) ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={originalIncome}
                onChangeText={setOriginalIncome}
                keyboardType="numeric"
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Deductions (Line 14) ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={originalDeductions}
                onChangeText={setOriginalDeductions}
                keyboardType="numeric"
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Total Tax (Line 24) ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={originalTax}
                onChangeText={setOriginalTax}
                keyboardType="numeric"
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleBack}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleNext}>
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 5: Corrected Values */}
        {currentStep === 5 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Corrected Values</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Enter the correct amounts that should have been on your {taxYear} return
            </Text>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Correct Adjusted Gross Income ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={correctedIncome}
                onChangeText={setCorrectedIncome}
                keyboardType="numeric"
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Correct Deductions ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={correctedDeductions}
                onChangeText={setCorrectedDeductions}
                keyboardType="numeric"
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Correct Total Tax ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={correctedTax}
                onChangeText={setCorrectedTax}
                keyboardType="numeric"
                inputAccessoryViewID={doneAccessoryId}
              />
            </View>

            {/* Explanation */}
            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Explain your changes (Part III)</Text>
              <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                The IRS requires an explanation on Form 1040-X
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="Describe what changed and why..."
                placeholderTextColor={colors.textSecondary}
                value={reasonExplanation}
                onChangeText={setReasonExplanation}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleBack}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleNext}>
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 6: Review & Generate */}
        {currentStep === 6 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Amendment Summary</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Review changes for your {taxYear} return
            </Text>

            {/* Summary Table */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.summaryHeaderRow}>
                <Text style={[styles.summaryHeaderCell, { color: colors.textSecondary, flex: 2 }]}>Item</Text>
                <Text style={[styles.summaryHeaderCell, { color: colors.textSecondary }]}>Original</Text>
                <Text style={[styles.summaryHeaderCell, { color: colors.textSecondary }]}>Corrected</Text>
                <Text style={[styles.summaryHeaderCell, { color: colors.textSecondary }]}>Change</Text>
              </View>

              {/* AGI */}
              {(() => {
                const change = parseNum(correctedIncome) - parseNum(originalIncome);
                return (
                  <View style={styles.summaryDataRow}>
                    <Text style={[styles.summaryCell, { color: colors.text, flex: 2 }]}>AGI</Text>
                    <Text style={[styles.summaryCell, { color: colors.text }]}>${parseNum(originalIncome).toLocaleString()}</Text>
                    <Text style={[styles.summaryCell, { color: colors.text }]}>${parseNum(correctedIncome).toLocaleString()}</Text>
                    <Text style={[styles.summaryCell, { color: change >= 0 ? colors.primary : colors.error }]}>
                      {change >= 0 ? '+' : ''}${change.toLocaleString()}
                    </Text>
                  </View>
                );
              })()}

              {/* Deductions */}
              {(() => {
                const change = parseNum(correctedDeductions) - parseNum(originalDeductions);
                return (
                  <View style={styles.summaryDataRow}>
                    <Text style={[styles.summaryCell, { color: colors.text, flex: 2 }]}>Deductions</Text>
                    <Text style={[styles.summaryCell, { color: colors.text }]}>${parseNum(originalDeductions).toLocaleString()}</Text>
                    <Text style={[styles.summaryCell, { color: colors.text }]}>${parseNum(correctedDeductions).toLocaleString()}</Text>
                    <Text style={[styles.summaryCell, { color: change >= 0 ? colors.primary : colors.error }]}>
                      {change >= 0 ? '+' : ''}${change.toLocaleString()}
                    </Text>
                  </View>
                );
              })()}

              {/* Tax */}
              {(() => {
                const change = parseNum(correctedTax) - parseNum(originalTax);
                return (
                  <View style={[styles.summaryDataRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.summaryCell, { color: colors.text, flex: 2, fontWeight: '600' }]}>Tax</Text>
                    <Text style={[styles.summaryCell, { color: colors.text, fontWeight: '600' }]}>${parseNum(originalTax).toLocaleString()}</Text>
                    <Text style={[styles.summaryCell, { color: colors.text, fontWeight: '600' }]}>${parseNum(correctedTax).toLocaleString()}</Text>
                    <Text style={[styles.summaryCell, { color: change <= 0 ? colors.primary : colors.error, fontWeight: '600' }]}>
                      {change >= 0 ? '+' : ''}${change.toLocaleString()}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Net change */}
            {(() => {
              const taxDiff = parseNum(correctedTax) - parseNum(originalTax);
              const isRefund = taxDiff < 0;
              return (
                <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: isRefund ? colors.primary : colors.error }]}>
                  <Feather
                    name={isRefund ? 'trending-down' : 'trending-up'}
                    size={24}
                    color={isRefund ? colors.primary : colors.error}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultTitle, { color: colors.text }]}>
                      {isRefund ? 'Additional Refund' : 'Additional Tax Owed'}
                    </Text>
                    <Text style={[styles.resultAmount, { color: isRefund ? colors.primary : colors.error }]}>
                      ${Math.abs(taxDiff).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Reason */}
            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Reason</Text>
              <Text style={[styles.confirmValue, { color: colors.text }]}>
                {AMENDMENT_REASONS.find(r => r.id === reason)?.label}
              </Text>
              {reasonExplanation ? (
                <Text style={[styles.inputHint, { color: colors.textSecondary, marginTop: 4 }]}>{reasonExplanation}</Text>
              ) : null}
            </View>

            {/* Info */}
            <View style={[styles.infoBox, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
              <Feather name="info" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                Form 1040-X must be mailed to the IRS (cannot be e-filed for most situations). Processing takes 8-12 weeks.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleBack}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleGenerate1040X}
                disabled={generating}>
                {generating ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Feather name="download" size={18} color={colors.background} />
                    <Text style={[styles.primaryButtonText, { color: colors.background }]}>Generate 1040-X</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
  },
  stepContainer: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 12,
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 48,
    width: '100%',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
    marginBottom: 8,
  },
  summaryHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#33333333',
  },
  summaryCell: {
    flex: 1,
    fontSize: 14,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultAmount: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
