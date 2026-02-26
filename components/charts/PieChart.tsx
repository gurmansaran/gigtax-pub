/**
 * Simple donut/pie chart built with pure React Native Views.
 * Uses rotated half-circle technique for segments.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

export interface PieChartSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface PieChartProps {
  data: PieChartSlice[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  formatValue?: (v: number) => string;
}

export default function PieChart({
  data,
  size = 180,
  strokeWidth = 24,
  showLegend = true,
  formatValue = (v) => `$${Math.round(v).toLocaleString()}`,
}: PieChartProps) {
  const { colors } = useRobinhoodTheme();
  const radius = size / 2;
  const innerRadius = radius - strokeWidth;

  // Generate arc segments using overlapping half-circles
  const segments = generateSegments(data, size, strokeWidth);

  if (data.length === 0) return null;

  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <View style={styles.container}>
      {/* Pie chart */}
      <View style={[styles.chartContainer, { width: size, height: size }]}>
        {/* Background circle */}
        <View
          style={[
            styles.backgroundCircle,
            {
              width: size,
              height: size,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: colors.surfaceElevated,
            },
          ]}
        />

        {/* Colored segments */}
        {segments.map((segment, index) => (
          <View
            key={index}
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ rotate: `${segment.rotation}deg` }] },
            ]}>
            <View style={styles.halfContainer}>
              <View
                style={[
                  styles.halfCircle,
                  {
                    width: size,
                    height: radius,
                    borderTopLeftRadius: radius,
                    borderTopRightRadius: radius,
                    borderWidth: strokeWidth,
                    borderBottomWidth: 0,
                    borderColor: segment.color,
                  },
                  segment.degrees <= 180 && {
                    transform: [{ rotate: `${segment.degrees}deg` }],
                    transformOrigin: `${radius}px ${radius}px`,
                  },
                ]}
              />
            </View>
            {segment.degrees > 180 && (
              <View style={[styles.halfContainer, { top: 0 }]}>
                <View
                  style={[
                    styles.halfCircle,
                    {
                      width: size,
                      height: radius,
                      borderTopLeftRadius: radius,
                      borderTopRightRadius: radius,
                      borderWidth: strokeWidth,
                      borderBottomWidth: 0,
                      borderColor: segment.color,
                      transform: [{ rotate: '180deg' }],
                      transformOrigin: `${radius}px ${radius}px`,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        ))}

        {/* Inner circle (hole) */}
        <View
          style={[
            styles.innerCircle,
            {
              width: innerRadius * 2,
              height: innerRadius * 2,
              borderRadius: innerRadius,
              backgroundColor: colors.surface,
            },
          ]}>
          <Text style={[styles.centerValue, { color: colors.text }]}>
            {formatValue(totalValue)}
          </Text>
          <Text style={[styles.centerLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
      </View>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legend}>
          {data.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.legendValue, { color: colors.textSecondary }]}>
                {formatValue(item.value)}
              </Text>
              <Text style={[styles.legendPercent, { color: colors.primary }]}>
                {Math.round(item.percentage)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface Segment {
  color: string;
  rotation: number;
  degrees: number;
}

function generateSegments(data: PieChartSlice[], size: number, strokeWidth: number): Segment[] {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return [];

  const segments: Segment[] = [];
  let currentAngle = -90; // Start from top

  for (const item of data) {
    const degrees = (item.value / total) * 360;
    if (degrees < 1) continue; // Skip negligible slices

    segments.push({
      color: item.color,
      rotation: currentAngle,
      degrees: Math.min(degrees, 359.9),
    });

    currentAngle += degrees;
  }

  return segments;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backgroundCircle: {
    position: 'absolute',
  },
  halfContainer: {
    position: 'absolute',
    width: '100%',
    height: '50%',
    overflow: 'hidden',
  },
  halfCircle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  innerCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  centerLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  legend: {
    marginTop: 20,
    width: '100%',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  legendPercent: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    width: 40,
    textAlign: 'right',
  },
});
