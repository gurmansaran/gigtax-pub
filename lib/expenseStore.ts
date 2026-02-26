/**
 * Expense Store
 * AsyncStorage cache with Supabase sync for offline-first behavior.
 * Primary source of truth: Supabase (user_expenses table)
 * Local cache: AsyncStorage for fast reads and offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { setSyncStatus, setLastSyncedAt } from './syncService';

export type ExpenseCategory =
  | 'Supplies'
  | 'Utilities'
  | 'Meals'
  | 'Repairs'
  | 'Legal'
  | 'Insurance'
  | 'Gas'
  | 'Other'
  | 'Car Wash'
  | 'Roadside Assistance'
  | 'Background Checks'
  | 'Work Apps'
  | 'Equipment'
  | 'Bank Fees';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // ISO string
  description: string;
  receiptUrl?: string;
  receiptId?: string;
  fromBankTransaction?: boolean;
  transactionId?: string;
  pendingSync?: boolean; // True if not yet synced to Supabase
}

const EXPENSES_STORAGE_KEY = 'manual_expenses';

/**
 * Generates a random ID for expenses
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Adds an expense to local storage (cache)
 */
export async function addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
  try {
    const expenses = await getExpenses();
    const newExpense: Expense = {
      id: generateId(),
      ...expense,
    };

    const updatedExpenses = [newExpense, ...expenses];
    await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedExpenses));
    return newExpense;
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
}

/**
 * Gets all expenses from local storage
 */
export async function getExpenses(): Promise<Expense[]> {
  try {
    const data = await AsyncStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!data) return [];

    const expenses: Expense[] = JSON.parse(data);
    return expenses.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
  } catch (error) {
    console.error('Error getting expenses:', error);
    return [];
  }
}

/**
 * Gets the total sum of all expense amounts
 */
export async function getTotalExpenses(): Promise<number> {
  try {
    const expenses = await getExpenses();
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  } catch (error) {
    console.error('Error calculating total expenses:', error);
    return 0;
  }
}

/**
 * Deletes an expense by ID from local storage
 */
export async function deleteExpense(id: string): Promise<void> {
  try {
    const expenses = await getExpenses();
    const filtered = expenses.filter((expense) => expense.id !== id);
    await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

/**
 * Sync expenses from Supabase → local cache
 * Fetches all expenses from Supabase and updates AsyncStorage cache.
 */
export async function syncExpensesFromSupabase(userId: string): Promise<void> {
  try {
    setSyncStatus('syncing');

    const { data, error } = await supabase
      .from('user_expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;

    if (data) {
      const expenses: Expense[] = data.map((row: any) => ({
        id: row.id,
        category: row.category || 'Other',
        amount: parseFloat(row.deductible_amount?.toString() || row.amount?.toString() || '0'),
        date: row.date,
        description: row.merchant || 'Expense',
        fromBankTransaction: true,
      }));

      await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    }

    await setLastSyncedAt();
    setSyncStatus('synced');
  } catch (error) {
    console.error('Error syncing expenses from Supabase:', error);
    setSyncStatus('error');
  }
}
