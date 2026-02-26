/**
 * StepContainer - Onboarding step wrapper with consistent layout and fade-in animation
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface StepContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colorScheme?: 'dark' | 'light';
}

export default function StepContainer({
  title,
  subtitle,
  children,
  colorScheme = 'dark',
}: StepContainerProps) {
  const colors = Colors[colorScheme];
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.title,
          { color: colors.text, opacity: titleOpacity },
        ]}
      >
        {title}
      </Animated.Text>
      {subtitle && (
        <Animated.Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary, opacity: subtitleOpacity },
          ]}
        >
          {subtitle}
        </Animated.Text>
      )}
      <Animated.View
        style={{
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslateY }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    lineHeight: 22,
  },
});
