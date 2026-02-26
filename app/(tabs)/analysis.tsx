import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { getTrips } from '@/lib/tripStore';
import { calculateTaxReturn, type TaxInput, type TaxOutput, type FilingStatus } from '@/lib/unifiedTaxEngine';
import { getExpenses, getTotalExpenses } from '@/lib/expenseStore';
import { generateTaxPDF } from '@/lib/formGenerator';
import { scheduleQuarterlyReminders } from '@/lib/reminderService';
import {
  getNextQuarterlyDueDate,
  recordTaxPayment,
  getTotalPaidForYear,
  type TaxPayment,
} from '@/lib/taxPaymentsService';
import { useTaxProfile } from '@/lib/CtxProvider';
import { useAuth } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

type DashboardTaxResult = TaxOutput & {
  totalSavings: number;
  baselineTax: number;
};

function formatMoney(amount: number) {
  const rounded = Math.round(amount);
  return `$${rounded.toLocaleString()}`;
}

export default function AnalysisScreen() {
  const { taxProfile } = useTaxProfile();
  const { user } = useAuth();
  const { colors } = useRobinhoodTheme();

  const [taxResult, setTaxResult] = useState<DashboardTaxResult | null>(null);
  const [totalMiles, setTotalMiles] = useState(0);
  const [realGigIncome, setRealGigIncome] = useState(0); // Changed from estimatedGigIncome to realGigIncome
  const [totalManualExpenses, setTotalManualExpenses] = useState(0);
  const [trips, setTrips] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalPaid, setTotalPaid] = useState(0);
  const [nextDueDate, setNextDueDate] = useState<{ date: string; quarter: string; label: string } | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const profileFilingStatus: FilingStatus = useMemo(() => {
    if (taxProfile?.filingStatus === 'married_joint') return 'married_joint';
    return 'single';
  }, [taxProfile?.filingStatus]);

  const profileW2Income = taxProfile?.w2Income ?? 0;
  const hasRetirementPlan = taxProfile?.hasRetirementPlan ?? false;

  const refresh = useCallback(async () => {
    if (!user) return;

    const tripsList = await getTrips();
    setTrips(tripsList);
    const currentYearMiles = tripsList.reduce((sum, t) => sum + (t.miles || 0), 0);
    setTotalMiles(currentYearMiles);

    // Calculate real earnings from trips (sum of all trip.earnings)
    const calculatedRealGigIncome = tripsList.reduce((sum, t) => sum + (t.earnings || 0), 0);
    
    // Use real earnings, or fallback to 0 if no trips with earnings yet
    const gigIncome = calculatedRealGigIncome > 0 ? calculatedRealGigIncome : 0;
    setRealGigIncome(gigIncome);

    const expenses = await getTotalExpenses();
    setTotalManualExpenses(expenses);
    const expensesList = await getExpenses();
    setExpenses(expensesList);

    // Get tax payments
    const currentYear = new Date().getFullYear();
    const paid = await getTotalPaidForYear(user.id, currentYear);
    setTotalPaid(paid);

    // Get next due date
    const nextDue = getNextQuarterlyDueDate();
    setNextDueDate(nextDue);

    const baseInput: TaxInput = {
      filingStatus: profileFilingStatus,
      gigIncome: gigIncome, // Use real earnings instead of estimate
      gigExpenses: { miles: currentYearMiles, actual: 0, other: expenses },
      w2Income: { self: profileW2Income, spouse: 0 },
      capitalGains: { shortTerm: 0, longTerm: 0 },
      iraContributions: { self: 0, spouse: 0 },
      isRetirementPlanActive: { self: hasRetirementPlan, spouse: false },
      state: 'CA',
    };

    const withGigTax = calculateTaxReturn(baseInput);
    const withoutGigTax = calculateTaxReturn({
      ...baseInput,
      gigExpenses: { miles: 0, actual: 0, other: 0 },
    });

    const totalSavings = Math.max(0, withoutGigTax.totalTax - withGigTax.totalTax);

    const result = {
      ...withGigTax,
      totalSavings,
      baselineTax: withoutGigTax.totalTax,
    };
    setTaxResult(result);

      // Schedule quarterly reminders when tax result is calculated
      if (result.quarterlyPayment > 0) {
        scheduleQuarterlyReminders(result.quarterlyPayment).catch(console.error);
      }
  }, [profileFilingStatus, profileW2Income, hasRetirementPlan, user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const mileageDeduction = useMemo(() => totalMiles * 0.7, [totalMiles]);

  const handleMarkAsPaid = useCallback(async () => {
    if (!user || !taxResult || !nextDueDate) return;

    setIsMarkingPaid(true);
    try {
      const currentYear = new Date().getFullYear();
      await recordTaxPayment(
        user.id,
        taxResult.quarterlyPayment,
        nextDueDate.quarter as 'Q1' | 'Q2' | 'Q3' | 'Q4',
        currentYear
      );

      Alert.alert('Payment Recorded', 'Your quarterly payment has been recorded successfully.');
      await refresh(); // Refresh to update totals
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record payment');
    } finally {
      setIsMarkingPaid(false);
    }
  }, [user, taxResult, nextDueDate, refresh]);

  const handleGenerate = useCallback(async () => {
    if (!taxResult || !user) return;
    setIsGenerating(true);
    try {
      const result = await generateTaxPDF(
        {
          filingStatus: profileFilingStatus,
          w2Income: profileW2Income,
          hasRetirementPlan,
          gigIncome: realGigIncome,
          firstName: taxProfile?.firstName ?? '',
          lastName: taxProfile?.lastName ?? '',
          address: taxProfile?.address ?? '',
          city: taxProfile?.city ?? '',
          state: taxProfile?.state ?? '',
          zip: taxProfile?.zip ?? '',
          fullSSN: taxProfile?.fullSSN ?? '',
        },
        taxResult,
        trips,
        expenses,
        user.id
      );

      if (result.cloudUrl) {
        Alert.alert(
          'Tax Forms Generated',
          'Your tax forms have been generated and stored securely in the cloud. You\'re audit-ready!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Forms Generated',
          'Forms generated locally, but cloud storage failed. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      Alert.alert('Could not generate forms', e?.message ?? 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [
    taxResult,
    user,
    profileFilingStatus,
    profileW2Income,
    hasRetirementPlan,
    realGigIncome,
    taxProfile,
    trips,
    expenses,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Tax Command Center</Text>
            <Text style={styles.subtitle}>Real-time estimates based on your mileage log</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>2025 Tax Year</Text>
          </View>
        </View>

        {!taxResult ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>Calculating…</Text>
            <Text style={styles.loadingSubtext}>Pulling your trips and rebuilding your estimate.</Text>
          </View>
        ) : (
          <>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Current Estimated Tax Bill</Text>
              <Text style={styles.heroValue}>
                {formatMoney(Math.max(0, taxResult.totalTax - totalPaid))}
              </Text>
              {totalPaid > 0 && (
                <Text style={styles.heroSubPaid}>
                  Total: {formatMoney(taxResult.totalTax)} • Paid: {formatMoney(totalPaid)}
                </Text>
              )}
              <Text style={styles.heroSub}>
                Effective Tax Rate: {taxResult.effectiveRate.toFixed(1)}%
              </Text>
            </View>

            {/* Savings Card */}
            <View style={styles.savingsCard}>
              <Text style={styles.savingsLabel}>Total Savings Found</Text>
              <Text style={styles.savingsValue}>{formatMoney(taxResult.totalSavings)}</Text>
              <Text style={styles.savingsSub}>
                You would owe {formatMoney(taxResult.baselineTax)} without GigTax.
              </Text>
            </View>

            {/* Quarterly Tax Card */}
            <View style={styles.quarterlyCard}>
              <Text style={styles.quarterlyLabel}>
                Next Payment Due: {nextDueDate?.label || 'Q1 2025'}
              </Text>
              <Text style={styles.quarterlyValue}>{formatMoney(taxResult.quarterlyPayment)}</Text>
              <Text style={styles.quarterlySub}>
                Due: {nextDueDate?.date ? new Date(nextDueDate.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Apr 15'}
              </Text>
              <TouchableOpacity
                style={[styles.markPaidButton, isMarkingPaid && styles.markPaidButtonDisabled]}
                onPress={handleMarkAsPaid}
                disabled={isMarkingPaid || !user}>
                {isMarkingPaid ? (
                  <ActivityIndicator color="#1F2937" />
                ) : (
                  <View style={styles.markPaidButtonContent}>
                    <Feather name="check-circle" size={18} color="#1F2937" />
                    <Text style={styles.markPaidButtonText}>Record Payment</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Remaining Balance Card */}
            {totalPaid > 0 && (
              <View style={styles.remainingCard}>
                <Text style={styles.remainingLabel}>Remaining Balance</Text>
                <Text style={styles.remainingValue}>
                  {formatMoney(Math.max(0, taxResult.totalTax - totalPaid))}
                </Text>
                <Text style={styles.remainingSub}>
                  Total Tax: {formatMoney(taxResult.totalTax)} • Paid: {formatMoney(totalPaid)}
                </Text>
              </View>
            )}

            {/* Deduction Breakdown */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Deduction Breakdown</Text>

              <View style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>Mileage Deduction</Text>
                  <Text style={styles.rowSub}>
                    {totalMiles.toFixed(1)} miles × $0.70
                  </Text>
                </View>
                <Text style={styles.rowValue}>{formatMoney(mileageDeduction)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>Standard Deduction</Text>
                  <Text style={styles.rowSub}>
                    {profileFilingStatus === 'married_joint' ? 'Married Filing Joint' : 'Single'}
                  </Text>
                </View>
                <Text style={styles.rowValue}>
                  {formatMoney(taxResult.deductionsBreakdown.standardDeduction)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.divider} />

              <View style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>Business Expenses</Text>
                  <Text style={styles.rowSub}>Manual write-offs</Text>
                </View>
                <Text style={styles.rowValue}>{formatMoney(totalManualExpenses)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>QBI Deduction</Text>
                  <Text style={styles.rowSub}>20% pass-through (simplified)</Text>
                </View>
                <Text style={styles.rowValue}>{formatMoney(taxResult.deductionsBreakdown.qbiDeduction)}</Text>
              </View>
            </View>

            {/* Filing Actions */}
            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>Filing Actions</Text>
              <TouchableOpacity
                style={[styles.primaryButton, isGenerating && styles.primaryButtonDisabled]}
                onPress={handleGenerate}
                disabled={!taxResult || isGenerating}
                activeOpacity={0.85}>
                {isGenerating ? (
                  <View style={styles.buttonRow}>
                    <ActivityIndicator color="#1F2937" />
                    <Text style={styles.primaryButtonText}>Generating…</Text>
                  </View>
                ) : (
                  <View style={styles.buttonRow}>
                    <Feather name="file-text" size={18} color="#1F2937" />
                    <Text style={styles.primaryButtonText}>Generate Tax Forms</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.actionsSubtext}>
                Generates and stores your tax forms securely in the cloud. You're audit-ready.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 20,
    fontWeight: '400',
  },
  badge: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  loadingCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 20,
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  loadingSubtext: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  heroCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  heroLabel: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
  },
  heroValue: {
    color: '#EF4444',
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroSub: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '400',
  },
  heroSubPaid: {
    color: '#10B981',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '400',
  },
  savingsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  savingsLabel: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
  },
  savingsValue: {
    color: '#10B981',
    fontSize: 40,
    fontWeight: '600',
    marginBottom: 8,
  },
  savingsSub: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  quarterlyCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  markPaidButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  markPaidButtonDisabled: {
    opacity: 0.7,
  },
  markPaidButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markPaidButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  remainingCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  remainingLabel: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
  },
  remainingValue: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 6,
  },
  remainingSub: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
  },
  quarterlyLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
  },
  quarterlyValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '600',
    marginBottom: 6,
  },
  quarterlySub: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  breakdownCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  breakdownTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 4,
  },
  rowSub: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
  },
  rowValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 14,
  },
  actionsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: 16,
  },
  actionsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#C6FF5E', // Neon Green
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#000000', // Black text on green
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionsSubtext: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: '400',
  },
});

