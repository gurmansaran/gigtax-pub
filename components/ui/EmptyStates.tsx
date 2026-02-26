/**
 * Empty State Components
 * Shown when a tab or screen has no data to display.
 * Each includes a Feather icon, heading, subtext, and optional CTA button.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ============================================================================
// Generic Empty State
// ============================================================================

interface EmptyStateProps {
    iconName: React.ComponentProps<typeof Feather>['name'];
    title: string;
    subtitle: string;
    buttonLabel?: string;
    onPress?: () => void;
}

export function EmptyState({ iconName, title, subtitle, buttonLabel, onPress }: EmptyStateProps) {
    const { colors } = useRobinhoodTheme();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    return (
        <View style={emptyStyles.container}>
            <View style={[emptyStyles.iconCircle, { backgroundColor: colors.surface }]}>
                <Feather name={iconName} size={32} color={colors.textSecondary} />
            </View>
            <Text style={[emptyStyles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[emptyStyles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            {buttonLabel && onPress && (
                <TouchableOpacity
                    style={emptyStyles.button}
                    onPress={handlePress}
                    activeOpacity={0.8}
                    accessibilityLabel={buttonLabel}
                    accessibilityRole="button"
                >
                    <LinearGradient
                        colors={[colors.gradientStart, colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={emptyStyles.buttonGradient}
                    >
                        <Text style={emptyStyles.buttonText}>{buttonLabel}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ============================================================================
// Pre-built Empty States
// ============================================================================

export function EarningsEmpty({ onPress }: { onPress?: () => void }) {
    return (
        <EmptyState
            iconName="dollar-sign"
            title="No Earnings Yet"
            subtitle="Start tracking your income by tapping the + button above"
            buttonLabel="Add Earnings"
            onPress={onPress}
        />
    );
}

export function ExpensesEmpty({ onPress }: { onPress?: () => void }) {
    return (
        <EmptyState
            iconName="file-text"
            title="No Expenses Tracked"
            subtitle="Track your business expenses to maximize your tax deductions"
            buttonLabel="Add Expense"
            onPress={onPress}
        />
    );
}

export function MileageEmpty({ onPress }: { onPress?: () => void }) {
    return (
        <EmptyState
            iconName="navigation"
            title="No Trips Tracked"
            subtitle="Start a shift to automatically track your business mileage"
            buttonLabel="Start Shift"
            onPress={onPress}
        />
    );
}

export function InsightsEmpty({ onPress }: { onPress?: () => void }) {
    return (
        <EmptyState
            iconName="bar-chart-2"
            title="Not Enough Data Yet"
            subtitle="Track at least 7 days of earnings to see insights and patterns"
            buttonLabel="Go to Earnings"
            onPress={onPress}
        />
    );
}

export function FileNowEmpty({ onPress }: { onPress?: () => void }) {
    return (
        <EmptyState
            iconName="clipboard"
            title="Ready to File Your Taxes?"
            subtitle="We'll guide you through every step of filing your return"
            buttonLabel="Start Filing"
            onPress={onPress}
        />
    );
}

// ============================================================================
// Styles
// ============================================================================

const emptyStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 180,
    },
    buttonGradient: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
});
