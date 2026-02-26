/**
 * Robinhood Design System - Color Tokens
 * High-contrast, data-heavy, minimalist design
 * Unified accent: #C6FF5E
 */

export const Colors = {
  dark: {
    // Backgrounds
    background: '#000000',
    surface: '#1C1C1E',
    surfaceElevated: '#2C2C2E',
    card: '#1A1A1A',

    // Brand
    primary: '#C6FF5E',
    primaryDark: '#A8D94E',
    gradientStart: '#C6FF5E',
    gradientEnd: '#A8D94E',

    // Text
    text: '#FFFFFF',
    textSecondary: '#8E8E93',

    // Borders
    border: '#2C2C2E',
    borderLight: '#333333',

    // Status
    error: '#FF3B30',
    success: '#C6FF5E',
    warning: '#FF9500',

    // Progress
    progressBg: '#333333',
  },
  light: {
    // Backgrounds
    background: '#FFFFFF',
    surface: '#F2F2F7',
    surfaceElevated: '#E5E5EA',
    card: '#F2F2F7',

    // Brand (slightly darker lime for white bg readability)
    primary: '#7CB518',
    primaryDark: '#6A9E15',
    gradientStart: '#7CB518',
    gradientEnd: '#6A9E15',

    // Text
    text: '#000000',
    textSecondary: '#636366',

    // Borders
    border: '#E5E5EA',
    borderLight: '#D1D1D6',

    // Status
    error: '#FF3B30',
    success: '#7CB518',
    warning: '#FF9500',

    // Progress
    progressBg: '#D1D1D6',
  },
};

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = (typeof Colors)['dark'];
