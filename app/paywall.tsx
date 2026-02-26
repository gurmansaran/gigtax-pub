import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRevenueCat } from '@/lib/CtxProvider';
import { useTaxProfile } from '@/lib/CtxProvider';
import { calculateTaxReturn, type TaxInput } from '@/lib/unifiedTaxEngine';
import { Feather } from '@expo/vector-icons';

export default function PaywallScreen() {
  const { refreshCustomerInfo, isPro } = useRevenueCat();
  const { taxProfile } = useTaxProfile();
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Generate simulated gig income based on selected apps
  const simulationData = useMemo(() => {
    const apps = taxProfile.selectedApps ?? {
      uber: false, lyft: false, doorDash: false, amazonFlex: false, instacart: false,
    };

    let gigIncome = 0;
    let miles = 0;

    // Simulate income based on selected apps
    if (apps.uber || apps.lyft) {
      // Rideshare: assume higher income and miles
      gigIncome += apps.uber && apps.lyft ? 50000 : 35000;
      miles += apps.uber && apps.lyft ? 25000 : 18000;
    }

    if (apps.doorDash) {
      gigIncome += 28000;
      miles += 15000;
    }

    if (apps.amazonFlex) {
      gigIncome += 32000;
      miles += 20000;
    }

    if (apps.instacart) {
      gigIncome += 22000;
      miles += 12000;
    }

    // If no apps selected, use default demo values
    if (gigIncome === 0) {
      gigIncome = 35000;
      miles = 18000;
    }

    return { gigIncome, miles };
  }, [taxProfile.selectedApps]);

  // Calculate tax scenario
  const taxResult = useMemo(() => {
    if (!taxProfile.filingStatus) {
      return null;
    }

    const taxInput: TaxInput = {
      filingStatus: taxProfile.filingStatus,
      gigIncome: simulationData.gigIncome,
      gigExpenses: {
        miles: simulationData.miles,
        actual: 0, // Assume using standard mileage
        other: 0, // Will be calculated in deductions screen
      },
      w2Income: {
        self: taxProfile.w2Income,
        spouse: taxProfile.filingStatus === 'married_joint' ? 0 : 0, // Can be updated later
      },
      capitalGains: {
        shortTerm: taxProfile.hasInvestments ? 2000 : 0, // Simulated
        longTerm: taxProfile.hasInvestments ? 3000 : 0, // Simulated
      },
      iraContributions: {
        self: 0,
        spouse: 0,
      },
      isRetirementPlanActive: {
        self: taxProfile.hasRetirementPlan,
        spouse: false,
      },
      state: 'Federal',
    };

    try {
      return calculateTaxReturn(taxInput);
    } catch (error) {
      console.error('Tax calculation error:', error);
      return null;
    }
  }, [taxProfile, simulationData]);

  // Calculate total savings (deductions + refund potential)
  const totalSavings = useMemo(() => {
    if (!taxResult) return 0;

    // Total savings = deductions + tax savings from those deductions
    const deductionsTotal = taxResult.deductionsBreakdown.businessExpenses +
      taxResult.deductionsBreakdown.qbiDeduction;
    const estimatedTaxSavings = deductionsTotal * 0.15; // Rough estimate

    return estimatedTaxSavings + (taxResult.deductionsBreakdown.businessExpenses * 0.70 * 0.15); // Mileage savings
  }, [taxResult]);

  const mileageDeductions = useMemo(() => {
    if (!taxResult) return 0;
    return simulationData.miles * 0.70; // 2025 mileage rate
  }, [taxResult, simulationData.miles]);

  const estimatedRefund = taxResult ? Math.max(0, taxResult.totalTax * -0.3) : 3240; // Rough refund estimate

  const handlePurchase = async () => {
    setIsPurchasing(true);

    try {
      // Simulate purchase for now
      // In production, this would use RevenueCat to process the purchase
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Refresh customer info to check if purchase was successful
      await refreshCustomerInfo();

      // For demo purposes, we'll still show the alert but navigate if purchase succeeds
      Alert.alert(
        'Purchase Simulated',
        'In production, this would process the purchase through RevenueCat.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to tabs (in real app, this would only happen if purchase succeeds)
              // For demo, we'll navigate anyway after simulation
              router.replace('/(tabs)' as any);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.title}>Analysis Complete</Text>
        </View>

        <View style={styles.refundContainer}>
          <Text style={styles.refundLabel}>Estimated Refund</Text>
          <View style={styles.blurredContainer}>
            <Text style={styles.blurredAmount}>
              ${Math.round(estimatedRefund).toLocaleString()}
            </Text>
            <View style={styles.blurOverlay} />
          </View>
        </View>

        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            We found <Text style={styles.highlight}>${Math.round(totalSavings).toLocaleString()}+</Text> in potential deductions from your linked accounts.
          </Text>
          {taxResult && (
            <View style={styles.deductionsBreakdown}>
              <Text style={styles.deductionItem}>
                • ${Math.round(mileageDeductions).toLocaleString()} in mileage deductions
              </Text>
              {taxResult.deductionsBreakdown.qbiDeduction > 0 && (
                <Text style={styles.deductionItem}>
                  • ${Math.round(taxResult.deductionsBreakdown.qbiDeduction).toLocaleString()} QBI deduction
                </Text>
              )}
              {taxResult.deductionsBreakdown.businessExpenses > mileageDeductions && (
                <Text style={styles.deductionItem}>
                  • ${Math.round(taxResult.deductionsBreakdown.businessExpenses - mileageDeductions).toLocaleString()} in other business expenses
                </Text>
              )}
            </View>
          )}
          <Text style={styles.messageSubtext}>
            Subscribe to unlock your full report and file your taxes.
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Feather name="bar-chart-2" size={22} color="#C6FF5E" style={styles.featureIcon} />
            <Text style={styles.featureText}>Complete Tax Report</Text>
          </View>
          <View style={styles.feature}>
            <Feather name="download" size={22} color="#C6FF5E" style={styles.featureIcon} />
            <Text style={styles.featureText}>Export & File</Text>
          </View>
          <View style={styles.feature}>
            <Feather name="lock" size={22} color="#C6FF5E" style={styles.featureIcon} />
            <Text style={styles.featureText}>Secure & Private</Text>
          </View>
          <View style={styles.feature}>
            <Feather name="refresh-cw" size={22} color="#C6FF5E" style={styles.featureIcon} />
            <Text style={styles.featureText}>Real-time Updates</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isPurchasing && styles.buttonDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing}>
          <Text style={styles.buttonText}>
            {isPurchasing ? 'Processing...' : 'Start Free Trial — $14.99/mo'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          7-day free trial, then $14.99/mo. Cancel anytime.
        </Text>
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
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  checkmark: {
    fontSize: 64,
    color: '#C6FF5E',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  refundContainer: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  refundLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 12,
  },
  blurredContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  blurredAmount: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
    borderRadius: 8,
  },
  messageContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  messageText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 26,
  },
  highlight: {
    color: '#C6FF5E',
    fontWeight: '600',
  },
  deductionsBreakdown: {
    marginTop: 12,
    marginBottom: 12,
    paddingLeft: 8,
  },
  deductionItem: {
    fontSize: 15,
    color: '#CCCCCC',
    marginBottom: 6,
    lineHeight: 22,
  },
  messageSubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#C6FF5E',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#121212',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
