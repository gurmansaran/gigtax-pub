/**
 * 1099-NEC Form Component with Validation
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { formatMoneyInput, parseMoneyInput, formatEIN } from '@/lib/moneyFormatter';

export type FormType1099 = '1099-NEC' | '1099-K' | '1099-MISC';

export interface Form1099Data {
  payer: string;
  ein: string;
  box1_compensation: number;
  box4_fedWithheld: number;
  tips: number;
  formType: FormType1099;
}

interface Form1099Props {
  data: Form1099Data;
  onChange: (data: Form1099Data) => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

export default function Form1099({ data, onChange, onRemove, showRemove = false }: Form1099Props) {
  const { colors } = useRobinhoodTheme();
  const [showTipError, setShowTipError] = useState(false);

  const updateField = (field: keyof Form1099Data, value: string | number) => {
    const newData = { ...data, [field]: value };
    
    // Validation: Tips cannot exceed Box 1 income
    if (field === 'tips' || field === 'box1_compensation') {
      const tips = field === 'tips' ? (typeof value === 'number' ? value : parseMoneyInput(String(value))) : newData.tips;
      const income = field === 'box1_compensation' ? (typeof value === 'number' ? value : parseMoneyInput(String(value))) : newData.box1_compensation;
      
      if (tips > income) {
        setShowTipError(true);
        Alert.alert('Validation Error', 'Tips cannot exceed total income (Box 1).');
        // Cap tips at income
        if (field === 'tips') {
          newData.tips = income;
        }
      } else {
        setShowTipError(false);
      }
    }
    
    onChange(newData);
  };

  const handleMoneyChange = (field: 'box1_compensation' | 'box4_fedWithheld' | 'tips', text: string) => {
    const num = parseMoneyInput(text);
    updateField(field, num);
  };

  const FORM_TYPE_OPTIONS: Array<{ key: FormType1099; label: string; desc: string }> = [
    { key: '1099-NEC', label: '1099-NEC', desc: 'Freelance / gig income' },
    { key: '1099-K', label: '1099-K', desc: 'Payment card / app transactions' },
    { key: '1099-MISC', label: '1099-MISC', desc: 'Miscellaneous income' },
  ];

  const formTypeLabel = FORM_TYPE_OPTIONS.find(o => o.key === data.formType)?.label || '1099-NEC';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: showTipError ? colors.error : colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{formTypeLabel} Form</Text>
        {showRemove && onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <Feather name="x" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Form Type Selector */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Form Type</Text>
        <View style={styles.formTypeRow}>
          {FORM_TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.formTypePill,
                {
                  backgroundColor: data.formType === opt.key ? colors.primary + '15' : colors.background,
                  borderColor: data.formType === opt.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => updateField('formType', opt.key)}
            >
              <Text
                style={[
                  styles.formTypePillText,
                  { color: data.formType === opt.key ? colors.primary : colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {data.formType === '1099-K' && (
          <Text style={[styles.hint, { color: colors.primary, marginTop: 4 }]}>
            1099-K reports gross payment volume. If you also received a 1099-NEC, don't double-count — the 1099-K amount may overlap.
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Payer Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Payer Name"
          placeholderTextColor={colors.textSecondary}
          value={data.payer}
          onChangeText={(text) => updateField('payer', text)}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Payer EIN</Text>
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
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {data.formType === '1099-K' ? 'Box 1a: Gross Amount of Payment Card/Third Party Transactions' : 'Box 1: Nonemployee Compensation'}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box1_compensation)}
          onChangeText={(text) => handleMoneyChange('box1_compensation', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Box 4: Federal Tax Withheld</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.box4_fedWithheld)}
          onChangeText={(text) => handleMoneyChange('box4_fedWithheld', text)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Tips (Custom field for gig workers)</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Under the "No Tax on Tips" Act, tip income is exempt from Federal Income Tax.
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.background, color: colors.text, borderColor: showTipError ? colors.error : colors.border },
          ]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(data.tips || 0)}
          onChangeText={(text) => handleMoneyChange('tips', text)}
          keyboardType="numeric"
        />
        {showTipError && (
          <Text style={[styles.errorText, { color: colors.error }]}>
            Tips cannot exceed total income (Box 1).
          </Text>
        )}
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
  hint: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
  },
  formTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formTypePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  formTypePillText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
