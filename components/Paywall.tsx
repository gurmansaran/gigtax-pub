/**
 * Paywall - RevenueCat UI when available, else custom fallback (e.g. Expo Go).
 * Use as full-screen gating view; optionally pass onDismiss.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { router } from 'expo-router';
import { useRevenueCat } from '@/lib/CtxProvider';
import {
  isRevenueCatAvailable,
  getOfferings,
  restorePurchases,
} from '@/lib/purchaseService';

const MOCK_PACKAGES = [
  { identifier: 'monthly', product: { priceString: '$14.99/mo', title: 'Monthly' } },
  { identifier: 'yearly', product: { priceString: '$149/yr', title: 'Yearly (Save 17%)' } },
];

type PaywallProps = { onDismiss?: () => void };

export default function Paywall({ onDismiss }: PaywallProps) {
  const { colors } = useRobinhoodTheme();
  const { presentPaywall, refreshCustomerInfo } = useRevenueCat();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [useRC, setUseRC] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (isRevenueCatAvailable()) {
        setUseRC(true);
        const { success } = await presentPaywall();
        if (onDismiss) onDismiss();
        else router.back();
        return;
      }

      try {
        const offering = await getOfferings();
        if (offering?.availablePackages?.length) {
          setPackages(offering.availablePackages);
        } else {
          setPackages(MOCK_PACKAGES);
        }
      } catch (e) {
        console.warn('[Paywall] Offerings failed, using mock', e);
        setPackages(MOCK_PACKAGES);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handleRestore = async () => {
    try {
      const { customerInfo, error } = await restorePurchases();
      if (!error && customerInfo) {
        await refreshCustomerInfo();
        if (onDismiss) onDismiss();
        else router.back();
      }
    } catch (e) {
      console.warn('Restore failed', e);
    }
  };

  const handleMaybeLater = () => {
    if (onDismiss) onDismiss();
    else router.back();
  };

  if (useRC) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Opening paywall…</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const displayPackages = packages.length ? packages : MOCK_PACKAGES;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.header, { color: colors.text }]}>Gig Tax Pro</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary }]}>
          Start your 7-day free trial. Unlock insights, File Now, and all Pro features.
        </Text>
        {loadError && (
          <Text style={[styles.mockBanner, { color: colors.textSecondary }]}>
            Demo pricing (Expo Go)
          </Text>
        )}

        {displayPackages.map((pkg, index) => (
          <TouchableOpacity
            key={pkg.identifier || String(index)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
              {pkg.product?.title ?? 'Plan'}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 20, marginTop: 5 }}>
              {pkg.product?.priceString ?? '$0'}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={handleMaybeLater} style={styles.maybeLater}>
          <Text style={{ color: colors.textSecondary }}>Maybe Later</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRestore} style={styles.restore}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>
            Restore Purchases
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  loadingText: { marginTop: 12, fontSize: 16 },
  header: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  subHeader: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  mockBanner: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  card: { padding: 20, borderRadius: 16, marginBottom: 15 },
  maybeLater: { padding: 20, alignItems: 'center' },
  restore: { marginTop: 10 },
});
