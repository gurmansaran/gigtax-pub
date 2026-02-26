/**
 * Secure SSN Input with Show/Hide toggle
 * Uses shared input style (surface bg, thin border, radius).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

interface SSNInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  maxLength?: number;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  error?: string;
  /** iOS: show Done bar above keyboard. Pass same ID as KeyboardDoneButton. */
  inputAccessoryViewID?: string;
}

export default function SSNInput({
  value,
  onChangeText,
  placeholder = '123-45-6789',
  label,
  maxLength = 11,
  style,
  containerStyle,
  error,
  inputAccessoryViewID,
}: SSNInputProps) {
  const { colors } = useRobinhoodTheme();
  const [showSSN, setShowSSN] = useState(false);

  const formatSSN = (text: string): string => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  };

  const handleChange = (text: string) => {
    onChangeText(formatSSN(text));
  };

  const shared = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    minHeight: 50,
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={[styles.inputWrapper, shared, containerStyle]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={!showSSN}
          keyboardType="numeric"
          maxLength={maxLength}
          returnKeyType="done"
          blurOnSubmit={true}
          inputAccessoryViewID={inputAccessoryViewID}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowSSN(!showSSN)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name={showSSN ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
});
