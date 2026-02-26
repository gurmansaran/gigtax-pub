/**
 * IncomeSection — Wizard Section 1
 * Sub-steps: Income Type Selector, W-2 Entry, 1099 Entry, Capital Gains,
 *            Other Income, Spouse Income
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useTaxReturn } from '@/lib/TaxReturnContext';
import BlurMoneyInput from '@/components/wizard/BlurMoneyInput';
import W2Form from '@/components/tax/W2Form';
import type { W2FormData } from '@/components/tax/W2Form';
import Form1099 from '@/components/tax/Form1099';
import type { Form1099Data } from '@/components/tax/Form1099';
import FormScanButton from '@/components/tax/FormScanButton';
import FormDataConfirmationModal, {
  type ConfirmedFormData,
} from '@/components/tax/FormDataConfirmationModal';
import type { ScannedFormResult } from '@/lib/taxFormScanner';

// ─── Income Types ────────────────────────────────────────────────────────────

const INCOME_TYPES = [
  { key: 'w2', label: 'W-2 Wages', icon: 'briefcase', desc: 'Traditional employment' },
  { key: '1099', label: '1099 Income (Gig)', icon: 'truck', desc: '1099-NEC, 1099-K, or 1099-MISC' },
  { key: 'capGains', label: 'Capital Gains', icon: 'trending-up', desc: 'Stocks, crypto, investments' },
  { key: 'other', label: 'Other Income', icon: 'more-horizontal', desc: 'Interest, dividends, etc.' },
] as const;

type IncomeTypeKey = typeof INCOME_TYPES[number]['key'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function IncomeSection() {
  const { colors } = useRobinhoodTheme();
  const { data, updateField, updateFields, currentSubStep } = useTaxReturn();

  // Track which income types are relevant
  const [selectedTypes, setSelectedTypes] = useState<Set<IncomeTypeKey>>(() => {
    const types = new Set<IncomeTypeKey>();
    if (data.w2Incomes.length > 0) types.add('w2');
    if (data.income1099.length > 0) types.add('1099');
    if (data.capitalGainsShortTerm > 0 || data.capitalGainsLongTerm > 0) types.add('capGains');
    if (data.interestIncome > 0 || data.dividendIncome > 0 || data.socialSecurityIncome > 0 ||
      data.rentalIncome > 0 || data.unemploymentIncome > 0 || data.alimonyReceived > 0 ||
      data.gamblingWinnings > 0) types.add('other');
    return types;
  });

  const requiresSpouse = data.filingStatus === 'married_joint' || data.filingStatus === 'married_separate';

  // ─── Scan state ──────────────────────────────────────────────────────────
  const [scanResult, setScanResult] = useState<ScannedFormResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleScanComplete = useCallback((result: ScannedFormResult) => {
    setScanResult(result);
    setShowConfirmModal(true);
  }, []);

  const handleConfirmScan = useCallback((confirmed: ConfirmedFormData) => {
    setShowConfirmModal(false);
    setScanResult(null);

    if (confirmed.type === 'W-2') {
      // Add scanned W-2 to the list
      const newW2Detail: W2FormData = {
        employer: confirmed.employer,
        ein: '',
        box1_wages: confirmed.wages,
        box2_fedWithheld: confirmed.withheld,
        box3_ssWages: 0,
        box4_ssTax: 0,
        box5_medicareWages: 0,
        box6_medicareTax: 0,
      };
      setW2Details(prev => [...prev, newW2Detail]);
      updateField('w2Incomes', [
        ...data.w2Incomes,
        { employer: confirmed.employer, wages: confirmed.wages, withheld: confirmed.withheld },
      ]);
      // Auto-select W-2 income type
      setSelectedTypes(prev => new Set([...prev, 'w2']));
    } else if (confirmed.type === '1099') {
      // Add scanned 1099 to the list
      const new1099: Form1099Data = {
        payer: confirmed.payer,
        ein: '',
        box1_compensation: confirmed.grossAmount,
        box4_fedWithheld: confirmed.withheld,
        tips: confirmed.tipPortion,
        formType: '1099-NEC',
      };
      setForm1099Details(prev => [...prev, new1099]);
      updateField('income1099', [
        ...data.income1099,
        { source: confirmed.payer, grossAmount: confirmed.grossAmount, tipPortion: confirmed.tipPortion, withheld: confirmed.withheld, formType: '1099-NEC' as const },
      ]);
      setSelectedTypes(prev => new Set([...prev, '1099']));
    } else if (confirmed.type === '1099-B') {
      // Set capital gains from scanned 1099-B
      updateFields({
        capitalGainsShortTerm: (data.capitalGainsShortTerm || 0) + confirmed.shortTerm,
        capitalGainsLongTerm: (data.capitalGainsLongTerm || 0) + confirmed.longTerm,
      });
      setSelectedTypes(prev => new Set([...prev, 'capGains']));
    }
  }, [data.w2Incomes, data.income1099, data.capitalGainsShortTerm, data.capitalGainsLongTerm, updateField, updateFields]);

  const handleCancelScan = useCallback(() => {
    setShowConfirmModal(false);
    setScanResult(null);
  }, []);

  const toggleIncomeType = useCallback((key: IncomeTypeKey) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─── Sub-step 0: Income Type Selector ────────────────────────────────────

  const renderTypeSelector = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>What income did you receive?</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Select all types of income you had in 2025. You can add details in the next steps.
      </Text>

      {INCOME_TYPES.map((type) => {
        const isSelected = selectedTypes.has(type.key);
        return (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.typeCard,
              {
                backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
            onPress={() => toggleIncomeType(type.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.typeIcon, { backgroundColor: isSelected ? colors.primary + '20' : colors.background }]}>
              <Feather name={type.icon as any} size={20} color={isSelected ? colors.primary : colors.textSecondary} />
            </View>
            <View style={styles.typeTextWrap}>
              <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label}</Text>
              <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{type.desc}</Text>
            </View>
            <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
              {isSelected && <Feather name="check" size={14} color={colors.background} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Sub-step 1: W-2 Entry ──────────────────────────────────────────────

  const emptyW2: W2FormData = {
    employer: '', ein: '', box1_wages: 0, box2_fedWithheld: 0,
    box3_ssWages: 0, box4_ssTax: 0, box5_medicareWages: 0, box6_medicareTax: 0,
  };

  const handleW2Change = useCallback((index: number, updated: W2FormData) => {
    const list = [...data.w2Incomes];
    // Map W2FormData to the engine's w2Incomes shape
    list[index] = {
      employer: updated.employer,
      wages: updated.box1_wages,
      withheld: updated.box2_fedWithheld,
    };
    updateField('w2Incomes', list);
  }, [data.w2Incomes, updateField]);

  // Keep full W2 details in local state for the form UI
  const [w2Details, setW2Details] = useState<W2FormData[]>(() =>
    data.w2Incomes.map(w => ({
      employer: w.employer,
      ein: '',
      box1_wages: w.wages,
      box2_fedWithheld: w.withheld,
      box3_ssWages: 0,
      box4_ssTax: 0,
      box5_medicareWages: 0,
      box6_medicareTax: 0,
    }))
  );

  const handleW2DetailChange = useCallback((index: number, updated: W2FormData) => {
    const details = [...w2Details];
    details[index] = updated;
    setW2Details(details);

    // Sync to engine format
    const list = details.map(d => ({
      employer: d.employer,
      wages: d.box1_wages,
      withheld: d.box2_fedWithheld,
    }));
    updateField('w2Incomes', list);
  }, [w2Details, updateField]);

  const addW2 = useCallback(() => {
    setW2Details(prev => [...prev, { ...emptyW2 }]);
    updateField('w2Incomes', [
      ...data.w2Incomes,
      { employer: '', wages: 0, withheld: 0 },
    ]);
  }, [data.w2Incomes, updateField]);

  const removeW2 = useCallback((index: number) => {
    setW2Details(prev => prev.filter((_, i) => i !== index));
    updateField('w2Incomes', data.w2Incomes.filter((_, i) => i !== index));
  }, [data.w2Incomes, updateField]);

  const renderW2Entry = () => {
    if (!selectedTypes.has('w2')) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>W-2 Wages</Text>
          <View style={[styles.skipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="skip-forward" size={18} color={colors.textSecondary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              You indicated no W-2 income. Tap Continue to skip.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>W-2 Wages</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter each W-2 form you received, or scan one with your camera.
        </Text>

        {/* Scan W-2 Button */}
        <FormScanButton
          formType="W-2"
          onScanComplete={handleScanComplete}
          label="Scan W-2"
        />

        {w2Details.map((w2, idx) => (
          <W2Form
            key={idx}
            data={w2}
            onChange={(updated) => handleW2DetailChange(idx, updated)}
            onRemove={() => removeW2(idx)}
            showRemove={w2Details.length > 1}
          />
        ))}

        <TouchableOpacity
          style={[styles.addRow, { borderColor: colors.primary }]}
          onPress={addW2}
        >
          <Feather name="plus-circle" size={18} color={colors.primary} />
          <Text style={[styles.addRowText, { color: colors.primary }]}>Add another W-2</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Sub-step 2: 1099 Entry ──────────────────────────────────────────────

  const [form1099Details, setForm1099Details] = useState<Form1099Data[]>(() =>
    data.income1099.map(f => ({
      payer: f.source,
      ein: '',
      box1_compensation: f.grossAmount,
      box4_fedWithheld: f.withheld || 0,
      tips: f.tipPortion,
      formType: f.formType || '1099-NEC',
    }))
  );

  const handle1099Change = useCallback((index: number, updated: Form1099Data) => {
    const details = [...form1099Details];
    details[index] = updated;
    setForm1099Details(details);

    const list = details.map(d => ({
      source: d.payer,
      grossAmount: d.box1_compensation,
      tipPortion: d.tips,
      withheld: d.box4_fedWithheld,
      formType: d.formType || '1099-NEC' as const,
    }));
    updateField('income1099', list);
  }, [form1099Details, updateField]);

  const add1099 = useCallback(() => {
    const empty1099: Form1099Data = { payer: '', ein: '', box1_compensation: 0, box4_fedWithheld: 0, tips: 0, formType: '1099-NEC' };
    setForm1099Details(prev => [...prev, { ...empty1099 }]);
    updateField('income1099', [
      ...data.income1099,
      { source: '', grossAmount: 0, tipPortion: 0, withheld: 0, formType: '1099-NEC' as const },
    ]);
  }, [data.income1099, updateField]);

  const remove1099 = useCallback((index: number) => {
    setForm1099Details(prev => prev.filter((_, i) => i !== index));
    updateField('income1099', data.income1099.filter((_, i) => i !== index));
  }, [data.income1099, updateField]);

  const render1099Entry = () => {
    if (!selectedTypes.has('1099')) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>1099 Income</Text>
          <View style={[styles.skipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="skip-forward" size={18} color={colors.textSecondary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              You indicated no 1099 income. Tap Continue to skip.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>1099 Income</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter each 1099 form you received. Select the form type (1099-NEC, 1099-K, or 1099-MISC) for each entry.
        </Text>

        {/* Scan 1099 Button */}
        <FormScanButton
          formType="1099-NEC"
          onScanComplete={handleScanComplete}
          label="Scan 1099"
        />

        {form1099Details.map((f, idx) => (
          <Form1099
            key={idx}
            data={f}
            onChange={(updated) => handle1099Change(idx, updated)}
            onRemove={() => remove1099(idx)}
            showRemove={form1099Details.length > 1}
          />
        ))}

        <TouchableOpacity
          style={[styles.addRow, { borderColor: colors.primary }]}
          onPress={add1099}
        >
          <Feather name="plus-circle" size={18} color={colors.primary} />
          <Text style={[styles.addRowText, { color: colors.primary }]}>Add another 1099</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Sub-step 3: Capital Gains ───────────────────────────────────────────

  const renderCapitalGains = () => {
    if (!selectedTypes.has('capGains')) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Capital Gains</Text>
          <View style={[styles.skipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="skip-forward" size={18} color={colors.textSecondary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              You indicated no capital gains. Tap Continue to skip.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Capital Gains & Losses</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter net gains or losses, or scan your 1099-B brokerage statement.
        </Text>

        {/* Scan 1099-B Button */}
        <FormScanButton
          formType="1099-B"
          onScanComplete={handleScanComplete}
          label="Scan 1099-B"
        />

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput
            label="Short-Term Gains (held less than 1 year)"
            value={data.capitalGainsShortTerm}
            onSave={(v) => updateField('capitalGainsShortTerm', v)}
            hint="Taxed as ordinary income"
          />
          <BlurMoneyInput
            label="Long-Term Gains (held 1+ years)"
            value={data.capitalGainsLongTerm}
            onSave={(v) => updateField('capitalGainsLongTerm', v)}
            hint="Taxed at preferential rates (0%, 15%, or 20%)"
          />
          <BlurMoneyInput
            label="Prior-Year Capital Loss Carryforward"
            value={data.priorYearCapitalLossCarryforward ?? 0}
            onSave={(v) => updateField('priorYearCapitalLossCarryforward', v)}
            hint="Unused losses from prior years (enter as positive number)"
          />
        </View>
      </View>
    );
  };

  // ─── Sub-step 4: Other Income ────────────────────────────────────────────

  const renderOtherIncome = () => {
    if (!selectedTypes.has('other')) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Other Income</Text>
          <View style={[styles.skipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="skip-forward" size={18} color={colors.textSecondary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              You indicated no other income. Tap Continue to skip.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Other Income</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Report any additional income you received.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput label="Interest Income (1099-INT)" value={data.interestIncome} onSave={(v) => updateField('interestIncome', v)} />
          <BlurMoneyInput label="Dividend Income (1099-DIV)" value={data.dividendIncome} onSave={(v) => updateField('dividendIncome', v)} hint="Total ordinary + qualified dividends" />
          <BlurMoneyInput label="Qualified Dividends" value={data.qualifiedDividends ?? 0} onSave={(v) => updateField('qualifiedDividends', v)} hint="Subset taxed at lower LTCG rates (from 1099-DIV Box 1b)" />
          <BlurMoneyInput label="Social Security Benefits" value={data.socialSecurityIncome} onSave={(v) => updateField('socialSecurityIncome', v)} hint="Only a portion may be taxable" />
          <BlurMoneyInput label="Rental Income" value={data.rentalIncome} onSave={(v) => updateField('rentalIncome', v)} />
          <BlurMoneyInput label="Unemployment Compensation" value={data.unemploymentIncome} onSave={(v) => updateField('unemploymentIncome', v)} />
          <BlurMoneyInput label="Alimony Received" value={data.alimonyReceived} onSave={(v) => updateField('alimonyReceived', v)} hint="For agreements before 2019" />
          <BlurMoneyInput label="Gambling Winnings" value={data.gamblingWinnings} onSave={(v) => updateField('gamblingWinnings', v)} />
        </View>
      </View>
    );
  };

  // ─── Sub-step 5: Spouse Income ───────────────────────────────────────────

  const renderSpouseIncome = () => {
    if (!requiresSpouse) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Spouse Income</Text>
          <View style={[styles.skipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              Not applicable for your filing status.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Spouse Income</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your spouse's total income and withholdings.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput label="Spouse Total Income" value={data.spouseIncome} onSave={(v) => updateField('spouseIncome', v)} />
          <BlurMoneyInput label="Spouse Federal Withholding" value={data.spouseWithholding} onSave={(v) => updateField('spouseWithholding', v)} />
        </View>
      </View>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const steps = [
    renderTypeSelector,
    renderW2Entry,
    render1099Entry,
    renderCapitalGains,
    renderOtherIncome,
    renderSpouseIncome,
  ];

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {steps[currentSubStep]?.() ?? steps[0]()}
      </ScrollView>

      {/* Form Scan Confirmation Modal */}
      <FormDataConfirmationModal
        visible={showConfirmModal}
        scanResult={scanResult}
        onConfirm={handleConfirmScan}
        onCancel={handleCancelScan}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepContainer: { gap: 16 },

  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },

  // Income type cards
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeTextWrap: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  typeDesc: { fontSize: 12, lineHeight: 16 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Skip card
  skipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  skipText: { fontSize: 14, flex: 1 },

  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  addRowText: { fontSize: 15, fontWeight: '600' },
});
