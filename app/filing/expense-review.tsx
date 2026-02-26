/**
 * Expense Review – gate before File Now wizard.
 * Lists expenses/miles, shows optimization card, requires confirmation, then "Start Filing".
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTaxProfile } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { getTrips } from '@/lib/tripStore';
import { getExpenses } from '@/lib/expenseStore';
import { getOptimalDeduction } from '@/lib/unifiedTaxEngine';
import type { Trip } from '@/lib/tripStore';
import type { Expense } from '@/lib/expenseStore';

export default function ExpenseReviewScreen() {
  const { colors } = useRobinhoodTheme();
  const { updateTaxProfile } = useTaxProfile();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e] = await Promise.all([getTrips(), getExpenses()]);
      setTrips(t.filter((x) => x.date && x.startTime && x.endTime));
      setExpenses(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalMiles = trips.reduce((s, t) => s + (t.miles ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const optimal = getOptimalDeduction(totalMiles, totalExpenses);
  const standardAmount = totalMiles * 0.70; // Bug #8 FIX: 2025 IRS mileage rate
  const useStandard = optimal === standardAmount;

  const handleStartFiling = () => {
    if (!confirmed) {
      Alert.alert('Confirm', 'Please confirm that your expenses are accurate.');
      return;
    }
    updateTaxProfile({ optimizedDeduction: optimal });
    router.replace('/(tabs)/file-now');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.text }]}>Review Expenses</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Confirm your mileage and expenses before filing.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Mileage</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>
            {totalMiles.toFixed(1)} mi × $0.70 = ${(standardAmount).toFixed(2)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Actual Expenses</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>${totalExpenses.toFixed(2)}</Text>
        </View>

        <View style={[styles.optimization, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Feather name="zap" size={20} color={colors.primary} />
          <View style={styles.optimizationText}>
            <Text style={[styles.optimizationTitle, { color: colors.text }]}>Optimization</Text>
            <Text style={[styles.optimizationSub, { color: colors.textSecondary }]}>
              {useStandard
                ? `Using standard mileage ($${standardAmount.toFixed(2)}) — greater than actual.`
                : `Using actual expenses ($${totalExpenses.toFixed(2)}) — greater than mileage.`}
            </Text>
            <Text style={[styles.optimalAmount, { color: colors.primary }]}>
              Deduction: ${optimal.toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkRow, { borderColor: colors.border }]}
          onPress={() => setConfirmed(!confirmed)}
          activeOpacity={0.7}>
          <View style={[styles.checkbox, confirmed && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            {confirmed && <Feather name="check" size={14} color={colors.background} />}
          </View>
          <Text style={[styles.checkLabel, { color: colors.text }]}>
            I confirm these expenses are accurate.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleStartFiling}
          disabled={!confirmed}>
          <Text style={[styles.primaryBtnText, { color: colors.background }]}>Start Filing</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghost} onPress={() => router.replace('/(tabs)/dashboard')}>
          <Text style={[styles.ghostText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  optimization: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  optimizationText: { flex: 1 },
  optimizationTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  optimizationSub: { fontSize: 14, marginBottom: 8 },
  optimalAmount: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { fontSize: 16, flex: 1 },
  primaryBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  ghost: { alignItems: 'center', paddingVertical: 12 },
  ghostText: { fontSize: 16 },
});
