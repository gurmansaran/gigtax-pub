/**
 * ReviewSection — Wizard Section 5
 * Sub-steps: Tax Summary, Refund/Owed Display, Section Edit Cards, PDF Generation
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Pressable,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useTaxReturn } from '@/lib/TaxReturnContext';
import { useTaxProfile } from '@/lib/CtxProvider';
import { WIZARD_SECTIONS } from '@/lib/wizardSections';
import TaxBreakdown from '@/components/wizard/TaxBreakdown';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReviewSection() {
  const { colors } = useRobinhoodTheme();
  const { data, result, currentSubStep, goToSection, completeReturn } = useTaxReturn();
  const { taxProfile } = useTaxProfile();

  const [generating, setGenerating] = useState<string | null>(null);
  const [mailingInstructions, setMailingInstructions] = useState<string | null>(null);
  const [packageFormCount, setPackageFormCount] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ─── Share helper ──────────────────────────────────────────────────────────

  const shareFile = async (path: string, title: string) => {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, {
        mimeType: 'application/pdf',
        dialogTitle: title,
      });
    } else {
      Alert.alert('Saved', `PDF saved to:\n${path}`);
    }
  };

  // ─── Summary Row ─────────────────────────────────────────────────────────

  const SummaryRow = ({ label, value, bold, highlight, negative }: {
    label: string; value: number; bold?: boolean; highlight?: boolean; negative?: boolean;
  }) => (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: bold ? colors.text : colors.textSecondary }, bold && { fontWeight: '600' }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: highlight ? colors.primary : negative ? colors.error : colors.text }, bold && { fontWeight: '700', fontSize: 16 }]}>
        {negative && value > 0 ? '-' : ''}${Math.abs(Math.round(value)).toLocaleString()}
      </Text>
    </View>
  );

  // ─── Sub-step 0: Tax Summary ─────────────────────────────────────────────

  const renderSummary = () => {
    if (!result) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Tax Summary</Text>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Tax Summary</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Complete breakdown of your 2025 return.</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Income</Text>
          <SummaryRow label="Gross Income" value={result.grossIncome} bold />
          {result.totalTips > 0 && <SummaryRow label="Total Tips" value={result.totalTips} />}
          {result.tipDeduction > 0 && <SummaryRow label="Tip Deduction" value={result.tipDeduction} negative />}
          <SummaryRow label="AGI" value={result.agi} bold highlight />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Deductions</Text>
          <SummaryRow label={`${result.deductionMethod} Deduction`} value={result.deductionAmount} />
          {result.qbiDeduction > 0 && <SummaryRow label="QBI Deduction" value={result.qbiDeduction} />}
          {result.seTaxDeduction > 0 && <SummaryRow label="SE Tax Deduction" value={result.seTaxDeduction} />}
          {result.homeOfficeDeduction > 0 && <SummaryRow label="Home Office" value={result.homeOfficeDeduction} />}
          {result.iraDeduction > 0 && <SummaryRow label="IRA" value={result.iraDeduction} />}
          {result.hsaDeduction > 0 && <SummaryRow label="HSA" value={result.hsaDeduction} />}
          <SummaryRow label="Taxable Income" value={result.taxableIncome} bold highlight />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Taxes</Text>
          <SummaryRow label="Federal Income Tax" value={result.tentativeTax - result.ltcgTax} />
          {result.seTax > 0 && <SummaryRow label="Self-Employment Tax" value={result.seTax} />}
          {result.ltcgTax > 0 && <SummaryRow label="Capital Gains Tax" value={result.ltcgTax} />}
          {result.niit > 0 && <SummaryRow label="NIIT" value={result.niit} />}
          {result.workStateTax > 0 ? (
            <>
              <SummaryRow label={`${data.workState} Tax (nonresident)`} value={result.workStateTax} />
              <SummaryRow label={`${data.stateOfResidence} Tax (before credit)`} value={result.homeStateTaxBeforeCredit} />
              <SummaryRow label={`Credit for ${data.workState} tax paid`} value={result.otherStateCredit} negative />
              <SummaryRow label={`${data.stateOfResidence} Tax (after credit)`} value={result.homeStateTaxAfterCredit} />
            </>
          ) : (
            result.estimatedStateTax > 0 && <SummaryRow label={`State Tax (${data.stateOfResidence || 'Est.'})`} value={result.estimatedStateTax} />
          )}
          {result.caSDI > 0 && <SummaryRow label="CA SDI (included above)" value={result.caSDI} />}
          <SummaryRow label="Total Tax" value={result.totalTax} bold />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Credits & Payments</Text>
          {result.childTaxCredit > 0 && <SummaryRow label="Child Tax Credit" value={result.childTaxCredit} />}
          {result.educationCredit > 0 && <SummaryRow label="Education Credit" value={result.educationCredit} />}
          {result.childCareCredit > 0 && <SummaryRow label="Child Care Credit" value={result.childCareCredit} />}
          {result.eitc > 0 && <SummaryRow label="EITC" value={result.eitc} />}
          {result.saversCredit > 0 && <SummaryRow label="Saver's Credit" value={result.saversCredit} />}
          {result.premiumTaxCredit > 0 && <SummaryRow label="Premium Tax Credit (ACA)" value={result.premiumTaxCredit} />}
          {result.excessAPTC > 0 && <SummaryRow label="Excess APTC Repayment" value={result.excessAPTC} negative />}
          <SummaryRow label="Total Withholding" value={result.totalWithholding} />
        </View>

        {/* ── How We Calculate Everything ─────────────────────────────── */}
        <TouchableOpacity
          style={[styles.breakdownToggle, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '30' }]}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowBreakdown(!showBreakdown);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.breakdownToggleIcon, { backgroundColor: colors.primary + '15' }]}>
            <Feather name="cpu" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.breakdownToggleTitle, { color: colors.text }]}>
              {showBreakdown ? 'Hide Calculation Details' : 'How We Calculate Everything'}
            </Text>
            <Text style={[styles.breakdownToggleDesc, { color: colors.textSecondary }]}>
              {showBreakdown ? 'Collapse the detailed breakdown' : 'Step-by-step tax math, brackets, rates, and more'}
            </Text>
          </View>
          <Feather
            name={showBreakdown ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>

        {showBreakdown && <TaxBreakdown data={data} result={result} />}
      </View>
    );
  };

  // ─── PDF Generation ────────────────────────────────────────────────────────

  const buildProfileData = () => ({
    firstName: taxProfile.firstName,
    lastName: taxProfile.lastName,
    ssn: taxProfile.fullSSN || taxProfile.ssn,
    address: taxProfile.address,
    city: taxProfile.city,
    state: taxProfile.state,
    zip: taxProfile.zip,
    dateOfBirth: taxProfile.dateOfBirth,
    spouseName: taxProfile.spouseName,
    spouseSSN: taxProfile.spouseSSN,
    phone: taxProfile.phone,
    email: taxProfile.email,
  });

  const handlePDF = useCallback(async (type: 'draft' | '1040' | 'package') => {
    setGenerating(type);
    try {
      if (type === 'package') {
        const { generateTaxFormPackage } = require('@/lib/taxForms/formPackageGenerator');
        const pkg = await generateTaxFormPackage(data, result, buildProfileData());

        // Convert Uint8Array to base64 and save
        let binary = '';
        for (let i = 0; i < pkg.combinedPdfBytes.length; i++) {
          binary += String.fromCharCode(pkg.combinedPdfBytes[i]);
        }
        const b64 = btoa(binary);
        const filename = `gigtax_tax_return_${Date.now()}.pdf`;
        const path = `${documentDirectory}${filename}`;
        await writeAsStringAsync(path, b64, { encoding: 'base64' });

        setMailingInstructions(pkg.mailingInstructions);
        setPackageFormCount(pkg.formList.length);
        await shareFile(path, 'GigTax Complete Tax Return');
      } else if (type === 'draft') {
        const { generateTaxPDF } = require('@/lib/formGenerator');
        const profile = { firstName: taxProfile.firstName, lastName: taxProfile.lastName, address: taxProfile.address, city: taxProfile.city, state: taxProfile.state, zip: taxProfile.zip, ssn: taxProfile.ssn, filingStatus: data.filingStatus };
        const uri = await generateTaxPDF(profile, result, [], [], null);
        if (uri) await shareFile(uri, 'GigTax Draft Return');
      } else {
        const { fill1040Form } = require('@/lib/pdfGenerator');
        const w2Total = data.w2Incomes.reduce((s, w) => s + w.wages, 0);
        const w2With = data.w2Incomes.reduce((s, w) => s + w.withheld, 0);
        const res = await fill1040Form({
          ...buildProfileData(),
          filingStatus: data.filingStatus, w2Wages: w2Total, totalIncome: result?.grossIncome ?? 0,
          agi: result?.agi ?? 0, standardDeduction: result?.deductionAmount ?? 0,
          taxableIncome: result?.taxableIncome ?? 0, tax: result?.federalTax ?? 0,
          totalWithholding: w2With + data.estimatedTaxesPaid, refundOrAmountOwed: result?.finalBillOrRefund ?? 0,
          taxReturn: data, result: result ?? undefined,
        });
        if (res?.path) await shareFile(res.path, 'IRS Form 1040');
      }
    } catch (err) {
      console.error('PDF error:', err);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(null);
    }
  }, [data, result, taxProfile]);

  // ─── Sub-step 1: Refund / Owed ───────────────────────────────────────────

  const renderRefund = () => {
    if (!result) return null;
    const amount = result.finalBillOrRefund;
    const isRefund = amount > 0;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>{isRefund ? 'Your Refund' : 'Amount Owed'}</Text>

        <View style={[styles.bigCard, {
          backgroundColor: isRefund ? colors.primary + '10' : colors.error + '10',
          borderColor: isRefund ? colors.primary : colors.error,
        }]}>
          <Feather name={isRefund ? 'arrow-down-circle' : 'arrow-up-circle'} size={40} color={isRefund ? colors.primary : colors.error} />
          <Text style={[styles.bigLabel, { color: isRefund ? colors.primary : colors.error }]}>
            {isRefund ? 'Estimated Federal Refund' : 'Estimated Amount Owed'}
          </Text>
          <Text style={[styles.bigAmount, { color: isRefund ? colors.primary : colors.error }]}>
            ${Math.abs(Math.round(amount)).toLocaleString()}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Effective Tax Rates</Text>
          <View style={styles.rateRow}><Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Federal</Text><Text style={[styles.rateValue, { color: colors.text }]}>{result.effectiveFederalRate.toFixed(1)}%</Text></View>
          {result.effectiveStateRate > 0 && <View style={styles.rateRow}><Text style={[styles.rateLabel, { color: colors.textSecondary }]}>State</Text><Text style={[styles.rateValue, { color: colors.text }]}>{result.effectiveStateRate.toFixed(1)}%</Text></View>}
          <View style={styles.rateRow}><Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Combined</Text><Text style={[styles.rateValue, { color: colors.primary }]}>{result.effectiveTotalRate.toFixed(1)}%</Text></View>
        </View>

        {result.quarterlyEstimate > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>2026 Quarterly Estimate</Text>
            <Text style={[styles.quarterAmt, { color: colors.primary }]}>${result.quarterlyEstimate.toLocaleString()} / quarter</Text>
            <Text style={[styles.quarterHint, { color: colors.textSecondary }]}>Pay quarterly to avoid penalties next year.</Text>
          </View>
        )}

        {result.penaltyRisk.isAtRisk && (
          <View style={[styles.warningCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
            <Feather name="alert-triangle" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: 15, fontWeight: '700', marginBottom: 4, color: colors.warning }]}>Underpayment Penalty Risk</Text>
              <Text style={[{ fontSize: 13, lineHeight: 18, color: colors.warning }]}>
                Required: ${result.penaltyRisk.requiredPayment.toLocaleString()} · Paid: ${result.penaltyRisk.currentPayment.toLocaleString()}
              </Text>
              {result.penaltyRisk.estimatedPenalty > 0 && (
                <Text style={[{ fontSize: 13, lineHeight: 18, color: colors.warning, marginTop: 4, fontWeight: '600' }]}>
                  Estimated Form 2210 Penalty: ${result.penaltyRisk.estimatedPenalty.toLocaleString()} (IRS rate: {(result.penaltyRisk.annualizedRate * 100).toFixed(0)}%)
                </Text>
              )}
              <Text style={[{ fontSize: 12, lineHeight: 16, color: colors.warning, marginTop: 4 }]}>
                Shortfall: ${result.penaltyRisk.shortfall.toLocaleString()}. Consider increasing quarterly estimated payments.
              </Text>
            </View>
          </View>
        )}

        {/* ── Download Tax Return ─────────────────────────────────────── */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Download Your Return</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Print, sign, and mail to the IRS.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
          onPress={() => handlePDF('package')}
          disabled={!!generating}
          activeOpacity={0.8}
        >
          {generating === 'package' ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Feather name="download" size={20} color={colors.background} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.downloadBtnTitle, { color: colors.background }]}>Download Tax Return</Text>
            <Text style={[styles.downloadBtnDesc, { color: colors.background + 'BB' }]}>
              Form 1040 + all schedules as one PDF
            </Text>
          </View>
          <Feather name="arrow-right" size={18} color={colors.background} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handlePDF('1040')}
          disabled={!!generating}
          activeOpacity={0.7}
        >
          {generating === '1040' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="file" size={20} color={colors.primary} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.exportTitle, { color: colors.text }]}>Form 1040 Only</Text>
            <Text style={[styles.exportDesc, { color: colors.textSecondary }]}>Official IRS form with your data</Text>
          </View>
          <Feather name="download" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Sub-step 2: Edit Cards ──────────────────────────────────────────────

  const getSummaryText = (id: number): string => {
    switch (id) {
      case 0: return `${data.filingStatus.replace('_', ' ')} · ${data.stateOfResidence || 'No state'} · ${data.dependents} dep`;
      case 1: {
        const w2 = data.w2Incomes.reduce((s, w) => s + w.wages, 0);
        const f = data.income1099.reduce((s, x) => s + x.grossAmount, 0);
        return `W-2: $${w2.toLocaleString()} · 1099: $${f.toLocaleString()}`;
      }
      case 2: return `Business: $${data.businessExpenses.toLocaleString()} · Parking: $${data.parkingAndTolls.toLocaleString()}`;
      case 3: return `${data.deductionType} · Student loan: $${data.studentLoanInterest.toLocaleString()}`;
      case 4: return `Est. payments: $${data.estimatedTaxesPaid.toLocaleString()}`;
      default: return '';
    }
  };

  const renderEditCards = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Review Your Entries</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Tap a section to edit.</Text>

      {WIZARD_SECTIONS.slice(0, 5).map((s) => (
        <TouchableOpacity key={s.id} style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => goToSection(s.id, 0)} activeOpacity={0.7}>
          <View style={[styles.editIcon, { backgroundColor: colors.primary + '15' }]}>
            <Feather name={s.icon as any} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.editTitle, { color: colors.text }]}>{s.title}</Text>
            <Text style={[styles.editDesc, { color: colors.textSecondary }]} numberOfLines={1}>{getSummaryText(s.id)}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Sub-step 3: Export ──────────────────────────────────────────────────

  const handleComplete = useCallback(() => {
    Alert.alert('Complete Tax Return', 'Mark your return as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete', onPress: async () => {
          try { await completeReturn(); Alert.alert('Success', 'Tax return completed!'); }
          catch { Alert.alert('Error', 'Save failed.'); }
        }
      },
    ]);
  }, [completeReturn]);

  const renderExport = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Generate & Export</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Download your tax forms to print, sign, and mail.</Text>

      <TouchableOpacity
        style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
        onPress={() => handlePDF('package')}
        disabled={!!generating}
        activeOpacity={0.8}
      >
        {generating === 'package' ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Feather name="package" size={22} color={colors.background} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.downloadBtnTitle, { color: colors.background }]}>Download Complete Tax Return</Text>
          <Text style={[styles.downloadBtnDesc, { color: colors.background + 'BB' }]}>
            Form 1040 + all required schedules — print, sign & mail
          </Text>
        </View>
        {generating === 'package' ? null : <Feather name="download" size={20} color={colors.background} />}
      </TouchableOpacity>

      {mailingInstructions && (
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setMailingInstructions(mailingInstructions)}
        >
          <Feather name="mail" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.exportTitle, { color: colors.text }]}>View Mailing Instructions</Text>
            <Text style={[styles.exportDesc, { color: colors.textSecondary }]}>
              {packageFormCount} forms generated — step-by-step mailing guide
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handlePDF('1040')}
        disabled={!!generating}
      >
        {generating === '1040' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather name="file" size={22} color={colors.primary} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.exportTitle, { color: colors.text }]}>IRS Form 1040 Only</Text>
          <Text style={[styles.exportDesc, { color: colors.textSecondary }]}>Official IRS form with your data filled in</Text>
        </View>
        {generating === '1040' ? null : <Feather name="download" size={18} color={colors.primary} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handlePDF('draft')}
        disabled={!!generating}
      >
        {generating === 'draft' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather name="file-text" size={22} color={colors.primary} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.exportTitle, { color: colors.text }]}>Draft Summary PDF</Text>
          <Text style={[styles.exportDesc, { color: colors.textSecondary }]}>Full tax breakdown for your records</Text>
        </View>
        {generating === 'draft' ? null : <Feather name="download" size={18} color={colors.primary} />}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.completeBtn, { backgroundColor: colors.primary }]} onPress={handleComplete}>
        <Feather name="check-circle" size={20} color={colors.background} />
        <Text style={[styles.completeBtnText, { color: colors.background }]}>Mark Return as Complete</Text>
      </TouchableOpacity>

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
        GigTax does not e-file with the IRS. Print your forms, sign, and mail to the IRS address shown in the mailing instructions.
      </Text>

      <Modal visible={!!mailingInstructions} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.title, { color: colors.text, fontSize: 20 }]}>Mailing Instructions</Text>
            <Pressable onPress={() => setMailingInstructions(null)} hitSlop={12}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 20 }}>
            <Text style={[styles.monoText, { color: colors.text }]}>{mailingInstructions}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );

  const steps = [renderSummary, renderRefund, renderEditCards, renderExport];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {steps[currentSubStep]?.() ?? steps[0]()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  stepContainer: { gap: 16 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 15, fontWeight: '500' },
  card: { borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  bigCard: { borderRadius: 20, padding: 32, borderWidth: 2, alignItems: 'center', gap: 12 },
  bigLabel: { fontSize: 14, fontWeight: '600' },
  bigAmount: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rateLabel: { fontSize: 14 },
  rateValue: { fontSize: 16, fontWeight: '600' },
  quarterAmt: { fontSize: 24, fontWeight: '700', marginVertical: 4 },
  quarterHint: { fontSize: 13 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  sectionLabel: { fontSize: 17, fontWeight: '700' },
  sectionHint: { fontSize: 13, marginTop: 2 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 18, gap: 14 },
  downloadBtnTitle: { fontSize: 16, fontWeight: '700' },
  downloadBtnDesc: { fontSize: 12, marginTop: 2 },
  editCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  editIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  editTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  editDesc: { fontSize: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1, gap: 14 },
  exportTitle: { fontSize: 15, fontWeight: '600' },
  exportDesc: { fontSize: 12, marginTop: 2 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 18, gap: 8, marginTop: 8 },
  completeBtnText: { fontSize: 17, fontWeight: '700' },
  disclaimer: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 8 },
  modalScroll: { flex: 1 },
  monoText: { fontFamily: 'Courier', fontSize: 12, lineHeight: 20 },
  breakdownToggle: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  breakdownToggleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  breakdownToggleTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  breakdownToggleDesc: { fontSize: 12 },
});
