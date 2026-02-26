/**
 * BlurMoneyInput — Money input that only saves on blur
 * Prevents firing updateField on every keystroke when typing large numbers.
 * Shows formatted value when not focused; raw text when editing.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { formatMoneyInput, parseMoneyInput } from '@/lib/moneyFormatter';

interface BlurMoneyInputProps {
  label: string;
  value: number;
  onSave: (value: number) => void;
  hint?: string;
  importedHint?: string; // e.g. "Imported from GigTax"
}

export default function BlurMoneyInput({ label, value, onSave, hint, importedHint }: BlurMoneyInputProps) {
  const { colors } = useRobinhoodTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState(() =>
    value > 0 ? value.toString() : ''
  );
  const lastSavedValue = useRef(value);

  // Sync from external value changes (e.g. scan import, auto-import)
  // but NOT while the user is actively typing
  useEffect(() => {
    if (!isFocused && value !== lastSavedValue.current) {
      setLocalText(value > 0 ? value.toString() : '');
      lastSavedValue.current = value;
    }
  }, [value, isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Show raw number for editing
    setLocalText(value > 0 ? value.toString() : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseMoneyInput(localText);
    lastSavedValue.current = parsed;
    onSave(parsed);
  }, [localText, onSave]);

  const handleChangeText = useCallback((text: string) => {
    // Allow only digits and decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    setLocalText(cleaned);
  }, []);

  const displayValue = isFocused ? localText : formatMoneyInput(value);

  return (
    <View style={styles.formField}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>}
      <TextInput
        style={[styles.input, {
          backgroundColor: isFocused ? colors.background : colors.surface,
          color: colors.text,
          borderColor: isFocused ? colors.primary : colors.border,
        }]}
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="numeric"
      />
      {importedHint && value > 0 && !isFocused && (
        <Text style={[styles.importedHint, { color: colors.primary }]}>{importedHint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formField: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 4, fontStyle: 'italic' },
  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  importedHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
