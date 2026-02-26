/**
 * Skeleton Loading Components
 * Shimmer-effect placeholders for loading states across the app.
 * Uses expo-linear-gradient + Animated API for smooth left-to-right shimmer.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Shimmer Effect Base
// ============================================================================

function ShimmerEffect({ style }: { style?: any }) {
  const { colors, isDark } = useRobinhoodTheme();
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  const baseColor = isDark ? '#1C1C1E' : '#E5E5EA';
  const shimmerColor = isDark ? '#2C2C2E' : '#F2F2F7';

  return (
    <View style={[{ overflow: 'hidden', borderRadius: 8, backgroundColor: baseColor }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

export function CardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <View style={skeletonStyles.cardContainer}>
      <ShimmerEffect style={{ height, borderRadius: 12 }} />
    </View>
  );
}

// ============================================================================
// List Item Skeleton
// ============================================================================

export function ListItemSkeleton() {
  return (
    <View style={skeletonStyles.listItem}>
      <ShimmerEffect style={skeletonStyles.listItemCircle} />
      <View style={skeletonStyles.listItemTextContainer}>
        <ShimmerEffect style={skeletonStyles.listItemTextLong} />
        <ShimmerEffect style={skeletonStyles.listItemTextShort} />
      </View>
      <ShimmerEffect style={skeletonStyles.listItemAmount} />
    </View>
  );
}

// ============================================================================
// Chart Skeleton
// ============================================================================

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <View style={[skeletonStyles.chartContainer, { height }]}>
      <View style={skeletonStyles.chartBars}>
        {[0.6, 0.8, 0.45, 0.9, 0.5, 0.7, 0.35].map((h, i) => (
          <ShimmerEffect
            key={i}
            style={[skeletonStyles.chartBar, { height: `${h * 100}%` }]}
          />
        ))}
      </View>
      <ShimmerEffect style={skeletonStyles.chartXAxis} />
    </View>
  );
}

// ============================================================================
// Text Skeleton
// ============================================================================

export function TextSkeleton({ width = '60%', height = 14 }: { width?: string | number; height?: number }) {
  return <ShimmerEffect style={{ width, height, borderRadius: 4 }} />;
}

// ============================================================================
// Dashboard Skeleton
// ============================================================================

export function DashboardSkeleton() {
  return (
    <View style={skeletonStyles.dashboardContainer}>
      <CardSkeleton height={160} />
      <View style={{ gap: 12 }}>
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </View>
    </View>
  );
}

// ============================================================================
// Earnings Skeleton
// ============================================================================

export function EarningsSkeleton() {
  return (
    <View style={skeletonStyles.listContainer}>
      <CardSkeleton height={80} />
      <View style={{ gap: 12, marginTop: 16 }}>
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </View>
    </View>
  );
}

// ============================================================================
// Expenses Skeleton
// ============================================================================

export function ExpensesSkeleton() {
  return (
    <View style={skeletonStyles.listContainer}>
      <CardSkeleton height={80} />
      <View style={{ gap: 12, marginTop: 16 }}>
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </View>
    </View>
  );
}

// ============================================================================
// Insights Skeleton
// ============================================================================

export function InsightsSkeleton() {
  return (
    <View style={skeletonStyles.insightsContainer}>
      <View style={skeletonStyles.insightsCards}>
        <CardSkeleton height={100} />
        <CardSkeleton height={100} />
      </View>
      <ChartSkeleton height={200} />
      <CardSkeleton height={80} />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const skeletonStyles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  listItemCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  listItemTextContainer: {
    flex: 1,
    gap: 6,
  },
  listItemTextLong: {
    width: '70%',
    height: 14,
    borderRadius: 4,
  },
  listItemTextShort: {
    width: '45%',
    height: 12,
    borderRadius: 4,
  },
  listItemAmount: {
    width: 60,
    height: 16,
    borderRadius: 4,
  },
  chartContainer: {
    marginBottom: 16,
    justifyContent: 'flex-end',
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingBottom: 8,
  },
  chartBar: {
    flex: 1,
    borderRadius: 4,
    minHeight: 20,
  },
  chartXAxis: {
    height: 8,
    borderRadius: 4,
  },
  dashboardContainer: {
    gap: 16,
  },
  listContainer: {
    gap: 4,
  },
  insightsContainer: {
    gap: 16,
  },
  insightsCards: {
    flexDirection: 'row',
    gap: 12,
  },
});
