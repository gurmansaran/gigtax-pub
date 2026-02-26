/**
 * Insights Service
 * Calculates monthly, weekly, and year-over-year insights
 */

import { getTrips } from './tripStore';
import { getExpenses } from './expenseStore';
import { supabase } from './supabase';

export interface MonthlyInsight {
  month: string; // "2025-01"
  earnings: number;
  miles: number;
  trips: number;
  expenses: number;
}

export interface WeeklyInsight {
  week: string; // "2025-W01"
  weekStart: Date; // Start date of the week
  weekEnd: Date; // End date of the week
  earnings: number;
  miles: number;
  trips: number;
  expenses: number;
}

export interface DailyInsight {
  date: string; // "2025-01-15"
  earnings: number;
  miles: number;
  trips: number;
  expenses: number;
}

export interface YearOverYearInsight {
  year: number;
  totalEarnings: number;
  totalMiles: number;
  totalTrips: number;
  totalExpenses: number;
  averageMonthlyEarnings: number;
}

/**
 * Get monthly insights for the current year
 */
export async function getMonthlyInsights(year: number = new Date().getFullYear()): Promise<MonthlyInsight[]> {
  const trips = await getTrips();
  const expenses = await getExpenses();

  // Group by month
  const monthlyMap = new Map<string, MonthlyInsight>();

  // Initialize all months
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    monthlyMap.set(monthKey, {
      month: monthKey,
      earnings: 0,
      miles: 0,
      trips: 0,
      expenses: 0,
    });
  }

  // Process trips
  trips.forEach((trip) => {
    const tripDate = new Date(trip.date);
    if (tripDate.getFullYear() === year) {
      const monthKey = `${year}-${String(tripDate.getMonth() + 1).padStart(2, '0')}`;
      const insight = monthlyMap.get(monthKey);
      if (insight) {
        insight.earnings += trip.earnings || 0;
        insight.miles += trip.miles || 0;
        insight.trips += 1;
      }
    }
  });

  // Process expenses
  expenses.forEach((expense) => {
    const expenseDate = new Date(expense.date);
    if (expenseDate.getFullYear() === year) {
      const monthKey = `${year}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      const insight = monthlyMap.get(monthKey);
      if (insight) {
        insight.expenses += expense.amount;
      }
    }
  });

  return Array.from(monthlyMap.values());
}

/**
 * Get weekly insights for a specific month
 */
export async function getWeeklyInsights(
  year: number,
  month: number
): Promise<WeeklyInsight[]> {
  const trips = await getTrips();
  const expenses = await getExpenses();

  // Get start and end of month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Group by week
  const weeklyMap = new Map<string, WeeklyInsight>();

  // Process trips
  trips.forEach((trip) => {
    const tripDate = new Date(trip.date);
    if (tripDate >= startDate && tripDate <= endDate) {
      const weekDates = getWeekStartEnd(tripDate);
      const weekNumber = getWeekNumber(tripDate);
      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          week: weekKey,
          weekStart: weekDates.start,
          weekEnd: weekDates.end,
          earnings: 0,
          miles: 0,
          trips: 0,
          expenses: 0,
        });
      }

      const insight = weeklyMap.get(weekKey)!;
      insight.earnings += trip.earnings || 0;
      insight.miles += trip.miles || 0;
      insight.trips += 1;
    }
  });

  // Process expenses
  expenses.forEach((expense) => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= endDate) {
      const weekDates = getWeekStartEnd(expenseDate);
      const weekNumber = getWeekNumber(expenseDate);
      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          week: weekKey,
          weekStart: weekDates.start,
          weekEnd: weekDates.end,
          earnings: 0,
          miles: 0,
          trips: 0,
          expenses: 0,
        });
      }

      const insight = weeklyMap.get(weekKey)!;
      insight.expenses += expense.amount;
    }
  });

  return Array.from(weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Get daily insights for a specific week
 */
export async function getDailyInsights(weekStart: Date, weekEnd: Date): Promise<DailyInsight[]> {
  const trips = await getTrips();
  const expenses = await getExpenses();

  const dailyMap = new Map<string, DailyInsight>();

  // Initialize all days in the week
  const currentDate = new Date(weekStart);
  while (currentDate <= weekEnd) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyMap.set(dateKey, {
      date: dateKey,
      earnings: 0,
      miles: 0,
      trips: 0,
      expenses: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Process trips
  trips.forEach((trip) => {
    const tripDate = new Date(trip.date);
    if (tripDate >= weekStart && tripDate <= weekEnd) {
      const dateKey = tripDate.toISOString().split('T')[0];
      const insight = dailyMap.get(dateKey);
      if (insight) {
        insight.earnings += trip.earnings || 0;
        insight.miles += trip.miles || 0;
        insight.trips += 1;
      }
    }
  });

  // Process expenses
  expenses.forEach((expense) => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= weekStart && expenseDate <= weekEnd) {
      const dateKey = expenseDate.toISOString().split('T')[0];
      const insight = dailyMap.get(dateKey);
      if (insight) {
        insight.expenses += expense.amount;
      }
    }
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get week start and end dates
 */
function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get year-over-year comparison
 */
export async function getYearOverYearInsights(): Promise<YearOverYearInsight[]> {
  const currentYear = new Date().getFullYear();
  const insights: YearOverYearInsight[] = [];

  // Get data for current year and previous year
  for (const year of [currentYear - 1, currentYear]) {
    const monthly = await getMonthlyInsights(year);
    
    const totalEarnings = monthly.reduce((sum, m) => sum + m.earnings, 0);
    const totalMiles = monthly.reduce((sum, m) => sum + m.miles, 0);
    const totalTrips = monthly.reduce((sum, m) => sum + m.trips, 0);
    const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);
    const monthsWithData = monthly.filter((m) => m.earnings > 0 || m.miles > 0).length;
    const averageMonthlyEarnings = monthsWithData > 0 ? totalEarnings / monthsWithData : 0;

    insights.push({
      year,
      totalEarnings,
      totalMiles,
      totalTrips,
      totalExpenses,
      averageMonthlyEarnings,
    });
  }

  return insights.sort((a, b) => b.year - a.year);
}

/**
 * Save yearly summary to Supabase for historical tracking
 */
export async function saveYearlySummary(
  userId: string,
  year: number,
  summary: YearOverYearInsight
): Promise<void> {
  try {
    const { error } = await supabase.from('yearly_summaries').upsert({
      user_id: userId,
      year,
      total_earnings: summary.totalEarnings,
      total_miles: summary.totalMiles,
      total_trips: summary.totalTrips,
      total_expenses: summary.totalExpenses,
      average_monthly_earnings: summary.averageMonthlyEarnings,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving yearly summary:', error);
  }
}

/**
 * Get week number of year (ISO 8601)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
