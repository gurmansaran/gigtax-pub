/**
 * Personal Details Step - Filing Status, Name, SSN, State
 * Modern card-list filing status, clean inputs.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import SSNInput from './SSNInput';
import StateSelector from './StateSelector';

export type FilingStatusOption = 'single' | 'married_joint' | 'married_separate' | 'head_household';

interface PersonalDetailsStepProps {
  filingStatus: FilingStatusOption;
  onFilingStatusChange: (status: FilingStatusOption) => void;
  primaryName: string;
  onPrimaryNameChange: (name: string) => void;
  primarySSN: string;
  onPrimarySSNChange: (ssn: string) => void;
  spouseName: string;
  onSpouseNameChange: (name: string) => void;
  spouseSSN: string;
  onSpouseSSNChange: (ssn: string) => void;
  stateOfResidence: string;
  onStateChange: (state: string) => void;
  primary65Plus?: boolean;
  onPrimary65PlusChange?: (value: boolean) => void;
  primaryBlind?: boolean;
  onPrimaryBlindChange?: (value: boolean) => void;
  spouse65Plus?: boolean;
  onSpouse65PlusChange?: (value: boolean) => void;
  spouseBlind?: boolean;
  onSpouseBlindChange?: (value: boolean) => void;
  inputAccessoryViewID?: string;
}

const FILING_OPTIONS: {
  value: FilingStatusOption;
  label: string;
  description: string;
  icon: string;
}[] = [
  { value: 'single', label: 'Single', description: 'Unmarried or legally separated', icon: 'user' },
  { value: 'married_joint', label: 'Married Filing Jointly', description: 'Combined income with spouse', icon: 'users' },
  { value: 'married_separate', label: 'Married Filing Separately', description: 'Separate returns from spouse', icon: 'user-minus' },
  { value: 'head_household', label: 'Head of Household', description: 'Unmarried with qualifying dependent', icon: 'home' },
];

function getSSNDigits(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

export default function PersonalDetailsStep({
  filingStatus,
  onFilingStatusChange,
  primaryName,
  onPrimaryNameChange,
  primarySSN,
  onPrimarySSNChange,
  spouseName,
  onSpouseNameChange,
  spouseSSN,
  onSpouseSSNChange,
  stateOfResidence,
  onStateChange,
  primary65Plus = false,
  onPrimary65PlusChange,
  primaryBlind = false,
  onPrimaryBlindChange,
  spouse65Plus = false,
  onSpouse65PlusChange,
  spouseBlind = false,
  onSpouseBlindChange,
  inputAccessoryViewID,
}: PersonalDetailsStepProps) {
  const { colors } = useRobinhoodTheme();
  const requiresSpouse = filingStatus === 'married_joint' || filingStatus === 'married_separate';

  const primaryDigits = getSSNDigits(primarySSN);
  const spouseDigits = getSSNDigits(spouseSSN);
  const primarySSNError =
    primaryDigits.length > 0 && primaryDigits.length !== 9
      ? 'SSN must be exactly 9 digits'
      : undefined;
  const spouseSSNError =
    requiresSpouse && spouseDigits.length > 0 && spouseDigits.length !== 9
      ? 'SSN must be exactly 9 digits'
      : undefined;

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 14,
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Tell us about yourself</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Select how you'll file and enter some basic info. This helps us determine your tax brackets and deductions.
      </Text>

      {/* Filing Status - vertical card list */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Filing Status</Text>
        <View style={styles.filingList}>
          {FILING_OPTIONS.map((option) => {
            const isSelected = filingStatus === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filingCard,
                  {
                    backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={() => onFilingStatusChange(option.value)}
                activeOpacity={0.7}>
                <View style={[styles.filingIconCircle, { backgroundColor: isSelected ? colors.primary + '20' : colors.background }]}>
                  <Feather name={option.icon as any} size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.filingTextWrap}>
                  <Text style={[styles.filingLabel, { color: colors.text }]}>{option.label}</Text>
                  <Text style={[styles.filingDesc, { color: colors.textSecondary }]}>{option.description}</Text>
                </View>
                {isSelected && (
                  <Feather name="check-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Name */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Your Full Name</Text>
        <TextInput
          style={inputStyle}
          placeholder="Full name"
          placeholderTextColor={colors.textSecondary}
          value={primaryName}
          onChangeText={onPrimaryNameChange}
          autoCapitalize="words"
          returnKeyType="done"
          blurOnSubmit={true}
          inputAccessoryViewID={inputAccessoryViewID}
        />
      </View>

      {/* SSN */}
      <View style={styles.section}>
        <SSNInput
          label="Your Social Security Number"
          value={primarySSN}
          onChangeText={onPrimarySSNChange}
          placeholder="123-45-6789"
          maxLength={11}
          containerStyle={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: 12,
            minHeight: 50,
            paddingHorizontal: 16,
          }}
          error={primarySSNError}
          inputAccessoryViewID={inputAccessoryViewID}
        />
      </View>

      {/* 65+ and Blind toggles */}
      {(onPrimary65PlusChange != null || onPrimaryBlindChange != null) && (
        <View style={styles.section}>
          {onPrimary65PlusChange != null && (
            <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Born before Jan 2, 1961 (65+)</Text>
              <Switch value={primary65Plus} onValueChange={onPrimary65PlusChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
          )}
          {onPrimaryBlindChange != null && (
            <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Legally blind</Text>
              <Switch value={primaryBlind} onValueChange={onPrimaryBlindChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
          )}
        </View>
      )}

      {/* Spouse fields */}
      {requiresSpouse && (
        <>
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Spouse Full Name</Text>
            <TextInput
              style={inputStyle}
              placeholder="Spouse's full name"
              placeholderTextColor={colors.textSecondary}
              value={spouseName}
              onChangeText={onSpouseNameChange}
              autoCapitalize="words"
              returnKeyType="done"
              blurOnSubmit={true}
              inputAccessoryViewID={inputAccessoryViewID}
            />
          </View>

          <View style={styles.section}>
            <SSNInput
              label="Spouse Social Security Number"
              value={spouseSSN}
              onChangeText={onSpouseSSNChange}
              placeholder="123-45-6789"
              maxLength={11}
              containerStyle={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: 12,
                minHeight: 50,
                paddingHorizontal: 16,
              }}
              error={spouseSSNError}
              inputAccessoryViewID={inputAccessoryViewID}
            />
          </View>

          {(onSpouse65PlusChange != null || onSpouseBlindChange != null) && (
            <View style={styles.section}>
              {onSpouse65PlusChange != null && (
                <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Spouse born before Jan 2, 1961 (65+)</Text>
                  <Switch value={spouse65Plus} onValueChange={onSpouse65PlusChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                </View>
              )}
              {onSpouseBlindChange != null && (
                <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Spouse is legally blind</Text>
                  <Switch value={spouseBlind} onValueChange={onSpouseBlindChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* State */}
      <View style={styles.section}>
        <StateSelector
          label="State of Residence"
          hint="Used for state tax estimation"
          value={stateOfResidence}
          onSelect={onStateChange}
          triggerStyle={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: 12,
            minHeight: 50,
            paddingHorizontal: 16,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },

  // Filing status - vertical cards
  filingList: {
    gap: 8,
  },
  filingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  filingIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filingTextWrap: {
    flex: 1,
  },
  filingLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  filingDesc: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
});
