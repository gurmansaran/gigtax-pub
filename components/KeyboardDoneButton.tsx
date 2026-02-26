import React from 'react';
import {
  Platform,
  InputAccessoryView,
  View,
  TouchableOpacity,
  Text,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

type KeyboardDoneButtonProps = {
  accessoryID: string;
  label?: string;
};

/** iOS: InputAccessoryView "Done" bar above keyboard. Android: rely on returnKeyType="done" on each TextInput. */
export default function KeyboardDoneButton({ accessoryID, label = 'Done' }: KeyboardDoneButtonProps) {
  const { colors } = useRobinhoodTheme();

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={accessoryID}>
      <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.spacer} />
        <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.button} hitSlop={8}>
          <Text style={[styles.buttonText, { color: colors.primary }]}>{label}</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  spacer: {
    flex: 1,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
