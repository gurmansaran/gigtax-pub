/**
 * FormDataConfirmationModal — Review & edit scanned tax form data before import.
 *
 * Displays extracted fields in an editable form. User can verify values,
 * make corrections, then confirm to import into the wizard.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { formatMoneyInput, parseMoneyInput } from '@/lib/moneyFormatter';
import type { ScannedFormResult } from '@/lib/taxFormScanner';
import type { ScannedW2Data, Scanned1099Data, Scanned1099BData } from '@/lib/claudeOcrService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmedW2 {
  type: 'W-2';
  employer: string;
  wages: number;
  withheld: number;
}

interface Confirmed1099 {
  type: '1099';
  payer: string;
  grossAmount: number;
  tipPortion: number;
  withheld: number;
}

interface Confirmed1099B {
  type: '1099-B';
  payer: string;
  shortTerm: number;
  longTerm: number;
}

export type ConfirmedFormData = ConfirmedW2 | Confirmed1099 | Confirmed1099B;

interface FormDataConfirmationModalProps {
  visible: boolean;
  scanResult: ScannedFormResult | null;
  onConfirm: (data: ConfirmedFormData) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormDataConfirmationModal({
  visible,
  scanResult,
  onConfirm,
  onCancel,
}: FormDataConfirmationModalProps) {
  const { colors } = useRobinhoodTheme();

  // Editable fields
  const [employer, setEmployer] = useState('');
  const [wages, setWages] = useState(0);
  const [withheld, setWithheld] = useState(0);
  const [payer, setPayer] = useState('');
  const [grossAmount, setGrossAmount] = useState(0);
  const [tipPortion, setTipPortion] = useState(0);
  const [shortTerm, setShortTerm] = useState(0);
  const [longTerm, setLongTerm] = useState(0);

  // Populate fields when scan result changes
  useEffect(() => {
    if (!scanResult?.data) return;

    const d = scanResult.data;
    if (d.type === 'W-2') {
      setEmployer(d.employer || '');
      setWages(d.wages || 0);
      setWithheld(d.withheld || 0);
    } else if (d.type === '1099') {
      setPayer(d.payer || '');
      setGrossAmount(d.amount || 0);
      setTipPortion(0);
      setWithheld(0);
    } else if (d.type === '1099-B') {
      setPayer(d.payer || '');
      setShortTerm(d.shortTerm ?? 0);
      setLongTerm(d.longTerm ?? 0);
    }
  }, [scanResult]);

  if (!scanResult) return null;

  const formType = scanResult.data.type;

  const handleConfirm = () => {
    // Validation
    if (formType === 'W-2') {
      if (!employer.trim()) {
        Alert.alert('Missing Field', 'Please enter the employer name.');
        return;
      }
      if (wages <= 0) {
        Alert.alert('Invalid Amount', 'Wages must be greater than $0.');
        return;
      }
      onConfirm({ type: 'W-2', employer: employer.trim(), wages, withheld });
    } else if (formType === '1099') {
      if (!payer.trim()) {
        Alert.alert('Missing Field', 'Please enter the payer name.');
        return;
      }
      if (grossAmount <= 0) {
        Alert.alert('Invalid Amount', 'Income amount must be greater than $0.');
        return;
      }
      onConfirm({ type: '1099', payer: payer.trim(), grossAmount, tipPortion, withheld });
    } else if (formType === '1099-B') {
      if (!payer.trim()) {
        Alert.alert('Missing Field', 'Please enter the brokerage name.');
        return;
      }
      onConfirm({ type: '1099-B', payer: payer.trim(), shortTerm, longTerm });
    }
  };

  // ─── Money Input Helper ──────────────────────────────────────────────────

  const MoneyField = ({ label, value, onChangeValue, hint }: {
    label: string;
    value: number;
    onChangeValue: (n: number) => void;
    hint?: string;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {hint && <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>{hint}</Text>}
      <TextInput
        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        value={formatMoneyInput(value)}
        onChangeText={(text) => onChangeValue(parseMoneyInput(text))}
        keyboardType="numeric"
      />
    </View>
  );

  const TextField = ({ label, value, onChangeText, hint }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    hint?: string;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {hint && <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>{hint}</Text>}
      <TextInput
        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
        value={value}
        onChangeText={onChangeText}
        placeholder="Enter name"
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );

  // ─── Render Form Fields ──────────────────────────────────────────────────

  const renderW2Fields = () => (
    <>
      <TextField label="Employer Name" value={employer} onChangeText={setEmployer} hint="Box c" />
      <MoneyField label="Wages, Tips, Compensation" value={wages} onChangeValue={setWages} hint="Box 1" />
      <MoneyField label="Federal Tax Withheld" value={withheld} onChangeValue={setWithheld} hint="Box 2" />
    </>
  );

  const render1099Fields = () => (
    <>
      <TextField label="Payer Name" value={payer} onChangeText={setPayer} />
      <MoneyField label="Nonemployee Compensation" value={grossAmount} onChangeValue={setGrossAmount} hint="Box 1" />
      <MoneyField label="Tip Income (if any)" value={tipPortion} onChangeValue={setTipPortion} />
      <MoneyField label="Federal Tax Withheld" value={withheld} onChangeValue={setWithheld} hint="Box 4" />
    </>
  );

  const render1099BFields = () => (
    <>
      <TextField label="Brokerage Name" value={payer} onChangeText={setPayer} />
      <MoneyField label="Short-Term Gain/Loss" value={shortTerm} onChangeValue={setShortTerm} hint="Use negative for losses" />
      <MoneyField label="Long-Term Gain/Loss" value={longTerm} onChangeValue={setLongTerm} hint="Use negative for losses" />
    </>
  );

  const formTypeLabel = formType === 'W-2' ? 'W-2' : formType === '1099-B' ? '1099-B' : '1099';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Confirm {formTypeLabel} Data</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Review and edit the scanned values before importing.
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Confidence Badge */}
          {scanResult.confidence && (
            <View style={[styles.confidenceBadge, {
              backgroundColor: scanResult.confidence === 'high' ? '#C6FF5E20' :
                scanResult.confidence === 'medium' ? '#FF950020' : '#FF3B3020',
            }]}>
              <Feather
                name={scanResult.confidence === 'high' ? 'check-circle' : 'alert-circle'}
                size={14}
                color={scanResult.confidence === 'high' ? '#C6FF5E' :
                  scanResult.confidence === 'medium' ? '#FF9500' : '#FF3B30'}
              />
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: scanResult.confidence === 'high' ? '#C6FF5E' :
                  scanResult.confidence === 'medium' ? '#FF9500' : '#FF3B30',
              }}>
                {scanResult.confidence === 'high' ? 'High confidence' :
                  scanResult.confidence === 'medium' ? 'Please verify values' : 'Low confidence — check carefully'}
              </Text>
            </View>
          )}

          {/* Fields */}
          <ScrollView style={{ maxHeight: 350 }} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldsContainer}>
              {formType === 'W-2' && renderW2Fields()}
              {formType === '1099' && render1099Fields()}
              {formType === '1099-B' && render1099BFields()}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Feather name="check" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>Import Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }]}
              onPress={onCancel}
            >
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    marginBottom: 12,
  },
  fieldsContainer: {
    gap: 4,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  actions: {
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
