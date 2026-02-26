/**
 * FormInput - Dark-themed input with label, error state, icons, secureTextEntry toggle
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  error?: string;
  colorScheme?: 'dark' | 'light';
  secureToggle?: boolean;
}

export default function FormInput({
  label,
  icon,
  error,
  colorScheme = 'dark',
  secureToggle = false,
  secureTextEntry,
  ...rest
}: FormInputProps) {
  const colors = Colors[colorScheme];
  const [showSecure, setShowSecure] = useState(false);

  const isSecure = secureToggle ? !showSecure : secureTextEntry;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.error : colors.borderLight,
          },
        ]}
      >
        {icon && (
          <Feather
            name={icon}
            size={20}
            color={colors.textSecondary}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={isSecure}
          {...rest}
        />
        {secureToggle && (
          <TouchableOpacity
            onPress={() => setShowSecure(!showSecure)}
            style={styles.eyeButton}
          >
            <Feather
              name={showSecure ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
