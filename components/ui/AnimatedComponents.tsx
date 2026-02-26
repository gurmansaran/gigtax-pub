/**
 * Animated Components
 * Reusable animation wrappers for entrance/press effects across the app.
 */

import React, { useEffect, useRef } from 'react';
import {
    Animated,
    TouchableOpacity,
    ViewStyle,
    StyleProp,
    type TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// ─── Fade-In Slide-Up ──────────────────────────────────────────────────────
// Wraps any content with a fade-in + slide-up entrance animation.

interface FadeInViewProps {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    slideDistance?: number;
    style?: StyleProp<ViewStyle>;
}

export function FadeInView({
    children,
    delay = 0,
    duration = 400,
    slideDistance = 20,
    style,
}: FadeInViewProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(slideDistance)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
            {children}
        </Animated.View>
    );
}

// ─── Staggered List ─────────────────────────────────────────────────────────
// Wraps each child with a staggered fade-in animation.

interface StaggeredListProps {
    children: React.ReactNode[];
    staggerDelay?: number;
    style?: StyleProp<ViewStyle>;
}

export function StaggeredList({
    children,
    staggerDelay = 60,
    style,
}: StaggeredListProps) {
    return (
        <Animated.View style={style}>
            {children.map((child, index) => (
                <FadeInView key={index} delay={index * staggerDelay}>
                    {child}
                </FadeInView>
            ))}
        </Animated.View>
    );
}

// ─── Pressable Scale Button ─────────────────────────────────────────────────
// Button with scale-down press animation + optional haptic feedback.

interface ScaleButtonProps extends TouchableOpacityProps {
    children: React.ReactNode;
    scaleValue?: number;
    hapticStyle?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
    style?: StyleProp<ViewStyle>;
}

export function ScaleButton({
    children,
    scaleValue = 0.95,
    hapticStyle = 'light',
    style,
    onPress,
    ...rest
}: ScaleButtonProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: scaleValue,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePress = (e: any) => {
        if (hapticStyle !== 'none') {
            switch (hapticStyle) {
                case 'light':
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    break;
                case 'medium':
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'heavy':
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    break;
                case 'selection':
                    Haptics.selectionAsync();
                    break;
            }
        }
        onPress?.(e);
    };

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            {...rest}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
}

// ─── Pulse Dot ──────────────────────────────────────────────────────────────
// Pulsing indicator dot for sync/status indicators.

interface PulseDotProps {
    color?: string;
    size?: number;
}

export function PulseDot({ color = '#C6FF5E', size = 8 }: PulseDotProps) {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scale, {
                        toValue: 1.5,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.4,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <Animated.View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity,
                transform: [{ scale }],
            }}
        />
    );
}
