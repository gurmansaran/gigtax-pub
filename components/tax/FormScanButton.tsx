/**
 * FormScanButton — Scan tax forms via camera, gallery, or PDF upload.
 *
 * Shows a scan button that opens an action sheet with three options:
 * 📷 Take Photo, 🖼️ Choose Photo, 📄 Upload PDF
 *
 * After scanning, calls onScanComplete with the structured result.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import {
  scanFromCamera,
  scanFromGallery,
  scanFromPdf,
  type TaxFormType,
  type ScannedFormResult,
  type ScanError,
  FORM_TYPE_LABELS,
} from '@/lib/taxFormScanner';

interface FormScanButtonProps {
  /** Which form type to scan for. Use 'auto' for auto-detect. */
  formType?: TaxFormType;
  /** Called with structured scan result on success. */
  onScanComplete: (result: ScannedFormResult) => void;
  /** Optional label override. */
  label?: string;
  /** Compact style (icon only). */
  compact?: boolean;
}

export default function FormScanButton({
  formType = 'auto',
  onScanComplete,
  label,
  compact = false,
}: FormScanButtonProps) {
  const { colors } = useRobinhoodTheme();
  const [scanning, setScanning] = useState(false);

  const handleScan = async (source: 'camera' | 'gallery' | 'pdf') => {
    setScanning(true);
    try {
      let result: ScannedFormResult | null = null;

      switch (source) {
        case 'camera':
          result = await scanFromCamera(formType);
          break;
        case 'gallery':
          result = await scanFromGallery(formType);
          break;
        case 'pdf':
          result = await scanFromPdf(formType);
          break;
      }

      if (result) {
        onScanComplete(result);
      }
      // null means user cancelled — no error needed
    } catch (error) {
      const scanError = error as ScanError;
      if (scanError.code === 'CANCELLED') return;

      Alert.alert(
        'Scan Failed',
        scanError.message || 'Could not scan the document. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setScanning(false);
    }
  };

  const showSourcePicker = () => {
    if (scanning) return;

    const options = ['Take Photo', 'Choose from Library', 'Upload PDF', 'Cancel'];
    const cancelIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          title: `Scan ${formType === 'auto' ? 'Tax Form' : formType}`,
          message: 'Choose how to capture your tax document',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleScan('camera');
          else if (buttonIndex === 1) handleScan('gallery');
          else if (buttonIndex === 2) handleScan('pdf');
        }
      );
    } else {
      // Android fallback — use Alert as action sheet
      Alert.alert(
        `Scan ${formType === 'auto' ? 'Tax Form' : formType}`,
        'Choose how to capture your tax document',
        [
          { text: 'Take Photo', onPress: () => handleScan('camera') },
          { text: 'Choose Photo', onPress: () => handleScan('gallery') },
          { text: 'Upload PDF', onPress: () => handleScan('pdf') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const buttonLabel = label || (compact ? '' : `Scan ${formType === 'auto' ? 'Form' : formType}`);

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactButton, { backgroundColor: colors.primary }]}
        onPress={showSourcePicker}
        disabled={scanning}
      >
        {scanning ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Feather name="camera" size={18} color="#FFF" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={showSourcePicker}
      disabled={scanning}
    >
      {scanning ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <Feather name="camera" size={18} color="#FFF" />
      )}
      <Text style={styles.buttonText}>{scanning ? 'Scanning...' : buttonLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
