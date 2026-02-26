/**
 * Spouse 1099 Step – Saves to spouse.forms1099
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import Form1099, { type Form1099Data } from '@/components/tax/Form1099';
import type { Form1099 as Form1099Type } from '@/lib/types';

const defaultForm1099: Form1099Data = {
  payer: '',
  ein: '',
  box1_compensation: 0,
  box4_fedWithheld: 0,
  tips: 0,
  formType: '1099-NEC',
};

function toFormData(f: Form1099Type): Form1099Data {
  return {
    payer: f.payer,
    ein: f.ein,
    box1_compensation: f.box1_compensation,
    box4_fedWithheld: f.box4_fedWithheld,
    tips: f.tips,
    formType: (f as any).formType || '1099-NEC',
  };
}

function fromFormData(d: Form1099Data): Form1099Type {
  return { ...d };
}

interface Spouse1099StepProps {
  forms1099: Form1099Type[];
  onForms1099Change: (forms: Form1099Type[]) => void;
  onScan?: () => void;
  scanning?: boolean;
  onBack: () => void;
  onNext: () => void;
}

export default function Spouse1099Step({
  forms1099,
  onForms1099Change,
  onScan,
  scanning = false,
  onBack,
  onNext,
}: Spouse1099StepProps) {
  const { colors } = useRobinhoodTheme();
  const forms = forms1099.map(toFormData);

  const update = (index: number, data: Form1099Data) => {
    const next = [...forms1099];
    next[index] = fromFormData(data);
    onForms1099Change(next);
  };

  const add = () => onForms1099Change([...forms1099, fromFormData(defaultForm1099)]);
  const remove = (index: number) => onForms1099Change(forms1099.filter((_, i) => i !== index));

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Does your spouse have 1099 income?</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Add your spouse's 1099-NEC, 1099-MISC, or 1099-K forms from 2025.
      </Text>

      {onScan && (
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={onScan}
          disabled={scanning}>
          {scanning ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.scanButtonText, { color: colors.primary }]}>Analyzing Document...</Text>
            </>
          ) : (
            <>
              <Feather name="upload" size={20} color={colors.primary} />
              <Text style={[styles.scanButtonText, { color: colors.primary }]}>Import 1099 (Photo, PDF, or File)</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {forms.map((form, index) => (
        <Form1099
          key={index}
          data={form}
          onChange={(data) => update(index, data)}
          onRemove={forms.length > 1 ? () => remove(index) : undefined}
          showRemove={forms.length > 1}
        />
      ))}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={add}>
        <Feather name="plus" size={20} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>
          {forms.length === 0 ? 'Add 1099 Income' : 'Add Another 1099'}
        </Text>
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.surface }]} onPress={onBack}>
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={onNext}>
          <Text style={[styles.primaryButtonText, { color: colors.background }]}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '400', marginBottom: 24 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scanButtonText: { fontSize: 16, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addButtonText: { fontSize: 16, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryButton: { flex: 1, borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { flex: 1, borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
});
