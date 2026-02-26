import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  getMonthlyInsights,
  getWeeklyInsights,
  getYearOverYearInsights,
  getDailyInsights,
  type MonthlyInsight,
  type WeeklyInsight,
  type YearOverYearInsight,
  type DailyInsight,
} from '@/lib/insightsService';
import {
  getAnalyticsDashboard,
  type AnalyticsDashboardData,
  type PlatformBreakdown,
  PLATFORM_COLORS,
} from '@/lib/analyticsService';
import BarChart from '@/components/charts/BarChart';
import PieChart from '@/components/charts/PieChart';
import { Feather } from '@expo/vector-icons';
import { useRevenueCat, useAuth } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { StatusBar } from 'expo-status-bar';
import { InsightsSkeleton } from '@/components/ui/Skeletons';
import { InsightsEmpty } from '@/components/ui/EmptyStates';

function formatMoney(amount: number) {
  return `$${Math.round(amount || 0).toLocaleString()}`;
}

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function InsightsScreen() {
  const { loading: premiumLoading } = useRevenueCat();
  const { user } = useAuth();
  const { colors, isDark } = useRobinhoodTheme();
  const [monthlyInsights, setMonthlyInsights] = useState<MonthlyInsight[]>([]);
  const [yearOverYear, setYearOverYear] = useState<YearOverYearInsight[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyInsight | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyInsight | null>(null);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [viewMode, setViewMode] = useState<'overview' | 'monthly' | 'yearly'>('overview');

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDashboardData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  if (premiumLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{ padding: 24 }}>
          <InsightsSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  const loadInsights = useCallback(async () => {
    const currentYear = new Date().getFullYear();
    const monthly = await getMonthlyInsights(currentYear);
    setMonthlyInsights(monthly);

    const yoy = await getYearOverYearInsights();
    setYearOverYear(yoy);
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const data = await getAnalyticsDashboard(user.id, currentYear);
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user]);

  const loadWeeklyInsights = useCallback(async (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const weekly = await getWeeklyInsights(parseInt(year), parseInt(month));
    setWeeklyInsights(weekly);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
      loadAnalytics();
    }, [loadInsights, loadAnalytics])
  );

  const handleMonthPress = (month: MonthlyInsight) => {
    setSelectedMonth(month);
    loadWeeklyInsights(month.month);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderMonthlyItem = ({ item }: { item: MonthlyInsight }) => {
    const hasData = item.earnings > 0 || item.miles > 0;

    return (
      <TouchableOpacity
        style={[
          styles.monthCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          !hasData && styles.monthCardEmpty,
        ]}
        onPress={() => hasData && handleMonthPress(item)}>
        <View style={styles.monthHeader}>
          <Text style={[styles.monthName, { color: colors.text }]}>{formatMonth(item.month)}</Text>
          {hasData && <Text style={[styles.expandHint, { color: colors.primary }]}>Tap to view weekly</Text>}
        </View>
        {hasData ? (
          <>
            <View style={styles.monthStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Earnings</Text>
                <Text style={[styles.statValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{formatMoney(item.earnings || 0)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Miles</Text>
                <Text style={[styles.statValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{(item.miles || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
                <Text style={[styles.statValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{item.trips}</Text>
              </View>
            </View>
            <View style={[styles.expenseRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.expenseLabel, { color: colors.textSecondary }]}>Expenses:</Text>
              <Text style={[styles.expenseValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>{formatMoney(item.expenses)}</Text>
            </View>
          </>
        ) : (
          <Text style={[styles.emptyMonthText, { color: colors.textSecondary }]}>No data for this month</Text>
        )}
      </TouchableOpacity>
    );
  };

  const formatWeekRange = (weekStart: Date, weekEnd: Date): string => {
    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const handleWeekPress = async (week: WeeklyInsight) => {
    setSelectedWeek(week);
    const daily = await getDailyInsights(week.weekStart, week.weekEnd);
    setDailyInsights(daily);
  };

  const renderWeeklyItem = ({ item }: { item: WeeklyInsight }) => (
    <TouchableOpacity
      style={[styles.weekCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleWeekPress(item)}>
      <Text style={[styles.weekLabel, { color: colors.text }]}>
        {formatWeekRange(item.weekStart, item.weekEnd)}
      </Text>
      <View style={styles.weekStats}>
        <View style={styles.weekStatItem}>
          <Text style={[styles.weekStatLabel, { color: colors.textSecondary }]}>Earnings</Text>
          <Text style={[styles.weekStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{formatMoney(item.earnings || 0)}</Text>
        </View>
        <View style={styles.weekStatItem}>
          <Text style={[styles.weekStatLabel, { color: colors.textSecondary }]}>Miles</Text>
          <Text style={[styles.weekStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{(item.miles || 0).toFixed(1)}</Text>
        </View>
        <View style={styles.weekStatItem}>
          <Text style={[styles.weekStatLabel, { color: colors.textSecondary }]}>Trips</Text>
          <Text style={[styles.weekStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{item.trips}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderYearOverYearItem = ({ item }: { item: YearOverYearInsight }) => (
    <View style={[styles.yearCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.yearLabel, { color: colors.text }]}>{item.year}</Text>
      <View style={styles.yearStats}>
        <View style={styles.yearStatRow}>
          <Text style={[styles.yearStatLabel, { color: colors.textSecondary }]}>Total Earnings</Text>
          <Text style={[styles.yearStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{formatMoney(item.totalEarnings)}</Text>
        </View>
        <View style={styles.yearStatRow}>
          <Text style={[styles.yearStatLabel, { color: colors.textSecondary }]}>Total Miles</Text>
          <Text style={[styles.yearStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{item.totalMiles.toFixed(1)}</Text>
        </View>
        <View style={styles.yearStatRow}>
          <Text style={[styles.yearStatLabel, { color: colors.textSecondary }]}>Total Trips</Text>
          <Text style={[styles.yearStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{item.totalTrips}</Text>
        </View>
        <View style={styles.yearStatRow}>
          <Text style={[styles.yearStatLabel, { color: colors.textSecondary }]}>Avg Monthly</Text>
          <Text style={[styles.yearStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{formatMoney(item.averageMonthlyEarnings)}</Text>
        </View>
      </View>
    </View>
  );

  // ============================================================================
  // ANALYTICS OVERVIEW RENDER
  // ============================================================================

  const renderAnalyticsOverview = () => {
    if (analyticsLoading) {
      return <InsightsSkeleton />;
    }

    if (!analyticsData) {
      return <InsightsEmpty />;
    }

    const { summary, platformBreakdown, dayOfWeekPatterns, personalBests, earningsOverTime } = analyticsData;
    const hasData = summary.totalTrips > 0 || summary.totalEarnings > 0;

    if (!hasData) {
      return <InsightsEmpty />;
    }

    // Find best day of week
    const bestDayPattern = [...dayOfWeekPatterns].sort((a, b) => b.averageEarnings - a.averageEarnings)[0];

    return (
      <>
        {/* Summary Stats */}
        <View style={[styles.summaryGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Earned</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatMoney(summary.totalEarnings)}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Miles</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.totalMiles.toFixed(0)}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Trips</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.totalTrips}</Text>
            </View>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>$/Hour</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: 16 }]}>
                {summary.earningsPerHour > 0 ? `$${summary.earningsPerHour.toFixed(2)}` : '--'}
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>$/Trip</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: 16 }]}>
                {summary.averagePerTrip > 0 ? `$${summary.averagePerTrip.toFixed(2)}` : '--'}
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Hours</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: 16 }]}>
                {summary.totalHours.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Earnings Over Time */}
        {earningsOverTime.some((e) => e.earnings > 0) && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartCardHeader}>
              <Feather name="trending-up" size={18} color={colors.primary} />
              <Text style={[styles.chartCardTitle, { color: colors.text }]}>Earnings Over Time</Text>
            </View>
            <BarChart
              data={earningsOverTime.map((e) => ({
                label: e.label,
                value: e.earnings,
              }))}
              height={160}
              highlightMax
            />
          </View>
        )}

        {/* Platform Breakdown */}
        {platformBreakdown.length > 0 && platformBreakdown.some((p) => p.platform !== 'other' || platformBreakdown.length === 1) && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartCardHeader}>
              <Feather name="pie-chart" size={18} color={colors.primary} />
              <Text style={[styles.chartCardTitle, { color: colors.text }]}>Earnings by Platform</Text>
            </View>
            <PieChart
              data={platformBreakdown.map((p) => ({
                label: p.label,
                value: p.totalEarnings,
                percentage: p.percentage,
                color: p.color === '#000000' ? (isDark ? '#FFFFFF' : '#000000') : p.color,
              }))}
              size={160}
              strokeWidth={20}
            />
          </View>
        )}

        {/* Day of Week Patterns */}
        {dayOfWeekPatterns.some((d) => d.tripCount > 0) && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartCardHeader}>
              <Feather name="calendar" size={18} color={colors.primary} />
              <Text style={[styles.chartCardTitle, { color: colors.text }]}>Day-of-Week Patterns</Text>
            </View>
            {bestDayPattern && bestDayPattern.averageEarnings > 0 && (
              <Text style={[styles.chartInsight, { color: colors.primary }]}>
                Your best day is {bestDayPattern.day} ({formatMoney(bestDayPattern.averageEarnings)} avg)
              </Text>
            )}
            <BarChart
              data={dayOfWeekPatterns.map((d) => ({
                label: d.day,
                value: d.averageEarnings,
                highlighted: bestDayPattern ? d.dayIndex === bestDayPattern.dayIndex : false,
              }))}
              height={140}
              highlightMax={false}
              formatValue={(v) => (v > 0 ? `$${Math.round(v)}` : '')}
            />
          </View>
        )}

        {/* Personal Bests */}
        {personalBests.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartCardHeader}>
              <Feather name="award" size={18} color={colors.primary} />
              <Text style={[styles.chartCardTitle, { color: colors.text }]}>Personal Bests</Text>
            </View>
            <View style={styles.bestsGrid}>
              {personalBests.map((best, index) => (
                <View
                  key={index}
                  style={[styles.bestCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.bestLabel, { color: colors.textSecondary }]}>{best.label}</Text>
                  <Text style={[styles.bestValue, { color: colors.primary }]}>{best.formattedValue}</Text>
                  <Text style={[styles.bestDate, { color: colors.textSecondary }]}>
                    {best.date ? new Date(best.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </>
    );
  };

  // ============================================================================
  // DRILL-DOWN VIEWS
  // ============================================================================

  // Daily breakdown view
  if (selectedWeek) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setSelectedWeek(null)} style={styles.backIconButton}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text, fontSize: 24 }]}>Daily Breakdown</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {formatWeekRange(selectedWeek.weekStart, selectedWeek.weekEnd)}
          </Text>

          {dailyInsights.length > 0 ? (
            <>
              {dailyInsights.map((item, index) => (
                <React.Fragment key={item.date}>
                  {index > 0 && <View style={styles.separator} />}
                  <View style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.dayLabel, { color: colors.text }]}>
                      {new Date(item.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Text>
                    <View style={styles.dayStats}>
                      <View style={styles.dayStatItem}>
                        <Text style={[styles.dayStatLabel, { color: colors.textSecondary }]}>Earnings</Text>
                        <Text style={[styles.dayStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{formatMoney(item.earnings)}</Text>
                      </View>
                      <View style={styles.dayStatItem}>
                        <Text style={[styles.dayStatLabel, { color: colors.textSecondary }]}>Miles</Text>
                        <Text style={[styles.dayStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{(item.miles || 0).toFixed(1)}</Text>
                      </View>
                      <View style={styles.dayStatItem}>
                        <Text style={[styles.dayStatLabel, { color: colors.textSecondary }]}>Trips</Text>
                        <Text style={[styles.dayStatValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>{item.trips}</Text>
                      </View>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trips recorded for this week</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Weekly breakdown view
  if (selectedMonth) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setSelectedMonth(null)} style={styles.backIconButton}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text, fontSize: 24 }]}>Weekly Breakdown</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{formatMonth(selectedMonth.month)}</Text>

          {weeklyInsights.length > 0 ? (
            <>
              {weeklyInsights.map((item, index) => (
                <React.Fragment key={item.week}>
                  {index > 0 && <View style={styles.separator} />}
                  {renderWeeklyItem({ item })}
                </React.Fragment>
              ))}
            </>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No weekly data available</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // MAIN VIEW
  // ============================================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Insights</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Track your performance over time
          </Text>
        </View>

        {/* View Mode Toggle - 3 tabs */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
          {(['overview', 'monthly', 'yearly'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.toggleButton,
                viewMode === mode && { backgroundColor: colors.primary },
              ]}
              onPress={() => setViewMode(mode)}>
              <Text
                style={[
                  styles.toggleText,
                  { color: viewMode === mode ? colors.background : colors.textSecondary },
                ]}>
                {mode === 'overview' ? 'Overview' : mode === 'monthly' ? 'Monthly' : 'Yearly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview / Analytics Tab */}
        {viewMode === 'overview' && renderAnalyticsOverview()}

        {/* Monthly View */}
        {viewMode === 'monthly' && (
          <>
            {monthlyInsights.length > 0 ? (
              <>
                {monthlyInsights.map((item, index) => (
                  <React.Fragment key={item.month}>
                    {index > 0 && <View style={styles.separator} />}
                    {renderMonthlyItem({ item })}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No monthly data available</Text>
              </View>
            )}
          </>
        )}

        {/* Year-over-Year View */}
        {viewMode === 'yearly' && (
          <>
            {yearOverYear.length > 0 ? (
              <>
                {yearOverYear.map((item, index) => (
                  <React.Fragment key={item.year.toString()}>
                    {index > 0 && <View style={styles.separator} />}
                    {renderYearOverYearItem({ item })}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No year-over-year data available</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backIconButton: {
    padding: 8,
  },
  dayCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dayStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayStatItem: {
    alignItems: 'center',
  },
  dayStatLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dayStatValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthCardEmpty: {
    opacity: 0.5,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthName: {
    fontSize: 18,
    fontWeight: '700',
  },
  expandHint: {
    fontSize: 12,
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expenseLabel: {
    fontSize: 14,
  },
  expenseValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyMonthText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  weekCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  weekStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekStatItem: {
    alignItems: 'center',
  },
  weekStatLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  weekStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  yearCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  yearLabel: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  yearStats: {
    gap: 12,
  },
  yearStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yearStatLabel: {
    fontSize: 14,
  },
  yearStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  separator: {
    height: 12,
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: {
    fontSize: 16,
  },

  // ── Analytics Overview Styles ──
  summaryGrid: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chartCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  chartCardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  chartInsight: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  bestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bestCard: {
    width: '47%',
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bestLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  bestValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  bestDate: {
    fontSize: 11,
  },
});
