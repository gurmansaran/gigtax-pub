/**
 * Spouse W-2 Step – Saves to spouse.w2s
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import W2Form, { type W2FormData } from '@/components/tax/W2Form';
import type { W2Form as W2FormType } from '@/lib/types';

const defaultW2Form: W2FormData = {
  employer: '',
  ein: '',
  box1_wages: 0,
  box2_fedWithheld: 0,
  box3_ssWages: 0,
  box4_ssTax: 0,
  box5_medicareWages: 0,
  box6_medicareTax: 0,
};

function toFormData(w: W2FormType): W2FormData {
  return {
    employer: w.employer,
    ein: w.ein,
    box1_wages: w.box1_wages,
    box2_fedWithheld: w.box2_fedWithheld,
    box3_ssWages: w.box3_ssWages,
    box4_ssTax: w.box4_ssTax,
    box5_medicareWages: w.box5_medicareWages,
    box6_medicareTax: w.box6_medicareTax,
  };
}

function fromFormData(f: W2FormData): W2FormType {
  return { ...f };
}

interface SpouseW2StepProps {
  w2s: W2FormType[];
  onW2sChange: (w2s: W2FormType[]) => void;
  onScan?: () => void;
  scanning?: boolean;
  onBack: () => void;
  onNext: () => void;
}

export default function SpouseW2Step({
  w2s,
  onW2sChange,
  onScan,
  scanning = false,
  onBack,
  onNext,
}: SpouseW2StepProps) {
  const { colors } = useRobinhoodTheme();
  const forms = w2s.map(toFormData);

  const update = (index: number, data: W2FormData) => {
    const next = [...w2s];
    next[index] = fromFormData(data);
    onW2sChange(next);
  };

  const add = () => onW2sChange([...w2s, fromFormData(defaultW2Form)]);
  const remove = (index: number) => onW2sChange(w2s.filter((_, i) => i !== index));

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Does your spouse have W-2 income?</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Add your spouse's W-2 forms from 2025. You can import them or enter the details manually.
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
              <Text style={[styles.scanButtonText, { color: colors.primary }]}>Import W-2 (Photo, PDF, or File)</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {forms.length === 0 ? (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={add}>
          <Feather name="plus" size={20} color={colors.primary} />
          <Text style={[styles.addButtonText, { color: colors.primary }]}>Add W-2 Job</Text>
        </TouchableOpacity>
      ) : (
        <>
          {forms.map((form, index) => (
            <W2Form
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
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Another W-2</Text>
          </TouchableOpacity>
        </>
      )}

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
