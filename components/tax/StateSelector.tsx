/**
 * Searchable State Selector
 * Trigger styled like standard text input; modal with search + 50 US states.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

interface StateSelectorProps {
  value: string;
  onSelect: (code: string) => void;
  label?: string;
  hint?: string;
  /** Applied to trigger + list items. Must match PersonalDetailsStep shared input style. */
  triggerStyle?: object;
}

export default function StateSelector({
  value,
  onSelect,
  label,
  hint,
  triggerStyle,
}: StateSelectorProps) {
  const { colors } = useRobinhoodTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const displayValue = useMemo(() => {
    if (!value) return '';
    const s = US_STATES.find((x) => x.code === value);
    return s ? `${s.code} – ${s.name}` : value;
  }, [value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }, [search]);

  const openModal = () => {
    setSearch('');
    setModalVisible(true);
  };

  const selectState = (code: string) => {
    onSelect(code);
    setModalVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      {hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
          triggerStyle,
        ]}
        onPress={openModal}
        activeOpacity={0.7}>
        <Text
          style={[styles.triggerText, { color: value ? colors.text : colors.textSecondary }]}
          numberOfLines={1}>
          {displayValue || 'Select state'}
        </Text>
        <Feather name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalInner}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search states..."
                  placeholderTextColor={colors.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.code}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.textSecondary }]}>No states match.</Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.listItem,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => selectState(item.code)}>
                    <Text style={[styles.listItemText, { color: colors.text }]}>
                      {item.code} – {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  triggerText: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalInner: {
    maxHeight: '70%',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    paddingVertical: 0,
  },
  list: {
    maxHeight: 320,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemText: {
    fontSize: 16,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 15,
  },
});
