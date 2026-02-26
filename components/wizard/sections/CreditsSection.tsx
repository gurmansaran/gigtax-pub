/**
 * CreditsSection — Wizard Section 4
 * Sub-steps: Child Tax Credit, Education Credits, Child Care Credit,
 *            EITC, Estimated Tax Payments
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useTaxReturn } from '@/lib/TaxReturnContext';
import { useAuth } from '@/lib/CtxProvider';
import { supabase } from '@/lib/supabase';
import BlurMoneyInput from '@/components/wizard/BlurMoneyInput';

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreditsSection() {
  const { colors } = useRobinhoodTheme();
  const { data, result, updateField, currentSubStep } = useTaxReturn();
  const { user } = useAuth();

  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [quarterlyPayments, setQuarterlyPayments] = useState<{ quarter: string; amount: number }[]>([]);

  // ─── Sub-step 0: Child Tax Credit ───────────────────────────────────────

  const renderCTC = () => {
    const ctc = result?.childTaxCredit ?? 0;
    const deps = data.dependents;
    const details = data.dependentDetails || [];

    const under17 = details.filter(d => {
      if (!d.dateOfBirth) return true;
      const parts = d.dateOfBirth.split('/');
      const year = parseInt(parts.length === 3 ? parts[2] : '0');
      return year >= 2009;
    }).length;
    const over17 = Math.max(0, deps - under17);

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Child Tax Credit</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Automatically calculated from your dependents.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.creditRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.creditLabel, { color: colors.text }]}>Under 17</Text>
              <Text style={[styles.creditDesc, { color: colors.textSecondary }]}>$2,000 CTC each</Text>
            </View>
            <Text style={[styles.creditAmount, { color: colors.primary }]}>{under17}</Text>
          </View>
          {over17 > 0 && (
            <View style={styles.creditRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.creditLabel, { color: colors.text }]}>17 or older</Text>
                <Text style={[styles.creditDesc, { color: colors.textSecondary }]}>$500 ODC each</Text>
              </View>
              <Text style={[styles.creditAmount, { color: colors.primary }]}>{over17}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total CTC</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>${ctc.toLocaleString()}</Text>
          </View>
        </View>

        {deps === 0 && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>No dependents. Add them in Personal Info.</Text>
          </View>
        )}
      </View>
    );
  };

  // ─── Sub-step 1: Education ───────────────────────────────────────────────

  const renderEducation = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Education Credits</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        The AOTC provides up to $2,500 per eligible student for the first 4 years of higher education.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BlurMoneyInput label="Qualified Education Expenses" value={data.educationExpenses} onSave={(v) => updateField('educationExpenses', v)} hint="Tuition, fees, course materials" />
      </View>
      {result && data.educationExpenses > 0 && (
        <View style={[styles.resultCard, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.resultLabel, { color: colors.text }]}>Education Credit</Text>
          <Text style={[styles.resultBig, { color: colors.primary }]}>${(result.educationCredit ?? 0).toLocaleString()}</Text>
        </View>
      )}
    </View>
  );

  // ─── Sub-step 2: Child Care ──────────────────────────────────────────────

  const renderChildCare = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Child & Dependent Care</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Credit for childcare expenses paid so you could work.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BlurMoneyInput label="Child Care Expenses" value={data.childCareExpenses} onSave={(v) => updateField('childCareExpenses', v)} hint="Max $3,000 (1 child) or $6,000 (2+)" />
      </View>
      {result && data.childCareExpenses > 0 && (
        <View style={[styles.resultCard, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.resultLabel, { color: colors.text }]}>Child Care Credit</Text>
          <Text style={[styles.resultBig, { color: colors.primary }]}>${(result.childCareCredit ?? 0).toLocaleString()}</Text>
        </View>
      )}
    </View>
  );

  // ─── Sub-step 3: EITC ───────────────────────────────────────────────────

  const renderEITC = () => {
    const eitc = result?.eitc ?? 0;
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Earned Income Tax Credit</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Refundable credit for lower and moderate income workers. Auto-calculated.
        </Text>
        <View style={[styles.resultCard, { backgroundColor: eitc > 0 ? colors.primary + '10' : colors.surface }]}>
          <Text style={[styles.resultLabel, { color: colors.text }]}>EITC Amount</Text>
          <Text style={[styles.resultBig, { color: eitc > 0 ? colors.primary : colors.textSecondary }]}>${eitc.toLocaleString()}</Text>
        </View>
        {eitc === 0 && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Based on your income, you don't qualify for EITC this year.</Text>
          </View>
        )}
      </View>
    );
  };

  // ─── Sub-step 4: Estimated Payments ──────────────────────────────────────

  useEffect(() => {
    if (currentSubStep !== 4 || !user?.id) return;
    (async () => {
      setPaymentsLoading(true);
      try {
        const { data: payments } = await supabase
          .from('tax_payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('tax_year', 2025)
          .order('quarter');
        if (payments && payments.length > 0) {
          const qp = payments.map((p: any) => ({ quarter: `Q${p.quarter}`, amount: p.amount || 0 }));
          setQuarterlyPayments(qp);
          const total = qp.reduce((s: number, q: { amount: number }) => s + q.amount, 0);
          if (total > 0 && data.estimatedTaxesPaid === 0) updateField('estimatedTaxesPaid', total);
        }
      } catch (err) {
        console.error('Load payments error:', err);
      } finally {
        setPaymentsLoading(false);
      }
    })();
  }, [currentSubStep, user?.id]);

  const renderEstimatedPayments = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Estimated Tax Payments</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Enter estimated tax payments made for 2025.
      </Text>

      {paymentsLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading payments...</Text>
        </View>
      )}

      {quarterlyPayments.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Tracked Payments</Text>
          {quarterlyPayments.map((q, i) => (
            <View key={i} style={styles.qRow}>
              <Text style={[styles.qLabel, { color: colors.text }]}>{q.quarter}</Text>
              <Text style={[styles.qValue, { color: colors.primary }]}>${q.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BlurMoneyInput label="Total Estimated Taxes Paid" value={data.estimatedTaxesPaid} onSave={(v) => updateField('estimatedTaxesPaid', v)} hint="All quarterly payments for 2025" />
      </View>

      {result && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Total Payments & Withholding</Text>
          <View style={styles.qRow}>
            <Text style={[styles.qLabel, { color: colors.textSecondary }]}>W-2 Withholding</Text>
            <Text style={[styles.qValue, { color: colors.text }]}>${data.w2Incomes.reduce((s, w) => s + w.withheld, 0).toLocaleString()}</Text>
          </View>
          <View style={styles.qRow}>
            <Text style={[styles.qLabel, { color: colors.textSecondary }]}>1099 Withholding</Text>
            <Text style={[styles.qValue, { color: colors.text }]}>${data.income1099.reduce((s, f) => s + (f.withheld || 0), 0).toLocaleString()}</Text>
          </View>
          <View style={styles.qRow}>
            <Text style={[styles.qLabel, { color: colors.textSecondary }]}>Estimated Payments</Text>
            <Text style={[styles.qValue, { color: colors.text }]}>${data.estimatedTaxesPaid.toLocaleString()}</Text>
          </View>
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>${result.totalWithholding.toLocaleString()}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const steps = [renderCTC, renderEducation, renderChildCare, renderEITC, renderEstimatedPayments];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {steps[currentSubStep]?.() ?? steps[0]()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepContainer: { gap: 16 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  creditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  creditLabel: { fontSize: 15, fontWeight: '600' },
  creditDesc: { fontSize: 12, marginTop: 2 },
  creditAmount: { fontSize: 20, fontWeight: '700', marginLeft: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 8, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 22, fontWeight: '700' },
  resultCard: { borderRadius: 14, padding: 20, alignItems: 'center', gap: 4 },
  resultLabel: { fontSize: 14, fontWeight: '500' },
  resultBig: { fontSize: 32, fontWeight: '800' },
  infoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  infoText: { fontSize: 13, flex: 1 },
  qRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  qLabel: { fontSize: 14 },
  qValue: { fontSize: 15, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  loadingText: { fontSize: 14 },
});
