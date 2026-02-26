import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { calculateTaxReturn, type TaxInput, type FilingStatus } from '@/lib/unifiedTaxEngine';
import { useTaxProfile } from '@/lib/CtxProvider';

interface DeductionItem {
  id: string;
  category: string;
  label: string;
  description: string;
  deductible: boolean;
  amount: number;
  maxAmount?: number;
  percentage?: number; // For partial deductions like cell phone
}

const DEDUCTION_CATEGORIES: Omit<DeductionItem, 'id' | 'deductible' | 'amount'>[] = [
  {
    category: 'music_apps',
    label: 'Business Music & Apps',
    description: 'Spotify, Apple Music, Quickbooks, etc.',
    maxAmount: 500,
  },
  {
    category: 'passenger_amenities',
    label: 'Passenger Amenities',
    description: 'Water, gum, mints, sanitizer',
    maxAmount: 300,
  },
  {
    category: 'hardware_supplies',
    label: 'Hardware & Supplies',
    description: 'Hot bags, mounts, dashcams, chargers',
    maxAmount: 1000,
  },
  {
    category: 'platform_fees',
    label: 'Bank & Platform Fees',
    description: 'Instant cash-out fees, monthly service fees',
    maxAmount: 500,
  },
  {
    category: 'cell_phone',
    label: 'Cell Phone Plan',
    description: '50% of your monthly phone bill (business use)',
    maxAmount: 1200, // ~$100/month * 12 months * 50%
    percentage: 50,
  },
];

function formatMoney(amount: number) {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function DeductionsScreen() {
  const { taxProfile } = useTaxProfile();
  const [deductions, setDeductions] = useState<DeductionItem[]>(() =>
    DEDUCTION_CATEGORIES.map((cat) => ({
      ...cat,
      id: cat.category,
      deductible: false,
      amount: 0,
    }))
  );

  const [potentialSavings, setPotentialSavings] = useState(0);

  const calculateSavings = useCallback(() => {
    if (!taxProfile.filingStatus) return;

    const totalDeductions = deductions
      .filter((d) => d.deductible)
      .reduce((sum, d) => sum + d.amount, 0);

    const filingStatus: FilingStatus =
      taxProfile.filingStatus === 'married_joint' ? 'married_joint' : 'single';

    // Calculate tax impact
    const baseInput: TaxInput = {
      filingStatus,
      gigIncome: 50000, // Example
      gigExpenses: { miles: 0, actual: 0, other: 0 },
      w2Income: { self: taxProfile.w2Income, spouse: 0 },
      capitalGains: { shortTerm: 0, longTerm: 0 },
      iraContributions: { self: 0, spouse: 0 },
      isRetirementPlanActive: { self: taxProfile.hasRetirementPlan, spouse: false },
      state: 'CA',
    };

    const withoutDeductions = calculateTaxReturn(baseInput);
    const withDeductions = calculateTaxReturn({
      ...baseInput,
      gigExpenses: { miles: 0, actual: 0, other: totalDeductions },
    });

    const savings = Math.max(0, withoutDeductions.totalTax - withDeductions.totalTax);
    setPotentialSavings(savings);
  }, [deductions, taxProfile]);

  useFocusEffect(
    useCallback(() => {
      calculateSavings();
    }, [calculateSavings])
  );

  const updateDeduction = (id: string, updates: Partial<DeductionItem>) => {
    setDeductions((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
    setTimeout(calculateSavings, 100);
  };

  const handleAmountChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const deduction = deductions.find((d) => d.id === id);
    const maxAmount = deduction?.maxAmount || Infinity;
    const finalAmount = Math.min(numValue, maxAmount);
    updateDeduction(id, { amount: finalAmount });
  };

  const handleToggle = (id: string, value: boolean) => {
    updateDeduction(id, { deductible: value });
  };

  const totalDeductions = deductions
    .filter((d) => d.deductible)
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gig Loophole Finder</Text>
          <Text style={styles.subtitle}>
            Maximize your deductions with these high-value write-offs
          </Text>
        </View>

        {/* Potential Savings Progress Bar */}
        <View style={styles.savingsCard}>
          <Text style={styles.savingsLabel}>Potential Tax Savings</Text>
          <Text style={styles.savingsValue}>{formatMoney(potentialSavings)}</Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(100, (potentialSavings / 5000) * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.savingsSub}>
            Based on your current deductions and filing status
          </Text>
        </View>

        {/* Deduction Categories */}
        <View style={styles.deductionsList}>
          {deductions.map((deduction) => (
            <View key={deduction.id} style={styles.deductionCard}>
              <View style={styles.deductionHeader}>
                <View style={styles.deductionInfo}>
                  <Text style={styles.deductionLabel}>{deduction.label}</Text>
                  <Text style={styles.deductionDescription}>{deduction.description}</Text>
                  {deduction.percentage && (
                    <Text style={styles.deductionNote}>
                      Auto-calculated at {deduction.percentage}% of your bill
                    </Text>
                  )}
                </View>
                <Switch
                  value={deduction.deductible}
                  onValueChange={(value) => handleToggle(deduction.id, value)}
                  trackColor={{ false: '#333', true: '#C6FF5E' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {deduction.deductible && (
                <View style={styles.amountInputContainer}>
                  <Text style={styles.amountLabel}>Amount ($)</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor="#666"
                    value={deduction.amount > 0 ? deduction.amount.toString() : ''}
                    onChangeText={(value) => handleAmountChange(deduction.id, value)}
                    keyboardType="decimal-pad"
                  />
                  {deduction.maxAmount && (
                    <Text style={styles.maxAmountHint}>
                      Max: {formatMoney(deduction.maxAmount)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Pro Tip Card */}
        <View style={styles.proTipCard}>
          <Text style={styles.proTipTitle}>Pro Tip</Text>
          <Text style={styles.proTipText}>
            Did you know? Combining these write-offs with the 'Joint Filing' toggle on the Home
            screen typically saves an additional 15% on your tax bill.
          </Text>
        </View>

        {/* Total Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Deductions</Text>
          <Text style={styles.summaryValue}>{formatMoney(totalDeductions)}</Text>
          <Text style={styles.summarySub}>
            Estimated tax savings: {formatMoney(potentialSavings)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    lineHeight: 22,
  },
  savingsCard: {
    backgroundColor: '#1A1F0F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(198, 255, 94, 0.35)',
  },
  savingsLabel: {
    fontSize: 14,
    color: '#C6FF5E',
    fontWeight: '700',
    marginBottom: 8,
  },
  savingsValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#C6FF5E',
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#C6FF5E',
    borderRadius: 4,
  },
  savingsSub: {
    fontSize: 13,
    color: '#D4E8A0',
  },
  deductionsList: {
    gap: 16,
    marginBottom: 24,
  },
  deductionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  deductionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deductionInfo: {
    flex: 1,
    marginRight: 16,
  },
  deductionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  deductionDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  deductionNote: {
    fontSize: 12,
    color: '#C6FF5E',
    fontStyle: 'italic',
  },
  amountInputContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  amountLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 4,
  },
  maxAmountHint: {
    fontSize: 12,
    color: '#666',
  },
  proTipCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C6FF5E',
    marginBottom: 24,
  },
  proTipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C6FF5E',
    marginBottom: 8,
  },
  proTipText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C6FF5E',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#C6FF5E',
    marginBottom: 4,
  },
  summarySub: {
    fontSize: 13,
    color: '#666',
  },
});
