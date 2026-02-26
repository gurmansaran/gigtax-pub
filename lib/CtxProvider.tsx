/**
 * Context Providers
 * Provides authentication, subscription, onboarding, and profile state
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, getOnboardingStatus, saveUserSSN, getUserSSNMasked } from '@/lib/supabase';
import type { CustomerInfo } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeRevenueCat,
  getCustomerInfo,
  hasProEntitlement,
  presentPaywall,
  presentPaywallIfNeeded,
  presentCustomerCenter,
  identifyUser,
  logOutUser,
} from '@/lib/purchaseService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  isPro: boolean;
  loading: boolean;
  refreshCustomerInfo: () => Promise<void>;
  presentPaywall: () => Promise<{ success: boolean }>;
  presentPaywallIfNeeded: () => Promise<{ success: boolean }>;
  presentCustomerCenter: () => Promise<void>;
}

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  onboardingVersion: number;
  loading: boolean;
  completeOnboarding: () => Promise<void>;
  refreshOnboardingStatus: () => Promise<void>;
}

interface TaxProfileContextType {
  taxProfile: {
    // Basic info
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
    email: string;

    // Address
    address: string;
    city: string;
    state: string;
    zip: string;
    home_lat?: number;
    home_lng?: number;

    // Tax info
    dateOfBirth: string;
    ssn: string;
    filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_household' | null;

    // Gig apps
    gigApps: string[];

    // Legacy fields for compatibility with existing code
    fullSSN: string;
    hasW2Job: boolean;
    w2Income: number;
    hasInvestments: boolean;
    hasRetirementPlan: boolean;
    spouseName: string;
    spouseSSN: string;
    spouseHas1099: boolean;
    spouseHasW2: boolean;
    spouseW2Amount: number;
    capitalGainsShortTerm: number;
    capitalGainsLongTerm: number;
    selectedApps?: {
      uber: boolean;
      lyft: boolean;
      doorDash: boolean;
      amazonFlex: boolean;
      instacart: boolean;
    };
    optimizedDeduction?: number;
  };
  loading: boolean;
  updateTaxProfile: (profile: Partial<TaxProfileContextType['taxProfile']>) => void | Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ============================================================================
// CONTEXT DEFAULTS
// ============================================================================

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

const RevenueCatContext = createContext<RevenueCatContextType>({
  customerInfo: null,
  isPro: false,
  loading: true,
  refreshCustomerInfo: async () => {},
  presentPaywall: async () => ({ success: false }),
  presentPaywallIfNeeded: async () => ({ success: false }),
  presentCustomerCenter: async () => {},
});

const OnboardingContext = createContext<OnboardingContextType>({
  isOnboardingComplete: false,
  onboardingVersion: 0,
  loading: true,
  completeOnboarding: async () => {},
  refreshOnboardingStatus: async () => {},
});

const defaultTaxProfile: TaxProfileContextType['taxProfile'] = {
  firstName: '',
  lastName: '',
  fullName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  home_lat: undefined,
  home_lng: undefined,
  dateOfBirth: '',
  ssn: '',
  filingStatus: null,
  gigApps: [],
  fullSSN: '',
  hasW2Job: false,
  w2Income: 0,
  hasInvestments: false,
  hasRetirementPlan: false,
  spouseName: '',
  spouseSSN: '',
  spouseHas1099: false,
  spouseHasW2: false,
  spouseW2Amount: 0,
  capitalGainsShortTerm: 0,
  capitalGainsLongTerm: 0,
  selectedApps: undefined,
  optimizedDeduction: undefined,
};

const TaxProfileContext = createContext<TaxProfileContextType>({
  taxProfile: defaultTaxProfile,
  loading: true,
  updateTaxProfile: () => {},
  refreshProfile: async () => {},
});

// ============================================================================
// HOOKS
// ============================================================================

export const useAuth = () => useContext(AuthContext);
export const useRevenueCat = () => useContext(RevenueCatContext);
export const useOnboarding = () => useContext(OnboardingContext);
export const useTaxProfile = () => useContext(TaxProfileContext);

// ============================================================================
// AUTH PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 Auth: Initial session load started');

    // Track whether both getSession and onAuthStateChange have resolved
    const getSessionResolved = { current: false };
    const authChangeReceived = { current: false };

    const resolveInitialLoad = () => {
      if (getSessionResolved.current && authChangeReceived.current) {
        console.log('✅ Auth: Initialization complete');
        setLoading(false);
      }
    };

    // Safety net: if onAuthStateChange never fires, proceed after 2 seconds
    const safetyTimeout = setTimeout(() => {
      if (!authChangeReceived.current) {
        console.log('🔐 Auth: Safety timeout — proceeding without auth state change event');
        authChangeReceived.current = true;
        resolveInitialLoad();
      }
    }, 2000);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('🔐 Auth: getSession completed');
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error('Error getting initial session:', err);
      })
      .finally(() => {
        getSessionResolved.current = true;
        resolveInitialLoad();
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!authChangeReceived.current) {
        console.log('🔐 Auth: First auth state change received');
        authChangeReceived.current = true;
        resolveInitialLoad();
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// REVENUECAT PROVIDER
// ============================================================================

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshCustomerInfo = async () => {
    if (!isInitialized) {
      setLoading(false);
      return;
    }
    const info = await getCustomerInfo();
    setCustomerInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    const setupRevenueCat = async () => {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_KEY;
      if (!apiKey || apiKey === 'appl_your_key_here') {
        setLoading(false);
        return;
      }
      await initializeRevenueCat(apiKey);
      setIsInitialized(true);
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      setLoading(false);
    };
    setupRevenueCat();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (user?.id) {
      identifyUser(user.id);
    } else {
      logOutUser();
    }
  }, [isInitialized, user?.id]);

  const handlePresentPaywall = async () => {
    const { success } = await presentPaywall();
    if (success) await refreshCustomerInfo();
    return { success };
  };

  const handlePresentPaywallIfNeeded = async () => {
    const { success } = await presentPaywallIfNeeded();
    if (success) await refreshCustomerInfo();
    return { success };
  };

  const handlePresentCustomerCenter = async () => {
    await presentCustomerCenter();
    await refreshCustomerInfo();
  };

  const isPro = hasProEntitlement(customerInfo);

  return (
    <RevenueCatContext.Provider
      value={{
        customerInfo,
        isPro,
        loading,
        refreshCustomerInfo,
        presentPaywall: handlePresentPaywall,
        presentPaywallIfNeeded: handlePresentPaywallIfNeeded,
        presentCustomerCenter: handlePresentCustomerCenter,
      }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

// ============================================================================
// ONBOARDING PROVIDER
// ============================================================================

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboardingVersion, setOnboardingVersion] = useState(0);
  const { user } = useAuth();

  const checkOnboardingStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First check AsyncStorage for faster response
      const key = `onboarding_complete_${user.id}`;
      const localValue = await AsyncStorage.getItem(key);

      if (localValue === 'true') {
        setIsOnboardingComplete(true);
        setLoading(false);
        return;
      }

      // Check database as fallback
      const { completed } = await getOnboardingStatus(user.id);
      setIsOnboardingComplete(completed);

      // Sync AsyncStorage if database says completed
      if (completed) {
        await AsyncStorage.setItem(key, 'true');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsOnboardingComplete(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset onboarding state when user changes to prevent data leakage
    setIsOnboardingComplete(false);
    setLoading(true);
    checkOnboardingStatus();
  }, [user]);

  const completeOnboarding = async () => {
    if (!user) return;

    try {
      // Update database
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_step: 7,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update AsyncStorage
      const key = `onboarding_complete_${user.id}`;
      await AsyncStorage.setItem(key, 'true');

      setIsOnboardingComplete(true);
      setOnboardingVersion((v) => v + 1);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const refreshOnboardingStatus = async () => {
    setLoading(true);
    await checkOnboardingStatus();
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        onboardingVersion,
        loading,
        completeOnboarding,
        refreshOnboardingStatus,
      }}>
      {children}
    </OnboardingContext.Provider>
  );
}

// ============================================================================
// TAX PROFILE PROVIDER
// ============================================================================

export function TaxProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isOnboardingComplete, onboardingVersion } = useOnboarding();
  const [taxProfile, setTaxProfile] = useState<TaxProfileContextType['taxProfile']>(defaultTaxProfile);
  const [loading, setLoading] = useState(true);
  const dbUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDbWrite = useRef<Promise<void> | null>(null);

  const loadProfileFromDB = useCallback(async () => {
    if (!user?.id) {
      console.log('⚠️ TaxProfile: No user ID, skipping DB load');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 TaxProfile: Loading profile from DB for user:', user.id);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      console.log('📊 TaxProfile: DB result:', {
        full_name: profile?.full_name,
        phone: profile?.phone,
        address: profile?.address,
        city: profile?.city,
        state: profile?.state,
        zip: profile?.zip,
        date_of_birth: profile?.date_of_birth,
        error: error?.message,
      });

      if (error || !profile) {
        console.log('❌ TaxProfile: No profile found or error:', error?.message);
        setLoading(false);
        return;
      }

      // Parse full_name into first and last
      let firstName = '';
      let lastName = '';
      if (profile.full_name) {
        const nameParts = profile.full_name.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Convert gig_apps array to selectedApps object for compatibility
      const gigApps = profile.gig_apps || [];
      const selectedApps = {
        uber: gigApps.includes('uber'),
        lyft: gigApps.includes('lyft'),
        doorDash: gigApps.includes('doordash'),
        amazonFlex: gigApps.includes('amazonflex'),
        instacart: gigApps.includes('instacart'),
      };

      // Try to get masked SSN via RPC (encrypted storage)
      let maskedSSN = '';
      try {
        const masked = await getUserSSNMasked();
        if (masked) maskedSSN = masked;
      } catch {
        // Fall back to profile.ssn if RPC not available
        maskedSSN = profile.ssn || '';
      }

      const newProfile = {
        firstName,
        lastName,
        fullName: profile.full_name || '',
        email: profile.email || user?.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.zip || '',
        home_lat: profile.home_lat ?? undefined,
        home_lng: profile.home_lng ?? undefined,
        dateOfBirth: profile.date_of_birth || '',
        ssn: maskedSSN || profile.ssn || '',
        fullSSN: maskedSSN || profile.ssn || '',
        filingStatus: profile.filing_status as TaxProfileContextType['taxProfile']['filingStatus'],
        gigApps,
        selectedApps,
      };
      console.log('✅ TaxProfile: Setting state with:', {
        firstName: newProfile.firstName,
        lastName: newProfile.lastName,
        fullName: newProfile.fullName,
        phone: newProfile.phone,
        address: newProfile.address,
        city: newProfile.city,
        state: newProfile.state,
        zip: newProfile.zip,
        dateOfBirth: newProfile.dateOfBirth,
      });
      setTaxProfile((prev) => ({ ...prev, ...newProfile }));
    } catch (err) {
      console.error('Error loading profile from database:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Reload profile when user changes or onboarding completes
  // onboardingVersion increments on each completeOnboarding() call, ensuring a fresh DB read
  useEffect(() => {
    // IMMEDIATELY reset to defaults when user changes to prevent data leakage
    if (!user?.id) {
      console.log('❌ User logged out, profile reset to defaults');
      setTaxProfile(defaultTaxProfile);
      setLoading(false);
      return;
    }

    console.log('🔄 User changed, resetting tax profile...');
    setTaxProfile(defaultTaxProfile);
    setLoading(true);
    console.log('📊 Loading tax profile for user:', user.id);
    loadProfileFromDB();
  }, [user?.id, onboardingVersion, loadProfileFromDB]);

  const updateTaxProfile = async (updates: Partial<TaxProfileContextType['taxProfile']>) => {
    setTaxProfile((prev) => ({ ...prev, ...updates }));

    // Persist relevant fields to Supabase
    if (!user?.id) return;

    // Handle SSN separately via encrypted RPC (P0-4/P0-5)
    if (updates.ssn !== undefined && updates.ssn.replace(/\D/g, '').length === 9) {
      try {
        await saveUserSSN(user.id, updates.ssn);
      } catch (err) {
        console.error('Error saving encrypted SSN:', err);
      }
    }

    const dbUpdates: Record<string, any> = {};
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const first = updates.firstName ?? taxProfile.firstName;
      const last = updates.lastName ?? taxProfile.lastName;
      dbUpdates.full_name = `${first} ${last}`.trim();
    }
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.state !== undefined) dbUpdates.state = updates.state;
    if (updates.zip !== undefined) dbUpdates.zip = updates.zip;
    if (updates.dateOfBirth !== undefined) dbUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.filingStatus !== undefined) dbUpdates.filing_status = updates.filingStatus;
    if (updates.gigApps !== undefined) dbUpdates.gig_apps = updates.gigApps;
    if (updates.home_lat !== undefined) dbUpdates.home_lat = updates.home_lat;
    if (updates.home_lng !== undefined) dbUpdates.home_lng = updates.home_lng;

    if (Object.keys(dbUpdates).length > 0) {
      dbUpdates.updated_at = new Date().toISOString();
      // P1-19: Debounce DB writes to avoid rapid successive calls
      if (dbUpdateTimer.current) clearTimeout(dbUpdateTimer.current);
      dbUpdateTimer.current = setTimeout(() => {
        const writePromise = (async () => {
          try {
            await supabase.from('profiles').update(dbUpdates).eq('id', user!.id);
          } catch (err) {
            console.error('Error persisting profile update:', err);
          } finally {
            pendingDbWrite.current = null;
          }
        })();
        pendingDbWrite.current = writePromise;
      }, 300);
    }
  };

  const refreshProfile = useCallback(async () => {
    console.log('🔄 TaxProfile: refreshProfile called');
    // Flush any pending debounced writes before reading from DB
    if (dbUpdateTimer.current) {
      clearTimeout(dbUpdateTimer.current);
      dbUpdateTimer.current = null;
    }
    if (pendingDbWrite.current) {
      console.log('🔄 TaxProfile: Waiting for pending DB write...');
      await pendingDbWrite.current;
    }
    setLoading(true);
    await loadProfileFromDB();
  }, [loadProfileFromDB]);

  return (
    <TaxProfileContext.Provider
      value={{
        taxProfile,
        loading,
        updateTaxProfile,
        refreshProfile,
      }}>
      {children}
    </TaxProfileContext.Provider>
  );
}
