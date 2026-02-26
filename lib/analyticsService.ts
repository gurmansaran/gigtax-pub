/**
 * Analytics Service
 * Aggregates earnings, mileage, and platform data for the analytics dashboard
 */

import { supabase } from './supabase';
import { getTrips, type Trip } from './tripStore';
import { getExpenses } from './expenseStore';
import { PLATFORM_COLORS, PLATFORM_LABELS, type GigPlatform } from './csvImportService';

export { PLATFORM_COLORS, PLATFORM_LABELS };

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformBreakdown {
  platform: string;
  label: string;
  totalEarnings: number;
  recordCount: number;
  percentage: number;
  color: string;
}

export interface DayOfWeekPattern {
  day: string;
  dayIndex: number; // 0 = Sunday, 6 = Saturday
  totalEarnings: number;
  averageEarnings: number;
  tripCount: number;
  totalMiles: number;
}

export interface PersonalBest {
  type: 'best_day' | 'best_week' | 'best_month' | 'most_miles_day';
  value: number;
  date: string;
  label: string;
  formattedValue: string;
}

export interface EarningsOverTime {
  label: string;
  periodKey: string;
  earnings: number;
  miles: number;
  trips: number;
}

export interface AnalyticsSummary {
  totalEarnings: number;
  totalMiles: number;
  totalTrips: number;
  totalHours: number;
  earningsPerHour: number;
  averagePerTrip: number;
  averagePerMile: number;
  daysTracked: number;
}

export interface AnalyticsDashboardData {
  summary: AnalyticsSummary;
  platformBreakdown: PlatformBreakdown[];
  dayOfWeekPatterns: DayOfWeekPattern[];
  personalBests: PersonalBest[];
  earningsOverTime: EarningsOverTime[];
}

// ============================================================================
// HELPERS
// ============================================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDurationToHours(duration: string): number {
  if (!duration) return 0;
  // Expected format: "HH:MM:SS" or "H:MM:SS"
  const parts = duration.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h + m / 60 + s / 3600;
  }
  if (parts.length === 2) {
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h + m / 60;
  }
  return 0;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getWeekKey(date: Date): string {
  // ISO week: Monday-based weeks
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function formatWeekLabel(weekKey: string): string {
  // "2025-W05" -> "W5"
  const parts = weekKey.split('-W');
  return `W${parseInt(parts[1])}`;
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Get platform breakdown from Supabase user_income
 */
export async function getPlatformBreakdown(
  userId: string,
  year: number
): Promise<PlatformBreakdown[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data, error } = await supabase
    .from('user_income')
    .select('platform, amount')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) return [];

  // Group by platform
  const platformMap = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;

  for (const record of data) {
    const platform = record.platform || 'other';
    const existing = platformMap.get(platform) || { total: 0, count: 0 };
    existing.total += parseFloat(record.amount) || 0;
    existing.count += 1;
    platformMap.set(platform, existing);
    grandTotal += parseFloat(record.amount) || 0;
  }

  const breakdown: PlatformBreakdown[] = [];
  for (const [platform, stats] of platformMap) {
    breakdown.push({
      platform,
      label: PLATFORM_LABELS[platform as GigPlatform] || platform,
      totalEarnings: stats.total,
      recordCount: stats.count,
      percentage: grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0,
      color: PLATFORM_COLORS[platform as GigPlatform] || '#8E8E93',
    });
  }

  return breakdown.sort((a, b) => b.totalEarnings - a.totalEarnings);
}

/**
 * Get day-of-week earnings patterns from trips
 */
export async function getDayOfWeekPatterns(year: number): Promise<DayOfWeekPattern[]> {
  const trips = await getTrips();
  const yearTrips = trips.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year;
  });

  // Group by day of week
  const dayMap: Record<number, { earnings: number; miles: number; count: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayMap[i] = { earnings: 0, miles: 0, count: 0 };
  }

  for (const trip of yearTrips) {
    const dayOfWeek = new Date(trip.date).getDay();
    dayMap[dayOfWeek].earnings += trip.earnings || 0;
    dayMap[dayOfWeek].miles += trip.miles || 0;
    dayMap[dayOfWeek].count += 1;
  }

  return Object.entries(dayMap).map(([dayIdx, stats]) => {
    const idx = parseInt(dayIdx);
    return {
      day: DAY_NAMES[idx],
      dayIndex: idx,
      totalEarnings: stats.earnings,
      averageEarnings: stats.count > 0 ? stats.earnings / stats.count : 0,
      tripCount: stats.count,
      totalMiles: stats.miles,
    };
  });
}

/**
 * Calculate personal bests from trips and income
 */
export async function getPersonalBests(
  userId: string,
  year: number
): Promise<PersonalBest[]> {
  const trips = await getTrips();
  const yearTrips = trips.filter((t) => new Date(t.date).getFullYear() === year);
  const bests: PersonalBest[] = [];

  if (yearTrips.length === 0) return bests;

  // Best single-day earnings (from trips)
  const dailyEarnings = new Map<string, number>();
  for (const trip of yearTrips) {
    const dateKey = trip.date;
    dailyEarnings.set(dateKey, (dailyEarnings.get(dateKey) || 0) + (trip.earnings || 0));
  }

  let bestDayDate = '';
  let bestDayAmount = 0;
  for (const [date, amount] of dailyEarnings) {
    if (amount > bestDayAmount) {
      bestDayAmount = amount;
      bestDayDate = date;
    }
  }

  if (bestDayAmount > 0) {
    bests.push({
      type: 'best_day',
      value: bestDayAmount,
      date: bestDayDate,
      label: 'Best Day',
      formattedValue: formatMoney(bestDayAmount),
    });
  }

  // Best week
  const weeklyEarnings = new Map<string, { total: number; firstDate: string }>();
  for (const trip of yearTrips) {
    const weekKey = getWeekKey(new Date(trip.date));
    const existing = weeklyEarnings.get(weekKey) || { total: 0, firstDate: trip.date };
    existing.total += trip.earnings || 0;
    weeklyEarnings.set(weekKey, existing);
  }

  let bestWeekKey = '';
  let bestWeekAmount = 0;
  let bestWeekDate = '';
  for (const [week, data] of weeklyEarnings) {
    if (data.total > bestWeekAmount) {
      bestWeekAmount = data.total;
      bestWeekKey = week;
      bestWeekDate = data.firstDate;
    }
  }

  if (bestWeekAmount > 0) {
    bests.push({
      type: 'best_week',
      value: bestWeekAmount,
      date: bestWeekDate,
      label: 'Best Week',
      formattedValue: formatMoney(bestWeekAmount),
    });
  }

  // Best month
  const monthlyEarnings = new Map<string, number>();
  for (const trip of yearTrips) {
    const monthKey = getMonthKey(new Date(trip.date));
    monthlyEarnings.set(monthKey, (monthlyEarnings.get(monthKey) || 0) + (trip.earnings || 0));
  }

  let bestMonthKey = '';
  let bestMonthAmount = 0;
  for (const [month, amount] of monthlyEarnings) {
    if (amount > bestMonthAmount) {
      bestMonthAmount = amount;
      bestMonthKey = month;
    }
  }

  if (bestMonthAmount > 0) {
    bests.push({
      type: 'best_month',
      value: bestMonthAmount,
      date: bestMonthKey,
      label: 'Best Month',
      formattedValue: formatMoney(bestMonthAmount),
    });
  }

  // Most miles in a day
  const dailyMiles = new Map<string, number>();
  for (const trip of yearTrips) {
    const dateKey = trip.date;
    dailyMiles.set(dateKey, (dailyMiles.get(dateKey) || 0) + (trip.miles || 0));
  }

  let bestMilesDate = '';
  let bestMilesAmount = 0;
  for (const [date, miles] of dailyMiles) {
    if (miles > bestMilesAmount) {
      bestMilesAmount = miles;
      bestMilesDate = date;
    }
  }

  if (bestMilesAmount > 0) {
    bests.push({
      type: 'most_miles_day',
      value: bestMilesAmount,
      date: bestMilesDate,
      label: 'Most Miles (Day)',
      formattedValue: `${bestMilesAmount.toFixed(1)} mi`,
    });
  }

  return bests;
}

/**
 * Get earnings over time (weekly or monthly)
 */
export async function getEarningsTimeline(
  year: number,
  granularity: 'weekly' | 'monthly' = 'monthly'
): Promise<EarningsOverTime[]> {
  const trips = await getTrips();
  const yearTrips = trips.filter((t) => new Date(t.date).getFullYear() === year);

  if (granularity === 'monthly') {
    const monthMap = new Map<string, EarningsOverTime>();

    // Initialize all 12 months
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      monthMap.set(key, {
        label: formatMonthLabel(key),
        periodKey: key,
        earnings: 0,
        miles: 0,
        trips: 0,
      });
    }

    for (const trip of yearTrips) {
      const key = getMonthKey(new Date(trip.date));
      const entry = monthMap.get(key);
      if (entry) {
        entry.earnings += trip.earnings || 0;
        entry.miles += trip.miles || 0;
        entry.trips += 1;
      }
    }

    return Array.from(monthMap.values());
  }

  // Weekly granularity - last 12 weeks
  const weekMap = new Map<string, EarningsOverTime>();

  for (const trip of yearTrips) {
    const key = getWeekKey(new Date(trip.date));
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        label: formatWeekLabel(key),
        periodKey: key,
        earnings: 0,
        miles: 0,
        trips: 0,
      });
    }
    const entry = weekMap.get(key)!;
    entry.earnings += trip.earnings || 0;
    entry.miles += trip.miles || 0;
    entry.trips += 1;
  }

  return Array.from(weekMap.values())
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
    .slice(-12);
}

/**
 * Get full analytics summary
 */
export async function getAnalyticsSummary(year: number): Promise<AnalyticsSummary> {
  const trips = await getTrips();
  const yearTrips = trips.filter((t) => new Date(t.date).getFullYear() === year);

  const totalEarnings = yearTrips.reduce((sum, t) => sum + (t.earnings || 0), 0);
  const totalMiles = yearTrips.reduce((sum, t) => sum + (t.miles || 0), 0);
  const totalTrips = yearTrips.length;
  const totalHours = yearTrips.reduce((sum, t) => sum + parseDurationToHours(t.duration), 0);

  const uniqueDates = new Set(yearTrips.map((t) => t.date));
  const daysTracked = uniqueDates.size;

  return {
    totalEarnings,
    totalMiles,
    totalTrips,
    totalHours,
    earningsPerHour: totalHours > 0 ? totalEarnings / totalHours : 0,
    averagePerTrip: totalTrips > 0 ? totalEarnings / totalTrips : 0,
    averagePerMile: totalMiles > 0 ? totalEarnings / totalMiles : 0,
    daysTracked,
  };
}

/**
 * Get full dashboard data
 */
export async function getAnalyticsDashboard(
  userId: string,
  year: number
): Promise<AnalyticsDashboardData> {
  const [summary, platformBreakdown, dayOfWeekPatterns, personalBests, earningsOverTime] =
    await Promise.all([
      getAnalyticsSummary(year),
      getPlatformBreakdown(userId, year),
      getDayOfWeekPatterns(year),
      getPersonalBests(userId, year),
      getEarningsTimeline(year, 'monthly'),
    ]);

  return {
    summary,
    platformBreakdown,
    dayOfWeekPatterns,
    personalBests,
    earningsOverTime,
  };
}
