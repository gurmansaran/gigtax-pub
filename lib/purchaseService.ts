/**
 * Purchase Service - RevenueCat Integration
 * Handles premium (Gig Tax Pro) subscriptions, offerings, and RevenueCat UI.
 *
 * Dashboard setup:
 * - Entitlement: "pro" (display name "Gig Tax Pro")
 * - Products: monthly ($14.99/mo), yearly ($149/yr) with 7-day free trial
 */

import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Entitlement identifier for Gig Tax Pro. Create "pro" in RevenueCat and attach products. */
export const ENTITLEMENT_ID = 'pro';

/** Product identifiers for Monthly and Yearly. Match Store Console / RevenueCat. */
export const PRODUCT_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
} as const;

let isInitialized = false;
let isExpoGo = false;

/** Whether RevenueCat is configured and available (not Expo Go). */
export function isRevenueCatAvailable(): boolean {
  return isInitialized && !isExpoGo;
}

/** Initialize RevenueCat. Call once at app startup. */
export async function initializeRevenueCat(apiKey: string): Promise<void> {
  if (!apiKey || apiKey === 'appl_your_key_here' || apiKey.trim().length === 0) {
    console.log('[RevenueCat] Skipped: No valid API key.');
    isInitialized = false;
    isExpoGo = false;
    return;
  }

  if (Constants.appOwnership === 'expo') {
    console.warn('[RevenueCat] Expo Go detected – purchases mocked.');
    isExpoGo = true;
    isInitialized = false;
    return;
  }

  try {
    await Purchases.configure({ apiKey });
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    isInitialized = true;
    isExpoGo = false;
    console.log('[RevenueCat] Initialized.');
  } catch (e) {
    console.warn('[RevenueCat] Init failed – subscriptions disabled.', e);
    isInitialized = false;
  }
}

/** Get current customer info. */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isInitialized || isExpoGo) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.error('[RevenueCat] getCustomerInfo error:', e);
    return null;
  }
}

/** Check if user has Gig Tax Pro (entitlement "pro"). */
export function hasProEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
}

/** Async check for Pro access. */
export async function checkProAccess(): Promise<boolean> {
  const info = await getCustomerInfo();
  return hasProEntitlement(info);
}

/** Get current offering. */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isInitialized || isExpoGo) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.error('[RevenueCat] getOfferings error:', e);
    return null;
  }
}

/** Find a package by identifier (e.g. monthly, yearly). */
export function getPackageByIdentifier(
  offering: PurchasesOffering | null,
  id: keyof typeof PRODUCT_IDS
): PurchasesPackage | null {
  if (!offering?.availablePackages?.length) return null;
  const slug = PRODUCT_IDS[id];
  return (
    offering.availablePackages.find(
      (p) =>
        p.identifier.toLowerCase().includes(slug) ||
        (p.packageType === 'MONTHLY' && id === 'monthly') ||
        (p.packageType === 'ANNUAL' && id === 'yearly')
    ) ?? null
  );
}

/** Purchase a package. Returns updated CustomerInfo on success. */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<{ customerInfo: CustomerInfo } | { error: string }> {
  if (!isInitialized || isExpoGo) {
    return { error: 'Purchases not available (e.g. Expo Go).' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo };
  } catch (e: any) {
    if (e?.userCancelled) return { error: 'Purchase cancelled.' };
    const msg = e?.message ?? 'Purchase failed. Please try again.';
    console.error('[RevenueCat] purchasePackage error:', e);
    return { error: msg };
  }
}

/** Restore purchases. */
export async function restorePurchases(): Promise<{
  customerInfo: CustomerInfo | null;
  error: string | null;
}> {
  if (!isInitialized || isExpoGo) {
    return { customerInfo: null, error: 'Purchases not available.' };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo, error: null };
  } catch (e: any) {
    const msg = e?.message ?? 'Restore failed. Please try again.';
    console.error('[RevenueCat] restorePurchases error:', e);
    return { customerInfo: null, error: msg };
  }
}

/** Identify user with your app user id (e.g. Supabase user id). */
export async function identifyUser(userId: string): Promise<void> {
  if (!isInitialized || isExpoGo) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[RevenueCat] logIn error:', e);
  }
}

/** Log out RevenueCat user. */
export async function logOutUser(): Promise<void> {
  if (!isInitialized || isExpoGo) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('[RevenueCat] logOut error:', e);
  }
}

/** Present RevenueCat Paywall. Returns true if purchased or restored. */
export async function presentPaywall(options?: {
  offering?: PurchasesOffering;
}): Promise<{ success: boolean; result: PAYWALL_RESULT }> {
  if (!isInitialized || !isRevenueCatAvailable()) {
    return { success: false, result: PAYWALL_RESULT.NOT_PRESENTED };
  }
  try {
    const result = options?.offering
      ? await RevenueCatUI.presentPaywall({ offering: options.offering })
      : await RevenueCatUI.presentPaywall();
    const success =
      result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    return { success, result };
  } catch (e) {
    console.error('[RevenueCat] presentPaywall error:', e);
    return { success: false, result: PAYWALL_RESULT.ERROR };
  }
}

/** Present paywall only if user does not have Gig Tax Pro. */
export async function presentPaywallIfNeeded(options?: {
  offering?: PurchasesOffering;
}): Promise<{ success: boolean; result: PAYWALL_RESULT }> {
  if (!isInitialized || !isRevenueCatAvailable()) {
    return { success: false, result: PAYWALL_RESULT.NOT_PRESENTED };
  }
  try {
    const params: { requiredEntitlementIdentifier: string; offering?: PurchasesOffering } = {
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
    };
    if (options?.offering) params.offering = options.offering;
    const result = await RevenueCatUI.presentPaywallIfNeeded(params);
    const success =
      result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    return { success, result };
  } catch (e) {
    console.error('[RevenueCat] presentPaywallIfNeeded error:', e);
    return { success: false, result: PAYWALL_RESULT.ERROR };
  }
}

/** Present Customer Center (manage subscription, restore, etc.). */
export async function presentCustomerCenter(): Promise<void> {
  if (!isInitialized || !isRevenueCatAvailable()) {
    console.warn('[RevenueCat] Customer Center not available.');
    return;
  }
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (e) {
    console.error('[RevenueCat] presentCustomerCenter error:', e);
  }
}
