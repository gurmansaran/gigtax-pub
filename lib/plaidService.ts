/**
 * Plaid Integration Service
 * Handles bank account linking, transaction fetching, and smart deduplication.
 * 
 * Note: This is a sandbox-ready implementation. Replace with actual Plaid SDK
 * when ready: https://github.com/plaid/react-native-plaid-link-sdk
 */

import { supabase } from './supabase';
import { useAuth } from '@/lib/CtxProvider';
import {
  EXPENSE_KEYWORDS as EXPANDED_EXPENSE_KEYWORDS,
  INCOME_KEYWORDS,
  isGigPlatformIncome,
  extractPlatformName,
  categorizePlaidTransaction,
} from './plaidKeywords';
import { Alert } from 'react-native';

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: string;
  mask: string;
}

export interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
}

// Re-export keywords for backward compatibility
const EXPENSE_KEYWORDS: Record<string, string[]> = {
  Gas: EXPANDED_EXPENSE_KEYWORDS.gas,
  Repairs: EXPANDED_EXPENSE_KEYWORDS.repairs,
  'Oil Changes': ['oil change', 'jiffy lube', 'valvoline', 'quick lube', 'oil service', 'walmart tire & lube', 'walmart auto care', 'take 5 oil', 'grease monkey', 'express oil', 'strickland brothers', 'lube center', 'lube shop', 'lube express', 'oil and lube'],
  Insurance: EXPANDED_EXPENSE_KEYWORDS.insurance,
  Supplies: EXPANDED_EXPENSE_KEYWORDS.supplies,
  Phone: EXPANDED_EXPENSE_KEYWORDS.phone,
  Parking: EXPANDED_EXPENSE_KEYWORDS.parking,
  Tolls: EXPANDED_EXPENSE_KEYWORDS.tolls,
  'Car Payments': EXPANDED_EXPENSE_KEYWORDS.car_payments,
  Meals: EXPANDED_EXPENSE_KEYWORDS.meals,
  Fees: EXPANDED_EXPENSE_KEYWORDS.fees,
  Subscriptions: EXPANDED_EXPENSE_KEYWORDS.subscriptions,
};

/**
 * Initialize Plaid Link via Supabase Edge Function
 * Returns a link token for the Plaid Link component
 * 
 * NOTE: This function is now handled by the BankLinkButton component
 * which calls the Supabase Edge Function directly.
 * This function is kept for backward compatibility.
 */
export async function createLinkToken(userId: string): Promise<string> {
  try {
    // Get the session token for authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    // Call Supabase Edge Function (secure backend)
    const { data, error } = await supabase.functions.invoke('create-plaid-link-token', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.link_token) {
      return data.link_token;
    } else {
      throw new Error('No link token received');
    }
  } catch (error) {
    console.error('Error creating link token:', error);
    throw error;
  }
}

/**
 * Exchange public token for access token via Supabase Edge Function
 * 
 * NOTE: This function is now handled by the BankLinkButton component
 * which calls the Supabase Edge Function directly.
 * This function is kept for backward compatibility.
 */
export async function exchangePublicToken(publicToken: string, userId: string): Promise<void> {
  try {
    // Get the session token for authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    // Call Supabase Edge Function (secure backend)
    const { data, error } = await supabase.functions.invoke('exchange-plaid-public-token', {
      body: { public_token: publicToken },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      throw new Error('Failed to exchange public token');
    }
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw error;
  }
}

/**
 * Fetch transactions from Plaid
 */
export async function fetchTransactions(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<PlaidTransaction[]> {
  try {
    // Verify the user has a linked bank account (access token stays server-side)
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('No Plaid account linked');
    }

    // Call Supabase Edge Function for secure server-side transaction fetch
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: txnData, error: txnError } = await supabase.functions.invoke('fetch-plaid-transactions', {
      body: {
        start_date: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (txnError) throw txnError;

    if (txnData?.transactions) {
      return txnData.transactions as PlaidTransaction[];
    }

    // Edge function not deployed yet — fall back to mock in dev
    if (__DEV__) {
      console.warn('fetchTransactions: Edge function returned no data. Using mock data for development.');
      return generateMockTransactions();
    }

    return [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    // DEV-only: return mock data for sandbox testing
    if (__DEV__) {
      return generateMockTransactions();
    }
    return [];
  }
}

/**
 * Auto-categorize transactions as business expenses
 */
export function categorizeTransaction(transaction: PlaidTransaction): string | null {
  const name = transaction.name.toLowerCase();
  const merchantName = (transaction.merchantName || '').toLowerCase();

  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (name.includes(keyword) || merchantName.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Generate mock transactions for sandbox/testing
 */
function generateMockTransactions(): PlaidTransaction[] {
  const now = new Date();
  const transactions: PlaidTransaction[] = [];

  // Generate some gas transactions
  for (let i = 0; i < 8; i++) {
    const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    transactions.push({
      transactionId: `gas-${i}`,
      accountId: 'mock-account',
      amount: -45 + Math.random() * 20,
      date: date.toISOString().split('T')[0],
      name: 'Shell Gas Station',
      merchantName: 'Shell',
      category: ['Gas Stations'],
      pending: false,
    });
  }

  // Generate oil change
  transactions.push({
    transactionId: 'oil-1',
    accountId: 'mock-account',
    amount: -39.99,
    date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    name: 'Jiffy Lube',
    merchantName: 'Jiffy Lube',
    category: ['Auto Repair'],
    pending: false,
  });

  // Generate repair
  transactions.push({
    transactionId: 'repair-1',
    accountId: 'mock-account',
    amount: -250,
    date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    name: 'Auto Repair Shop',
    merchantName: 'Auto Repair',
    category: ['Auto Repair'],
    pending: false,
  });

  return transactions;
}

// ─── Smart Deduplication for Plaid Income vs 1099 ───

/**
 * Process a Plaid income transaction, skipping duplicates.
 * Stores as unverified estimate until matched against official 1099.
 */
export async function processPlaidIncomeTransaction(
  userId: string,
  transaction: PlaidTransaction
): Promise<boolean> {
  const merchantName = transaction.merchantName || transaction.name;
  if (!isGigPlatformIncome(merchantName)) return false;

  // Check if this transaction already exists
  const { data: existing } = await supabase
    .from('user_income')
    .select('id')
    .eq('user_id', userId)
    .eq('description', transaction.transactionId)
    .maybeSingle();

  if (existing) {
    // Already tracked, skip
    return false;
  }

  // Save as unverified estimate from Plaid
  const { error } = await supabase.from('user_income').insert({
    user_id: userId,
    source: 'plaid',
    amount: Math.abs(transaction.amount),
    date: transaction.date,
    description: transaction.transactionId,
    status: 'estimate',
  });

  return !error;
}

/**
 * When user adds an official 1099, check for Plaid duplicates
 * and either verify existing estimates or flag a mismatch.
 */
export async function check1099AgainstPlaidEstimates(
  userId: string,
  formData: { source: string; amount: number }
): Promise<{ hasDuplicate: boolean; action: 'verified' | 'mismatch' | 'none'; estimatedTotal: number }> {
  // Look for Plaid estimates that match this income source
  const platformName = extractPlatformName(formData.source);

  const { data: plaidEstimates } = await supabase
    .from('user_income')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'plaid')
    .eq('status', 'estimate');

  if (!plaidEstimates || plaidEstimates.length === 0) {
    return { hasDuplicate: false, action: 'none', estimatedTotal: 0 };
  }

  const totalEstimated = plaidEstimates.reduce(
    (sum: number, e: { amount: number }) => sum + parseFloat(e.amount.toString()),
    0
  );
  const difference = Math.abs(formData.amount - totalEstimated);

  // If 1099 amount matches estimates (within 5%), mark as verified
  if (difference < formData.amount * 0.05) {
    await supabase
      .from('user_income')
      .update({ status: 'verified' })
      .in(
        'id',
        plaidEstimates.map((e: { id: string }) => e.id)
      );

    return { hasDuplicate: true, action: 'verified', estimatedTotal: totalEstimated };
  }

  return { hasDuplicate: true, action: 'mismatch', estimatedTotal: totalEstimated };
}

/**
 * Replace Plaid estimates with official 1099 data.
 */
export async function replacePlaidEstimatesWithOfficial(
  userId: string,
  estimateIds: string[],
  officialData: { source: string; amount: number; date: string }
): Promise<void> {
  // Delete estimates
  await supabase
    .from('user_income')
    .delete()
    .in('id', estimateIds);

  // Add official 1099 income
  await supabase.from('user_income').insert({
    user_id: userId,
    source: 'screenshot',
    amount: officialData.amount,
    date: officialData.date,
    description: `1099 - ${officialData.source}`,
    status: 'verified',
  });
}
