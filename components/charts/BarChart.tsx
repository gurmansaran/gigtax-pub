/**
 * Simple bar chart built with pure React Native Views.
 * No charting library required.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

export interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
  highlighted?: boolean;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  height?: number;
  showValues?: boolean;
  formatValue?: (v: number) => string;
  highlightMax?: boolean;
  barRadius?: number;
}

export default function BarChart({
  data,
  height = 180,
  showValues = true,
  formatValue = (v) => `$${Math.round(v)}`,
  highlightMax = false,
  barRadius = 6,
}: BarChartProps) {
  const { colors } = useRobinhoodTheme();
  const animatedValues = useRef(data.map(() => new Animated.Value(0))).current;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxIndex = highlightMax ? data.reduce((mi, d, i, arr) => (d.value > arr[mi].value ? i : mi), 0) : -1;

  useEffect(() => {
    const animations = animatedValues.map((anim, i) =>
      Animated.timing(anim, {
        toValue: data[i]?.value || 0,
        duration: 600,
        delay: i * 50,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [data]);

  if (data.length === 0) return null;

  return (
    <View style={[styles.container, { height: height + 40 }]}>
      <View style={[styles.chartArea, { height }]}>
        {data.map((item, index) => {
          const isHighlighted = item.highlighted || index === maxIndex;
          const barColor = item.color || (isHighlighted ? colors.primary : colors.surfaceElevated);
          const barHeight = animatedValues[index].interpolate({
            inputRange: [0, maxValue],
            outputRange: [0, height - 24],
            extrapolate: 'clamp',
          });

          return (
            <View key={index} style={styles.barColumn}>
              {showValues && item.value > 0 && (
                <Text
                  style={[
                    styles.barValue,
                    { color: isHighlighted ? colors.primary : colors.textSecondary },
                  ]}
                  numberOfLines={1}>
                  {formatValue(item.value)}
                </Text>
              )}
              <View style={styles.barWrapper}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: barColor,
                      borderTopLeftRadius: barRadius,
                      borderTopRightRadius: barRadius,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((item, index) => {
          const isHighlighted = item.highlighted || index === maxIndex;
          return (
            <Text
              key={index}
              style={[
                styles.barLabel,
                { color: isHighlighted ? colors.text : colors.textSecondary },
                isHighlighted && styles.barLabelHighlighted,
              ]}
              numberOfLines={1}>
              {item.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    minHeight: 2,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  barLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
  },
  barLabelHighlighted: {
    fontWeight: '700',
  },
});
