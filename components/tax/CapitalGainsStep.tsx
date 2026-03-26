/**
 * Capital Gains Step – Short-Term vs Long-Term, My vs Spouse, Scan 1099-B
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { formatMoneyInput, parseMoneyInput } from '@/lib/moneyFormatter';
import { scanTaxDocument, type Scanned1099BData } from '@/lib/saranOcrService';
import type { CapitalGains as CapitalGainsType } from '@/lib/types';

interface CapitalGainsStepProps {
  primaryGains: CapitalGainsType;
  spouseGains: CapitalGainsType;
  onPrimaryGainsChange: (g: CapitalGainsType) => void;
  onSpouseGainsChange: (g: CapitalGainsType) => void;
  /** When true, show "My Gains" vs "Spouse's Gains" toggle. */
  showSpouseToggle: boolean;
  onBack: () => void;
  onNext: () => void;
}

export default function CapitalGainsStep({
  primaryGains,
  spouseGains,
  onPrimaryGainsChange,
  onSpouseGainsChange,
  showSpouseToggle,
  onBack,
  onNext,
}: CapitalGainsStepProps) {
  const { colors } = useRobinhoodTheme();
  const [active, setActive] = useState<'primary' | 'spouse'>('primary');
  const [scanning, setScanning] = useState(false);

  const current = active === 'primary' ? primaryGains : spouseGains;
  const setCurrent = active === 'primary' ? onPrimaryGainsChange : onSpouseGainsChange;

  const update = (field: 'shortTerm' | 'longTerm', text: string) => {
    const n = parseMoneyInput(text);
    setCurrent({ ...current, [field]: n });
  };

  const processScanResult = async (fileUri: string) => {
    setScanning(true);
    try {
      const scanned = await scanTaxDocument(fileUri, '1099-B');
      if (!scanned || scanned.type !== '1099-B') {
        Alert.alert('Import failed', 'Could not read 1099-B. Please enter amounts manually.');
        return;
      }
      const b = scanned as Scanned1099BData;
      const hasBreakdown = typeof b.shortTerm === 'number' || typeof b.longTerm === 'number';
      if (hasBreakdown) {
        setCurrent({
          shortTerm: typeof b.shortTerm === 'number' ? b.shortTerm : 0,
          longTerm: typeof b.longTerm === 'number' ? b.longTerm : 0,
        });
      } else {
        setCurrent({
          shortTerm: Math.max(0, b.realizedGainLoss),
          longTerm: 0,
        });
      }
      Alert.alert('Success', 'Brokerage data imported successfully!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      Alert.alert('Import failed', msg);
    } finally {
      setScanning(false);
    }
  };

  const handleScan1099B = () => {
    const options = ['Take Photo', 'Choose from Library', 'Import PDF / File', 'Cancel'];
    const cancelButtonIndex = 3;

    const handleSelection = async (index: number) => {
      if (index === cancelButtonIndex) return;
      try {
        let fileUri: string | null = null;
        if (index === 0) {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Camera Permission Required', 'Enable camera access to scan documents.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: false, allowsEditing: false });
          if (!result.canceled && result.assets?.length) fileUri = result.assets[0].uri;
        } else if (index === 1) {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Photo Library Permission Required', 'Allow access to photos.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: false, allowsEditing: false });
          if (!result.canceled && result.assets?.length) fileUri = result.assets[0].uri;
        } else if (index === 2) {
          const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], copyToCacheDirectory: true });
          if (!result.canceled && result.assets?.length) fileUri = result.assets[0].uri;
        }
        if (fileUri) await processScanResult(fileUri);
      } catch (e) {
        Alert.alert('Import Error', e instanceof Error ? e.message : 'Import failed.');
        setScanning(false);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, title: 'Import 1099-B Document', message: 'Choose how to import your brokerage statement' },
        handleSelection,
      );
    } else {
      Alert.alert('Import 1099-B', 'Choose how to import', [
        { text: 'Take Photo', onPress: () => handleSelection(0) },
        { text: 'Choose from Library', onPress: () => handleSelection(1) },
        { text: 'Import PDF / File', onPress: () => handleSelection(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Did you sell any investments?</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Tell us about stocks, crypto, or other investments you sold. Import your 1099-B or enter the gains below.
      </Text>

      {showSpouseToggle && (
        <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              active === 'primary' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setActive('primary')}>
            <Text style={[styles.toggleText, { color: active === 'primary' ? colors.background : colors.text }]}>
              My Gains
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              active === 'spouse' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setActive('spouse')}>
            <Text style={[styles.toggleText, { color: active === 'spouse' ? colors.background : colors.text }]}>
              Spouse's Gains
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.scanButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        onPress={handleScan1099B}
        disabled={scanning}>
        {scanning ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.scanButtonText, { color: colors.primary }]}>Analyzing 1099-B...</Text>
          </>
        ) : (
          <>
            <Feather name="upload" size={20} color={colors.primary} />
            <Text style={[styles.scanButtonText, { color: colors.primary }]}>Import 1099-B (Photo, PDF, or File)</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Short-Term Gains (taxed as income)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(current.shortTerm)}
          onChangeText={(t) => update('shortTerm', t)}
          keyboardType="numeric"
        />
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Long-Term Gains (preferential rate)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={formatMoneyInput(current.longTerm)}
          onChangeText={(t) => update('longTerm', t)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.surface }]} onPress={onBack}>
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={onNext}>
          <Text style={[styles.primaryButtonText, { color: colors.background }]}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '400', marginBottom: 24 },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  toggleText: { fontSize: 16, fontWeight: '600' },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scanButtonText: { fontSize: 16, fontWeight: '600' },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, marginBottom: 8 },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryButton: { flex: 1, borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { flex: 1, borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
});
