/**
 * ProgressBar - Animated progress bar for onboarding and wizards
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ProgressBarProps {
  progress: number; // 0-1
  colorScheme?: 'dark' | 'light';
  height?: number;
}

export default function ProgressBar({
  progress,
  colorScheme = 'dark',
  height = 6,
}: ProgressBarProps) {
  const colors = Colors[colorScheme];
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: colors.progressBg },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width,
            height,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 3,
  },
});
