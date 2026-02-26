/**
 * Tax Payments Service
 * Manages quarterly estimated tax payments in Supabase
 */

import { supabase } from './supabase';

export interface TaxPayment {
  id: string;
  userId: string;
  amount: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  datePaid: string; // ISO string
  createdAt: string;
}

/**
 * Get next quarterly payment due date
 */
export function getNextQuarterlyDueDate(): { date: string; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; label: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // 2025 quarterly deadlines
  const deadlines = [
    { quarter: 'Q1' as const, month: 4, day: 15, year: currentYear, label: 'Q1 2025 (Jan-Mar)' },
    { quarter: 'Q2' as const, month: 6, day: 16, year: currentYear, label: 'Q2 2025 (Apr-Jun)' },
    { quarter: 'Q3' as const, month: 9, day: 15, year: currentYear, label: 'Q3 2025 (Jul-Sep)' },
    { quarter: 'Q4' as const, month: 1, day: 15, year: currentYear + 1, label: 'Q4 2025 (Oct-Dec)' },
  ];

  // Find next deadline
  for (const deadline of deadlines) {
    const deadlineDate = new Date(deadline.year, deadline.month - 1, deadline.day);
    if (deadlineDate > now) {
      return {
        date: deadlineDate.toISOString().split('T')[0],
        quarter: deadline.quarter,
        label: deadline.label,
      };
    }
  }

  // If all deadlines passed, return Q1 of next year
  return {
    date: new Date(currentYear + 1, 0, 15).toISOString().split('T')[0],
    quarter: 'Q1',
    label: `Q1 ${currentYear + 1} (Jan-Mar)`,
  };
}

/**
 * Record a tax payment
 * Table expects quarter as "Q1 2026", date_paid, and year (see fix_tax_payments_year migration).
 */
export const recordTaxPayment = async (
  userId: string,
  amount: number,
  quarter: string | number,
  year: number,
  datePaid?: string
): Promise<TaxPayment> => {
  const cleanQuarter = Number(String(quarter).replace(/[^0-9]/g, ''));
  if (cleanQuarter < 1 || cleanQuarter > 4 || isNaN(cleanQuarter)) {
    throw new Error(`Invalid quarter: ${quarter}. Must be Q1-Q4 or 1-4.`);
  }

  const quarterLabel = `Q${cleanQuarter} ${year}`;
  const paid = datePaid || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('tax_payments')
    .insert({
      user_id: userId,
      amount,
      quarter: quarterLabel,
      year,
      date_paid: paid,
    })
    .select()
    .single();

  if (error) {
    console.error('Error recording tax payment:', error);
    throw error;
  }

  return mapRowToTaxPayment(data);
};

function mapRowToTaxPayment(row: any): TaxPayment {
  const q = String(row?.quarter || '').match(/Q([1-4])/);
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount) || 0,
    quarter: (q ? `Q${q[1]}` : 'Q1') as 'Q1' | 'Q2' | 'Q3' | 'Q4',
    year: row.year != null ? Number(row.year) : new Date(row.date_paid).getFullYear(),
    datePaid: row.date_paid || '',
    createdAt: row.created_at || '',
  };
}

/**
 * Get all tax payments for a user.
 * Uses year column when present; otherwise derived from date_paid.
 */
export async function getTaxPayments(userId: string, year?: number): Promise<TaxPayment[]> {
  try {
    let query = supabase
      .from('tax_payments')
      .select('*')
      .eq('user_id', userId)
      .order('date_paid', { ascending: false });

    if (year != null) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapRowToTaxPayment);
  } catch (error) {
    console.error('Error fetching tax payments:', error);
    return [];
  }
}

/**
 * Get total paid for a specific year
 */
export async function getTotalPaidForYear(userId: string, year: number): Promise<number> {
  try {
    const payments = await getTaxPayments(userId, year);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  } catch (error) {
    console.error('Error calculating total paid:', error);
    return 0;
  }
}

/**
 * Delete a tax payment
 */
export async function deleteTaxPayment(paymentId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('tax_payments')
      .delete()
      .eq('id', paymentId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting tax payment:', error);
    throw error;
  }
}
