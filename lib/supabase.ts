/**
 * Supabase Client Configuration
 * Handles authentication, session persistence, and profile management
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check .env file.');
}

// Create Supabase client with AsyncStorage for session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: { schema: 'public' },
  global: {
    headers: { 'x-client-info': 'gigtax-app' },
  },
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  date_of_birth: string | null;
  ssn: string | null;
  filing_status: 'single' | 'married_joint' | 'married_separate' | 'head_household' | null;
  gig_apps: string[] | null;
  language_preference: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Check if user is currently authenticated
 * @returns Promise<boolean> - true if user has valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

/**
 * Get the current authenticated user
 * @returns Promise<User | null> - User object or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return { error: error as Error };
  }
}

// ============================================================================
// PROFILE HELPERS
// ============================================================================

/**
 * Get user profile by ID
 * @param userId - User's UUID
 * @returns Promise<Profile | null> - Profile object or null
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    // maybeSingle() returns null when no rows found (instead of erroring like .single())
    return data as Profile | null;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

/**
 * Update user profile
 * @param userId - User's UUID
 * @param updates - Partial profile data to update
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'email' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check onboarding status for a user
 * @param userId - User's UUID
 * @returns Promise<{ completed: boolean; step: number }>
 */
export async function getOnboardingStatus(userId: string): Promise<{
  completed: boolean;
  step: number;
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching onboarding status:', error.message);
      return { completed: false, step: 1 };
    }

    // maybeSingle() returns null when no profile row exists yet
    if (!data) {
      return { completed: false, step: 1 };
    }

    return {
      completed: data.onboarding_completed ?? false,
      step: data.onboarding_step ?? 1,
    };
  } catch (error) {
    console.error('Error in getOnboardingStatus:', error);
    return { completed: false, step: 1 };
  }
}

/**
 * Complete onboarding for a user
 * @param userId - User's UUID
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function completeOnboarding(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_step: 7,
      })
      .eq('id', userId);

    if (error) {
      console.error('Error completing onboarding:', error.message);
      return { success: false, error: error.message };
    }

    // Also update AsyncStorage for faster local checks
    await AsyncStorage.setItem(`onboarding_complete_${userId}`, 'true');

    return { success: true };
  } catch (error) {
    console.error('Error in completeOnboarding:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// SSN ENCRYPTION HELPERS (via Supabase RPCs)
// ============================================================================

/**
 * Save user's SSN encrypted via database RPC
 * Uses pgcrypto encryption defined in secure_tax_data.sql
 */
export async function saveUserSSN(userId: string, ssn: string): Promise<{ success: boolean; error?: string }> {
  try {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length !== 9) {
      return { success: false, error: 'SSN must be 9 digits' };
    }

    const { error } = await supabase.rpc('save_user_ssn', {
      ssn_input: digits,
    });

    if (error) {
      console.error('Error saving encrypted SSN:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in saveUserSSN:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get user's masked SSN (last 4 digits only) via database RPC
 */
export async function getUserSSNMasked(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_ssn_masked');

    if (error) {
      // Silently return null if the RPC function doesn't exist in the schema cache
      // (it hasn't been deployed yet). Only log unexpected errors.
      if (!error.message?.includes('schema cache')) {
        console.error('Error getting masked SSN:', error.message);
      }
      return null;
    }

    return data as string | null;
  } catch (error) {
    // Silently return null — RPC may not be deployed
    return null;
  }
}
