/**
 * Global Input - Theme-aware.
 * Adapts to system light/dark mode automatically.
 * No hardcoded dark backgrounds.
 */

import React, { useContext } from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native';
import { ThemePreferenceContext } from '@/lib/ThemePreferenceContext';
import { Colors } from '@/constants/Colors';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: object;
  inputStyle?: object;
  /** When true: autoCapitalize="none", autoCorrect={false} (for emails) */
  email?: boolean;
  /** Label text style override */
  labelStyle?: object;
}

export default function Input({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  email = false,
  style,
  placeholderTextColor,
  selectionColor,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  textContentType,
  ...rest
}: InputProps) {
  const ctx = useContext(ThemePreferenceContext);
  const scheme = ctx?.colorScheme ?? 'dark';
  const colors = Colors[scheme];

  return (
    <View style={[styles.container, containerStyle]}>
      {label != null && (
        <Text style={[styles.label, { color: colors.textSecondary }, labelStyle]}>{label}</Text>
      )}
      <TextInput
        {...rest}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          },
          inputStyle,
          style,
        ]}
        placeholderTextColor={placeholderTextColor ?? colors.textSecondary}
        selectionColor={selectionColor ?? colors.primary}
        autoCapitalize={email ? 'none' : autoCapitalize}
        autoCorrect={email ? false : autoCorrect}
        autoComplete={email ? 'email' : (autoComplete ?? 'off')}
        textContentType={email ? 'emailAddress' : (textContentType ?? 'none')}
      />
      {error != null && error !== '' && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: { fontSize: 12, color: '#FF3B30', marginTop: 4 },
});
