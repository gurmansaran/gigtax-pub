/**
 * W-2 Form Component with Detailed IRS Box Fields
 */

import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { formatMoneyInput, parseMoneyInput, formatEIN } from '@/lib/moneyFormatter';

export interface W2FormData {
  employer: string;
  ein: string;
  box1_wages: number;
  box2_fedWithheld: number;
  box3_ssWages: number;
  box4_ssTax: number;
  box5_medicareWages: number;
  box6_medicareTax: number;
}

interface W2FormProps {
  data: W2FormData;
  onChange: (data: W2FormData) => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

export default function W2Form({ data, onChange, onRemove, showRemove = false }: W2FormProps) {
  const { colors } = useRobinhoodTheme();

  const updateField = (field: keyof W2FormData, value: string | number) => {
    onChange({ ...data, [field]: value });
  };

  const handleMoneyChange = (field: 'box1_wages' | 'box2_fedWithheld' | 'box3_ssWages' | 'box4_ssTax' | 'box5_medicareWages' | 'box6_medicareTax', text: string) => {
    let num = parseMoneyInput(text);
    // P1-12: Withholding cannot exceed wages
    if (field === 'box2_fedWithheld' && num > data.box1_wages && data.box1_wages > 0) {
      num = data.box1_wages;
    }
    updateField(field, num);
  };

  // P1-17: Validation warning
  const withholdingExceedsWages = data.box2_fedWithheld > data.box1_wages && data.box1_wages > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>W-2 Form</Text>
        {showRemove && onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <Feather name="x" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Employer Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Employer Name"
          placeholderTextColor={colors.textSecondary}
          value={data.employer}
          onChangeText={(text) => updateField('employer', text)}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Employer EIN</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="XX-XXXXXXX"
          placeholderTextColor={colors.textSecondary}
          value={data.ein}
          onChangeText={(text) => updateField('ein', formatEIN(text))}
          maxLength={10}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 1: Wages, Tips, Other Comp</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box1_wages)}
          onChangeText={(text) => handleMoneyChange('box1_wages', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 2: Federal Income Tax Withheld</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box2_fedWithheld)}
          onChangeText={(text) => handleMoneyChange('box2_fedWithheld', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 3: Social Security Wages</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box3_ssWages)}
          onChangeText={(text) => handleMoneyChange('box3_ssWages', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 4: Social Security Tax Withheld</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box4_ssTax)}
          onChangeText={(text) => handleMoneyChange('box4_ssTax', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 5: Medicare Wages</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box5_medicareWages)}
          onChangeText={(text) => handleMoneyChange('box5_medicareWages', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 6: Medicare Tax Withheld</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box6_medicareTax)}
          onChangeText={(text) => handleMoneyChange('box6_medicareTax', text)}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
});
