/**
 * DeductionsSection — Wizard Section 3
 * Sub-steps: Standard vs Itemized, Itemized Details, Health Insurance,
 *            Retirement, Student Loan Interest, QBI Deduction
 */

import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useTaxReturn } from '@/lib/TaxReturnContext';
import BlurMoneyInput from '@/components/wizard/BlurMoneyInput';

// ─── Component ───────────────────────────────────────────────────────────────

export default function DeductionsSection() {
  const { colors } = useRobinhoodTheme();
  const { data, result, updateField, currentSubStep } = useTaxReturn();

  // ─── Sub-step 0: Standard vs Itemized ────────────────────────────────────

  const renderDeductionChoice = () => {
    const standardAmt = result?.standardDeductionAmount ?? 0;
    const itemizedAmt = result?.itemizedDeductionAmount ?? 0;
    const savings = result?.deductionSavings ?? 0;
    const isItemizedBetter = itemizedAmt > standardAmt;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Deduction Method</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Choose between standard deduction or itemizing. We calculate which saves more.
        </Text>

        <TouchableOpacity
          style={[styles.deductionCard, {
            backgroundColor: data.deductionType === 'Standard' ? colors.primary + '10' : colors.surface,
            borderColor: data.deductionType === 'Standard' ? colors.primary : colors.border,
            borderWidth: data.deductionType === 'Standard' ? 1.5 : StyleSheet.hairlineWidth,
          }]}
          onPress={() => updateField('deductionType', 'Standard')}
        >
          <View style={styles.deductionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deductionTitle, { color: colors.text }]}>Standard Deduction</Text>
              <Text style={[styles.deductionDesc, { color: colors.textSecondary }]}>Fixed amount based on filing status</Text>
            </View>
            <Text style={[styles.deductionAmount, { color: data.deductionType === 'Standard' ? colors.primary : colors.text }]}>
              ${standardAmt.toLocaleString()}
            </Text>
          </View>
          {!isItemizedBetter && (
            <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
              <Feather name="star" size={12} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Recommended</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deductionCard, {
            backgroundColor: data.deductionType === 'Itemized' ? colors.primary + '10' : colors.surface,
            borderColor: data.deductionType === 'Itemized' ? colors.primary : colors.border,
            borderWidth: data.deductionType === 'Itemized' ? 1.5 : StyleSheet.hairlineWidth,
          }]}
          onPress={() => updateField('deductionType', 'Itemized')}
        >
          <View style={styles.deductionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deductionTitle, { color: colors.text }]}>Itemized Deductions</Text>
              <Text style={[styles.deductionDesc, { color: colors.textSecondary }]}>Mortgage, property tax, donations, etc.</Text>
            </View>
            <Text style={[styles.deductionAmount, { color: data.deductionType === 'Itemized' ? colors.primary : colors.text }]}>
              ${itemizedAmt.toLocaleString()}
            </Text>
          </View>
          {isItemizedBetter && savings > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
              <Feather name="star" size={12} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Saves ${savings.toLocaleString()} more</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Sub-step 1: Itemized Details ────────────────────────────────────────

  const renderItemized = () => {
    if (data.deductionType !== 'Itemized') {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Itemized Deductions</Text>
          <View style={[styles.skipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              You chose the standard deduction. Tap Continue to skip.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Itemized Deductions</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          SALT (state & local taxes + property taxes) is capped at $10,000.
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput label="Mortgage Interest" value={data.mortgageInterest} onSave={(v) => updateField('mortgageInterest', v)} hint="From Form 1098" />
          {(data.mortgageInterest ?? 0) > 0 && (
            <BlurMoneyInput label="Outstanding Mortgage Balance" value={data.mortgageBalance ?? 0} onSave={(v) => updateField('mortgageBalance', v)} hint="Used to apply the IRS $750K debt cap" />
          )}
          <BlurMoneyInput label="Property Taxes" value={data.propertyTaxes} onSave={(v) => updateField('propertyTaxes', v)} hint="SALT cap: $10,000" />
          <BlurMoneyInput label="Charitable Donations" value={data.charitableDonations} onSave={(v) => updateField('charitableDonations', v)} hint="Cash and non-cash contributions" />
        </View>
      </View>
    );
  };

  // ─── Sub-step 2: Health Insurance ────────────────────────────────────────

  const renderHealth = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Health Insurance</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Self-employed health insurance premiums are an above-the-line deduction.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BlurMoneyInput
          label="Self-Employed Health Insurance Premiums"
          value={data.healthInsurancePremiums}
          onSave={(v) => updateField('healthInsurancePremiums', v)}
          hint="Medical, dental, long-term care premiums"
        />
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Eligible for employer-sponsored plan?</Text>
          <Switch value={!!data.eligibleForEmployerHealthPlan} onValueChange={(v) => updateField('eligibleForEmployerHealthPlan', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>
        {data.eligibleForEmployerHealthPlan && (
          <View style={[styles.noteCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Feather name="alert-triangle" size={14} color="#D97706" />
            <Text style={[styles.noteText, { color: '#92400E' }]}>SE health insurance deduction is blocked when you or your spouse are eligible for employer coverage.</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ─── Sub-step 3: Retirement ──────────────────────────────────────────────

  const renderRetirement = () => {
    const hsaLimit = data.hsaFamilyPlan ? 8550 : 4300;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Retirement Contributions</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Contributions to retirement accounts reduce your taxable income.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput label="Traditional IRA" value={data.iraContribution} onSave={(v) => updateField('iraContribution', v)} hint="Limit: $7,000 ($8,000 if 50+)" />
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Covered by workplace plan?</Text>
            <Switch value={!!data.coveredByWorkplacePlan} onValueChange={(v) => updateField('coveredByWorkplacePlan', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput label="SEP-IRA" value={data.sepIraContribution} onSave={(v) => updateField('sepIraContribution', v)} hint="Up to 25% of net self-employment income" />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput label="HSA Contribution" value={data.hsaContribution} onSave={(v) => updateField('hsaContribution', v)} hint={`Limit: $${hsaLimit.toLocaleString()}`} />
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Family HSA plan?</Text>
            <Switch value={data.hsaFamilyPlan} onValueChange={(v) => updateField('hsaFamilyPlan', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
          </View>
        </View>

        {result && (result.iraDeduction > 0 || result.sepIraDeduction > 0 || result.hsaDeduction > 0) && (
          <View style={[styles.card, { backgroundColor: colors.primary + '08', borderColor: colors.primary }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Calculated Deductions</Text>
            {result.iraDeduction > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>IRA</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.iraDeduction.toLocaleString()}</Text></View>}
            {result.sepIraDeduction > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>SEP-IRA</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.sepIraDeduction.toLocaleString()}</Text></View>}
            {result.hsaDeduction > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>HSA</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.hsaDeduction.toLocaleString()}</Text></View>}
          </View>
        )}
      </View>
    );
  };

  // ─── Sub-step 4: Student Loan ────────────────────────────────────────────

  const renderStudentLoan = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Student Loan Interest</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Deduct up to $2,500 of student loan interest.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BlurMoneyInput label="Student Loan Interest Paid" value={data.studentLoanInterest} onSave={(v) => updateField('studentLoanInterest', v)} hint="From Form 1098-E (max $2,500)" />
      </View>
    </View>
  );

  // ─── Sub-step 5: QBI ─────────────────────────────────────────────────────

  const renderQBI = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>QBI Deduction (Section 199A)</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Up to 20% of qualified business income. Automatically calculated.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Is this a Specified Service Business (SSTB)?</Text>
          <Switch value={!!data.isSSTB} onValueChange={(v) => updateField('isSSTB', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>
        {data.isSSTB && (
          <View style={[styles.noteCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Feather name="alert-triangle" size={14} color="#D97706" />
            <Text style={[styles.noteText, { color: '#92400E' }]}>SSTBs include health, law, accounting, consulting, athletics, and financial services. QBI deduction is eliminated above the income threshold.</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Net Business Income</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>${(result?.netBusinessIncome ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>QBI Deduction</Text>
          <Text style={[styles.rowValue, { color: colors.primary }]}>${(result?.qbiDeduction ?? 0).toLocaleString()}</Text>
        </View>
      </View>

      {/* Prior-year carryforwards */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Prior-Year Amounts</Text>
        <BlurMoneyInput label="Prior-Year NOL Carryforward" value={data.priorYearNOL ?? 0} onSave={(v) => updateField('priorYearNOL', v)} hint="Net operating losses from prior years (80% limit applies)" />
        <BlurMoneyInput label="Prior-Year Charitable Carryforward" value={data.priorCharitableCarryforward ?? 0} onSave={(v) => updateField('priorCharitableCarryforward', v)} hint="Excess charitable donations from prior 5 years" />
        <BlurMoneyInput label="ISO Exercise Income" value={data.isoExerciseIncome ?? 0} onSave={(v) => updateField('isoExerciseIncome', v)} hint="Bargain element from exercised ISOs (for AMT calculation)" />
      </View>

      {/* Show carryforward info from current-year calculation */}
      {result && ((result.capitalLossCarryforward ?? 0) > 0 || (result.charitableCarryforward ?? 0) > 0 || (result.suspendedPassiveLoss ?? 0) > 0 || (result.nolCarryforward ?? 0) > 0) && (
        <View style={[styles.card, { backgroundColor: colors.primary + '08', borderColor: colors.primary }]}>
          <Text style={[styles.cardTitle, { color: colors.primary }]}>Amounts Carrying to Next Year</Text>
          {(result.capitalLossCarryforward ?? 0) > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>Capital Loss</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.capitalLossCarryforward.toLocaleString()}</Text></View>}
          {(result.charitableCarryforward ?? 0) > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>Charitable</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.charitableCarryforward.toLocaleString()}</Text></View>}
          {(result.suspendedPassiveLoss ?? 0) > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>Suspended Rental Loss</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.suspendedPassiveLoss.toLocaleString()}</Text></View>}
          {(result.nolCarryforward ?? 0) > 0 && <View style={styles.row}><Text style={[styles.rowLabel, { color: colors.text }]}>NOL</Text><Text style={[styles.rowValue, { color: colors.primary }]}>${result.nolCarryforward.toLocaleString()}</Text></View>}
        </View>
      )}
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const steps = [renderDeductionChoice, renderItemized, renderHealth, renderRetirement, renderStudentLoan, renderQBI];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {steps[currentSubStep]?.() ?? steps[0]()}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepContainer: { gap: 16 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  deductionCard: { borderRadius: 14, padding: 16, gap: 10 },
  deductionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deductionTitle: { fontSize: 16, fontWeight: '600' },
  deductionDesc: { fontSize: 13, marginTop: 2 },
  deductionAmount: { fontSize: 22, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  skipCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  skipText: { fontSize: 14, flex: 1 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  noteText: { fontSize: 13, flex: 1, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleLabel: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 16, fontWeight: '600' },
});
