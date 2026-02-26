import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Keyboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BankLinkButton from '@/components/BankLinkButton';
import { readAsStringAsync } from 'expo-file-system/legacy';
import KeyboardDoneButton from '@/components/KeyboardDoneButton';
import * as DocumentPicker from 'expo-document-picker';
import {
  importCSVFile,
  saveImportedRecords,
  mapDescriptionToPlatform,
  PLATFORM_LABELS,
  type CSVImportResult,
  type GigPlatform,
} from '@/lib/csvImportService';
import { EarningsSkeleton } from '@/components/ui/Skeletons';



interface IncomeRecord {
  id: string;
  amount: number;
  date: string;
  source: 'plaid' | 'screenshot' | 'csv';
  description: string | null;
  platform: string | null;
  status: string;
}

interface TaxPayment {
  id: string;
  amount: number;
  quarter: string;
  date_paid: string;
}

export default function EarningsScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useRobinhoodTheme();
  const doneAccessoryId = 'earnings-done';
  const [grossIncome, setGrossIncome] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [quarterlyTaxBill, setQuarterlyTaxBill] = useState(0);
  const [taxDue, setTaxDue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [isBankConnected, setIsBankConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [taxPayments, setTaxPayments] = useState<TaxPayment[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Additional payment modal state
  const [showAdditionalPaymentModal, setShowAdditionalPaymentModal] = useState(false);
  const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState('');
  const [additionalPaymentDate, setAdditionalPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // How to pay instructions modal state
  const [showHowToPayModal, setShowHowToPayModal] = useState(false);

  // Screenshot upload state
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState('');

  // CSV import state
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult | null>(null);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [csvPlatformOverride, setCsvPlatformOverride] = useState<GigPlatform | null>(null);

  const checkBankConnection = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      setIsBankConnected(!error && !!data);
    } catch (error) {
      console.error('Error checking bank connection:', error);
      setIsBankConnected(false);
    }
  }, [user]);

  const loadIncomeData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch income records
      const { data: incomeData, error: incomeError } = await supabase
        .from('user_income')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (incomeError) throw incomeError;

      const income = incomeData || [];
      setIncomeRecords(income);

      // Calculate gross income
      const gross = income.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0);
      setGrossIncome(gross);

      // Fetch deductible expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('user_expenses')
        .select('deductible_amount')
        .eq('user_id', user.id);

      if (expensesError) throw expensesError;

      const totalDeductible = expensesData?.reduce(
        (sum, exp) => sum + parseFloat(exp.deductible_amount?.toString() || '0'),
        0
      ) || 0;

      // Calculate net profit
      const net = gross - totalDeductible;
      setNetProfit(net);

      // Fetch tax payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('tax_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('date_paid', { ascending: false });

      if (paymentsError) throw paymentsError;

      const payments = paymentsData || [];
      setTaxPayments(payments);

      // Calculate total paid
      const paid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
      setTotalPaid(paid);

      // Calculate quarterly tax (30% of net profit)
      const annualTax = net * 0.30;
      const quarterly = annualTax / 4;
      setQuarterlyTaxBill(quarterly);

      // Calculate tax due (estimated tax - total paid)
      const taxDueAmount = annualTax - paid;
      setTaxDue(Math.max(0, taxDueAmount));
    } catch (error) {
      console.error('Error loading income data:', error);
      Alert.alert('Error', 'Failed to load income data');
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      checkBankConnection();
      loadIncomeData();
    }, [checkBankConnection, loadIncomeData])
  );

  const handleScanIncome = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to scan income');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('scan-income', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Scan Complete',
          `Added ${data.added} new income records. ${data.skipped} duplicates skipped.`
        );
        await loadIncomeData();
      } else {
        throw new Error('Scan failed');
      }
    } catch (error: any) {
      console.error('Error scanning income:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Scan Error',
        error.message || 'Failed to scan income. Please try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to upload screenshots');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setScreenshotUri(result.assets[0].uri);
        setIsUploadModalVisible(true);
        await analyzeEarningsScreenshot(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleTakeScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your camera to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setScreenshotUri(result.assets[0].uri);
        setIsUploadModalVisible(true);
        await analyzeEarningsScreenshot(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const analyzeEarningsScreenshot = async (imageUri: string) => {
    setIsAnalyzing(true);
    try {
      const base64 = await readAsStringAsync(imageUri, { encoding: 'base64' });

      const { data: parsed, error: fnError } = await supabase.functions.invoke('analyze-receipt', {
        body: { image: base64, type: 'income' },
      });

      if (fnError || !parsed) {
        console.error('AI analysis failed:', fnError);
        Alert.alert(
          'Scan Failed',
          'Could not analyze the image. Please ensure the screenshot is clear and try again, or enter the amount manually.'
        );
        return;
      }
      const amount = parsed.total_amount ?? parsed.amount;
      if (amount != null && typeof amount === 'number') {
        setManualAmount(amount.toFixed(2));
      }
      if (parsed.date && typeof parsed.date === 'string') {
        setManualDate(parsed.date);
      }
      if (parsed.source && typeof parsed.source === 'string') {
        setAnalysisSource(parsed.source);
      }
    } catch (error) {
      console.error('Error analyzing earnings screenshot:', error);
      Alert.alert(
        'Analysis Error',
        'Something went wrong while scanning. Please try again or enter the amount manually.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveScreenshot = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in');
      return;
    }

    const amount = parseFloat(manualAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    if (!manualDate) {
      Alert.alert('Missing Date', 'Please select a date');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUploading(true);
    try {
      // Check for duplicates (same amount within 3 days)
      const screenshotDate = new Date(manualDate);
      const threeDaysBefore = new Date(screenshotDate);
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
      const threeDaysAfter = new Date(screenshotDate);
      threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

      const { data: existing, error: checkError } = await supabase
        .from('user_income')
        .select('id, source, date')
        .eq('user_id', user.id)
        .eq('amount', amount.toString())
        .gte('date', threeDaysBefore.toISOString().split('T')[0])
        .lte('date', threeDaysAfter.toISOString().split('T')[0])
        .limit(1)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        const shouldContinue = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Duplicate Detected',
            `We already have a record for $${amount.toFixed(2)} on ${existing.date}. Save anyway?`,
            [
              {
                text: 'Cancel', style: 'cancel', onPress: () => {
                  setIsUploadModalVisible(false);
                  setScreenshotUri(null);
                  setManualAmount('');
                  setManualDate(new Date().toISOString().split('T')[0]);
                  resolve(false);
                }
              },
              { text: 'Save Anyway', onPress: () => resolve(true) },
            ]
          );
        });
        if (!shouldContinue) return;
      }

      // Insert new income record
      const detectedPlatform = mapDescriptionToPlatform(analysisSource);
      const { error: insertError } = await supabase
        .from('user_income')
        .insert({
          user_id: user.id,
          amount: amount,
          date: manualDate,
          source: 'screenshot',
          description: analysisSource || 'Manual upload from screenshot',
          platform: detectedPlatform,
          status: 'verified',
        });

      if (insertError) {
        throw insertError;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Income record saved successfully!');
      setIsUploadModalVisible(false);
      setScreenshotUri(null);
      setManualAmount('');
      setManualDate(new Date().toISOString().split('T')[0]);
      setAnalysisSource('');
      await loadIncomeData();
    } catch (error: any) {
      console.error('Error saving screenshot income:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save income record. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCurrentQuarter = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const quarter = Math.floor(month / 3) + 1;
    return `Q${quarter} ${year}`;
  };

  const handleAdditionalPayment = async () => {
    if (!user) return;
    const amount = parseFloat(additionalPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    setIsSavingPayment(true);
    try {
      const currentQuarter = getCurrentQuarter();
      const { error } = await supabase
        .from('tax_payments')
        .insert({
          user_id: user.id,
          amount,
          quarter: currentQuarter,
          date_paid: additionalPaymentDate,
          notes: 'Additional Quarterly Payment',
        });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAdditionalPaymentModal(false);
      setAdditionalPaymentAmount('');
      setAdditionalPaymentDate(new Date().toISOString().split('T')[0]);
      await loadIncomeData();
    } catch (error: any) {
      console.error('Error saving additional payment:', error);
      Alert.alert('Error', error.message || 'Failed to save payment');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handlePickCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain'],
      });

      if (result.canceled || !result.assets?.[0]) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const fileUri = result.assets[0].uri;

      // Parse the CSV
      const importResult = await importCSVFile(fileUri);

      if (importResult.records.length === 0) {
        Alert.alert(
          'No Records Found',
          importResult.errors.length > 0
            ? importResult.errors.join('\n')
            : 'No valid earnings entries found in this file. Make sure it contains date and amount columns.'
        );
        return;
      }

      setCsvImportResult(importResult);
      setCsvPlatformOverride(null);
      setShowCSVImportModal(true);
    } catch (error: any) {
      console.error('Error picking CSV:', error);
      Alert.alert('Error', 'Failed to read CSV file. Please try again.');
    }
  };

  const handleConfirmCSVImport = async () => {
    if (!user || !csvImportResult) return;

    setIsImportingCSV(true);
    try {
      // Apply platform override if user selected one
      const records = csvPlatformOverride
        ? csvImportResult.records.map((r) => ({ ...r, platform: csvPlatformOverride }))
        : csvImportResult.records;

      const result = await saveImportedRecords(user.id, records);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCSVImportModal(false);
      setCsvImportResult(null);

      Alert.alert(
        'Import Complete',
        `Added ${result.saved} new earnings entries.${result.duplicates > 0 ? `\nSkipped ${result.duplicates} duplicates.` : ''}`
      );

      await loadIncomeData();
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Import Error', error.message || 'Failed to import records.');
    } finally {
      setIsImportingCSV(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'plaid': return 'link';
      case 'screenshot': return 'camera';
      case 'csv': return 'file-text';
      default: return 'dollar-sign';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>

            {/* Header - plain title */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Earnings</Text>
            </View>

            {isLoadingData ? (
              <EarningsSkeleton />
            ) : (
              <>
                {/* Stats Banner - only when there's data */}
                {(incomeRecords.length > 0 || taxPayments.length > 0) && (
                  <View style={[styles.statsBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gross Income</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>${grossIncome.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Net Profit</Text>
                      <Text style={[styles.statValue, { color: colors.primary }]}>${netProfit.toFixed(2)}</Text>
                    </View>
                  </View>
                )}

                {/* Quarterly Tax Card - only when there's data */}
                {(incomeRecords.length > 0 || taxPayments.length > 0) && (
                  <View style={[styles.card, styles.taxCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                        <Feather name="file-text" size={20} color={colors.primary} />
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>Quarterly Tax Bill</Text>
                      <TouchableOpacity
                        onPress={() => setShowHowToPayModal(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="info" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {taxDue <= 0 ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Feather name="check-circle" size={22} color={colors.primary} />
                          <Text style={[styles.cardAmount, { color: colors.primary, marginBottom: 0 }]}>
                            Paid in Full
                          </Text>
                        </View>
                        <Text style={[styles.cardSubtext, { color: colors.textSecondary, marginBottom: 4 }]}>
                          You've paid ${totalPaid.toFixed(2)} for {getCurrentQuarter()}.
                        </Text>
                        <View style={styles.taxDetailRow}>
                          <Text style={[styles.taxDetailLabel, { color: colors.textSecondary }]}>Estimated Tax</Text>
                          <Text style={[styles.taxDetailValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>${(netProfit * 0.30).toFixed(2)}</Text>
                        </View>
                        <View style={styles.taxDetailRow}>
                          <Text style={[styles.taxDetailLabel, { color: colors.textSecondary }]}>Already Paid</Text>
                          <Text style={[styles.taxDetailValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>${totalPaid.toFixed(2)}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.payButton, { marginTop: 12 }]}
                          onPress={() => setShowAdditionalPaymentModal(true)}
                          activeOpacity={0.8}>
                          <View style={[styles.payButtonGradient, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}>
                            <Feather name="plus-circle" size={18} color={colors.primary} />
                            <Text style={[styles.payButtonText, { color: colors.primary }]}>Make Another Payment</Text>
                          </View>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.cardAmount, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>
                          ${taxDue.toFixed(2)}
                        </Text>
                        <View style={styles.taxDetailRow}>
                          <Text style={[styles.taxDetailLabel, { color: colors.textSecondary }]}>Estimated Tax</Text>
                          <Text style={[styles.taxDetailValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>${(netProfit * 0.30).toFixed(2)}</Text>
                        </View>
                        <View style={styles.taxDetailRow}>
                          <Text style={[styles.taxDetailLabel, { color: colors.textSecondary }]}>Already Paid</Text>
                          <Text style={[styles.taxDetailValue, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>${totalPaid.toFixed(2)}</Text>
                        </View>
                        <View style={styles.taxDetailRow}>
                          <Text style={[styles.taxDetailLabel, { color: colors.textSecondary }]}>Quarterly Amount</Text>
                          <Text style={[styles.taxDetailValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>${quarterlyTaxBill.toFixed(2)}</Text>
                        </View>
                        {totalPaid > 0 ? (
                          <TouchableOpacity
                            style={styles.payButton}
                            onPress={() => setShowAdditionalPaymentModal(true)}
                            activeOpacity={0.8}>
                            <LinearGradient
                              colors={[colors.gradientStart, colors.gradientEnd]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.payButtonGradient}>
                              <Feather name="plus-circle" size={18} color="#FFF" />
                              <Text style={styles.payButtonText}>Log Another Payment</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.payButton}
                            onPress={() => setShowAdditionalPaymentModal(true)}
                            activeOpacity={0.8}>
                            <LinearGradient
                              colors={[colors.gradientStart, colors.gradientEnd]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.payButtonGradient}>
                              <Feather name="check-circle" size={18} color="#FFF" />
                              <Text style={styles.payButtonText}>Log Payment</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Tax Payment History */}
                {taxPayments.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                        <Feather name="clock" size={20} color={colors.primary} />
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Payment History</Text>
                    </View>
                    {taxPayments.map((payment) => (
                      <View key={payment.id} style={[styles.recordItem, { borderColor: colors.border }]}>
                        <View style={styles.recordInfo}>
                          <Text style={[styles.recordDescription, { color: colors.text }]}>
                            {payment.quarter}
                          </Text>
                          <Text style={[styles.recordDate, { color: colors.textSecondary }]}>
                            Paid {formatDate(payment.date_paid)}
                          </Text>
                        </View>
                        <Text style={[styles.recordAmount, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>
                          ${parseFloat(payment.amount.toString()).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bank Connection Section - ALWAYS visible */}
                {!isBankConnected ? (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                        <Feather name="link" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Connect Your Bank</Text>
                        <Text style={[styles.cardSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                          Automatically track income from deposits
                        </Text>
                      </View>
                    </View>
                    <BankLinkButton onSuccess={() => {
                      setIsBankConnected(true);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Success', 'Bank account connected successfully!');
                    }} />
                  </View>
                ) : (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                        <Feather name="check-circle" size={20} color={colors.primary} />
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Bank Connected</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleScanIncome}
                      disabled={isScanning}
                      activeOpacity={0.8}>
                      <LinearGradient
                        colors={isScanning ? ['#333', '#333'] : [colors.gradientStart, colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionButtonGradient}>
                        {isScanning ? (
                          <>
                            <ActivityIndicator color="#FFF" size="small" />
                            <Text style={styles.actionButtonText}>Scanning...</Text>
                          </>
                        ) : (
                          <>
                            <Feather name="search" size={18} color="#FFF" />
                            <Text style={styles.actionButtonText}>Scan for Income</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Screenshot Upload Section - ALWAYS visible */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                      <Feather name="camera" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Upload Earnings Screenshot</Text>
                      <Text style={[styles.cardSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                        Uber, DoorDash, Lyft, and more
                      </Text>
                    </View>
                  </View>
                  <View style={styles.uploadButtonsRow}>
                    <TouchableOpacity
                      style={[styles.uploadBtn, { borderColor: colors.primary }]}
                      onPress={handleTakeScreenshot}
                      activeOpacity={0.7}>
                      <Feather name="camera" size={22} color={colors.primary} />
                      <Text style={[styles.uploadBtnText, { color: colors.primary }]}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.uploadBtn, { borderColor: colors.primary }]}
                      onPress={handlePickScreenshot}
                      activeOpacity={0.7}>
                      <Feather name="image" size={22} color={colors.primary} />
                      <Text style={[styles.uploadBtnText, { color: colors.primary }]}>Choose Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CSV Import Section - ALWAYS visible */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                      <Feather name="file-text" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Import CSV Earnings</Text>
                      <Text style={[styles.cardSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                        Upload your Uber, Lyft, or DoorDash CSV export
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handlePickCSV}
                    activeOpacity={0.8}>
                    <LinearGradient
                      colors={[colors.gradientStart, colors.gradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionButtonGradient}>
                      <Feather name="upload" size={18} color="#FFF" />
                      <Text style={styles.actionButtonText}>Choose CSV File</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Recent Income Records */}
                {incomeRecords.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                        <Feather name="list" size={20} color={colors.primary} />
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Income</Text>
                    </View>
                    {incomeRecords.slice(0, 10).map((record) => (
                      <View key={record.id} style={[styles.recordItem, { borderColor: colors.border }]}>
                        <View style={[styles.sourceIcon, { backgroundColor: colors.background }]}>
                          <Feather name={getSourceIcon(record.source) as any} size={14} color={colors.primary} />
                        </View>
                        <View style={styles.recordInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.recordDescription, { color: colors.text }]} numberOfLines={1}>
                              {record.description || 'Income'}
                            </Text>
                            {record.platform && (
                              <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>
                                  {PLATFORM_LABELS[record.platform as GigPlatform] || record.platform}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.recordDate, { color: colors.textSecondary }]}>
                            {formatDate(record.date)}
                          </Text>
                        </View>
                        <Text style={[styles.recordAmount, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>
                          +${parseFloat(record.amount.toString()).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Screenshot Upload Modal */}
          <Modal
            visible={isUploadModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setIsUploadModalVisible(false)}>
            <View style={[styles.modalOverlay, { backgroundColor: colors.background + 'E6' }]}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Verify Amount</Text>
                  <TouchableOpacity onPress={() => setIsUploadModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Feather name="x" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                  {isAnalyzing && (
                    <View style={[styles.analyzingBanner, { backgroundColor: colors.primary + '15' }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.analyzingText, { color: colors.primary }]}>AI is analyzing your screenshot...</Text>
                    </View>
                  )}

                  {screenshotUri && (
                    <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="cover" />
                  )}

                  {analysisSource ? (
                    <View style={[styles.sourceTag, { backgroundColor: colors.primary + '20' }]}>
                      <Feather name="zap" size={14} color={colors.primary} />
                      <Text style={[styles.sourceTagText, { color: colors.primary }]}>
                        Detected: {analysisSource}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>AMOUNT</Text>
                    <View style={[styles.amountInputContainer, { borderColor: colors.primary, backgroundColor: colors.background }]}>
                      <Text style={[styles.currencySymbol, { color: colors.primary }]}>$</Text>
                      <TextInput
                        style={[styles.amountInput, { color: colors.text }]}
                        placeholder="0.00"
                        placeholderTextColor={colors.textSecondary}
                        value={manualAmount}
                        onChangeText={setManualAmount}
                        keyboardType="decimal-pad"
                        editable={!isAnalyzing}
                        returnKeyType="done"
                        blurOnSubmit={true}
                        inputAccessoryViewID={doneAccessoryId}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DATE</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                      value={manualDate}
                      onChangeText={setManualDate}
                      editable={!isAnalyzing}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      inputAccessoryViewID={doneAccessoryId}
                    />
                  </View>
                  <KeyboardDoneButton accessoryID={doneAccessoryId} />
                </ScrollView>

                {/* Fixed footer buttons */}
                <View style={[styles.modalButtonRow, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                      setIsUploadModalVisible(false);
                      setScreenshotUri(null);
                      setManualAmount('');
                      setManualDate(new Date().toISOString().split('T')[0]);
                      setAnalysisSource('');
                    }}
                    disabled={isUploading}
                    activeOpacity={0.7}>
                    <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalSaveButton,
                      (isUploading || isAnalyzing) && styles.modalSaveButtonDisabled,
                    ]}
                    onPress={handleSaveScreenshot}
                    disabled={isUploading || isAnalyzing}
                    activeOpacity={0.8}>
                    <LinearGradient
                      colors={(isUploading || isAnalyzing) ? ['#333', '#333'] : ['#C6FF5E', '#A8D94E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalSaveGradient}>
                      {isUploading ? (
                        <>
                          <ActivityIndicator color="#FFF" size="small" />
                          <Text style={styles.modalSaveText}>Saving...</Text>
                        </>
                      ) : (
                        <>
                          <Feather name="check" size={18} color="#FFF" />
                          <Text style={styles.modalSaveText}>Confirm & Save</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Log Payment Modal */}
          <Modal visible={showAdditionalPaymentModal} transparent animationType="slide" onRequestClose={() => setShowAdditionalPaymentModal(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Log Tax Payment</Text>
                    <TouchableOpacity onPress={() => setShowAdditionalPaymentModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Feather name="x" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 24, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
                    <Text style={[styles.cardSubtext, { color: colors.textSecondary, marginBottom: 16 }]}>
                      Record a payment you made for {getCurrentQuarter()}.
                    </Text>

                    {taxDue > 0 && (
                      <View style={{ backgroundColor: colors.primary + '15', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name="info" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500', flex: 1 }}>
                          Suggested: ${Math.min(quarterlyTaxBill, taxDue).toFixed(2)} remaining for this quarter
                        </Text>
                      </View>
                    )}

                    <View style={{ gap: 16 }}>
                      <View>
                        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>How much did you pay?</Text>
                        <View style={[styles.amountInputContainer, { borderColor: colors.primary, backgroundColor: colors.background }]}>
                          <Text style={[styles.currencySymbol, { color: colors.primary }]}>$</Text>
                          <TextInput
                            style={[styles.amountInput, { color: colors.text }]}
                            placeholder="0.00"
                            placeholderTextColor={colors.textSecondary}
                            value={additionalPaymentAmount}
                            onChangeText={setAdditionalPaymentAmount}
                            keyboardType="decimal-pad"
                            inputAccessoryViewID={doneAccessoryId}
                          />
                        </View>
                      </View>

                      <View>
                        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Date Paid</Text>
                        <TextInput
                          style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textSecondary}
                          value={additionalPaymentDate}
                          onChangeText={setAdditionalPaymentDate}
                          inputAccessoryViewID={doneAccessoryId}
                        />
                      </View>
                    </View>
                  </ScrollView>

                  <View style={[styles.modalButtonRow, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => {
                        setShowAdditionalPaymentModal(false);
                        setAdditionalPaymentAmount('');
                      }}>
                      <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSaveButton, isSavingPayment && styles.modalSaveButtonDisabled]}
                      onPress={handleAdditionalPayment}
                      disabled={isSavingPayment}
                      activeOpacity={0.8}>
                      <LinearGradient
                        colors={isSavingPayment ? ['#333', '#333'] : ['#C6FF5E', '#A8D94E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.modalSaveGradient}>
                        {isSavingPayment ? (
                          <>
                            <ActivityIndicator color="#FFF" size="small" />
                            <Text style={styles.modalSaveText}>Saving...</Text>
                          </>
                        ) : (
                          <>
                            <Feather name="check" size={18} color="#FFF" />
                            <Text style={styles.modalSaveText}>Save Payment</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* How to Pay Instructions Modal */}
          <Modal visible={showHowToPayModal} transparent animationType="slide" onRequestClose={() => setShowHowToPayModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>How to Pay Quarterly Taxes</Text>
                  <TouchableOpacity onPress={() => setShowHowToPayModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 450 }}>
                  <View style={{ gap: 20 }}>
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>1</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Pay Online (Recommended)</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 38 }}>
                        Visit IRS.gov/payments to make a free direct payment from your bank account. Select "Estimated Tax" and "1040-ES" as the form type.
                      </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>2</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Pay by Phone (EFTPS)</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 38 }}>
                        Call EFTPS at 1-800-316-6541 to pay by phone. You must first enroll at EFTPS.gov. Available 24/7.
                      </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>3</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Mail a Check (Form 1040-ES)</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 38 }}>
                        Use Form 1040-ES voucher and mail a check or money order to the IRS. The mailing address depends on your state — visit IRS.gov for your specific address.
                      </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>4</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>2026 Due Dates</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 38 }}>
                        Q1: April 15, 2026{'\n'}Q2: June 16, 2026{'\n'}Q3: September 15, 2026{'\n'}Q4: January 15, 2027
                      </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF9500', alignItems: 'center', justifyContent: 'center' }}>
                          <Feather name="alert-triangle" size={14} color="#FFF" />
                        </View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Important Reminders</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 38 }}>
                        • Underpayment penalty applies if you owe $1,000+ at filing{'\n'}
                        • Safe harbor: pay 100% of last year's tax (110% if AGI {'>'} $150k){'\n'}
                        • Keep records of all payments made{'\n'}
                        • State estimated taxes may also be required
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: colors.primary,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setShowHowToPayModal(false);
                      // Open IRS payment page in browser
                      const { Linking } = require('react-native');
                      Linking.openURL('https://www.irs.gov/payments');
                    }}
                  >
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Pay Online</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    onPress={() => setShowHowToPayModal(false)}
                  >
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* CSV Import Confirmation Modal */}
          <Modal
            visible={showCSVImportModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCSVImportModal(false)}>
            <View style={[styles.modalOverlay, { backgroundColor: colors.background + 'E6' }]}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Import Preview</Text>
                  <TouchableOpacity
                    onPress={() => setShowCSVImportModal(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Feather name="x" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {csvImportResult && (
                  <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 24, paddingTop: 0 }}>
                    {/* Platform Badge */}
                    <View style={[styles.sourceTag, { backgroundColor: colors.primary + '20', marginBottom: 20 }]}>
                      <Feather name="truck" size={14} color={colors.primary} />
                      <Text style={[styles.sourceTagText, { color: colors.primary }]}>
                        {PLATFORM_LABELS[csvImportResult.platform] || csvImportResult.platform}
                      </Text>
                    </View>

                    {/* Stats */}
                    <View style={[styles.statsBanner, { marginHorizontal: 0, marginTop: 0, backgroundColor: colors.background, borderColor: colors.border }]}>
                      <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Records</Text>
                        <Text style={[styles.statValue, { color: colors.text, fontSize: 18 }]}>
                          {csvImportResult.records.length}
                        </Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                        <Text style={[styles.statValue, { color: colors.primary, fontSize: 18 }]}>
                          ${csvImportResult.totalAmount.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Date Range */}
                    {csvImportResult.dateRange.start && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DATE RANGE</Text>
                        <Text style={{ color: colors.text, fontSize: 15 }}>
                          {new Date(csvImportResult.dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' — '}
                          {new Date(csvImportResult.dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                    )}

                    {/* Skipped/Errors */}
                    {csvImportResult.skippedRows > 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 12 }}>
                        {csvImportResult.skippedRows} rows skipped (invalid or zero amount)
                      </Text>
                    )}
                    {csvImportResult.errors.map((err, i) => (
                      <Text key={i} style={{ color: colors.warning, fontSize: 13, marginTop: 4 }}>
                        {err}
                      </Text>
                    ))}

                    {/* Platform Override */}
                    <View style={{ marginTop: 20 }}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PLATFORM</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {(['uber', 'lyft', 'doordash', 'instacart', 'grubhub', 'other'] as GigPlatform[]).map(
                          (p) => {
                            const isSelected = (csvPlatformOverride || csvImportResult.platform) === p;
                            return (
                              <TouchableOpacity
                                key={p}
                                onPress={() => setCsvPlatformOverride(p)}
                                style={{
                                  paddingHorizontal: 14,
                                  paddingVertical: 8,
                                  borderRadius: 20,
                                  borderWidth: 1.5,
                                  borderColor: isSelected ? colors.primary : colors.border,
                                  backgroundColor: isSelected ? colors.primary + '20' : 'transparent',
                                }}>
                                <Text
                                  style={{
                                    color: isSelected ? colors.primary : colors.textSecondary,
                                    fontSize: 13,
                                    fontWeight: isSelected ? '700' : '500',
                                  }}>
                                  {PLATFORM_LABELS[p]}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                        )}
                      </View>
                    </View>
                  </ScrollView>
                )}

                {/* Action Buttons */}
                <View style={[styles.modalButtonRow, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                      setShowCSVImportModal(false);
                      setCsvImportResult(null);
                    }}
                    disabled={isImportingCSV}
                    activeOpacity={0.7}>
                    <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveButton, isImportingCSV && styles.modalSaveButtonDisabled]}
                    onPress={handleConfirmCSVImport}
                    disabled={isImportingCSV}
                    activeOpacity={0.8}>
                    <LinearGradient
                      colors={isImportingCSV ? ['#333', '#333'] : ['#C6FF5E', '#A8D94E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalSaveGradient}>
                      {isImportingCSV ? (
                        <>
                          <ActivityIndicator color="#FFF" size="small" />
                          <Text style={styles.modalSaveText}>Importing...</Text>
                        </>
                      ) : (
                        <>
                          <Feather name="download" size={18} color="#FFF" />
                          <Text style={styles.modalSaveText}>
                            Import {csvImportResult?.records.length || 0} Records
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
  },

  // ── Stats Banner ──
  statsBanner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // ── Cards ──
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  taxCard: {
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardAmount: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  cardSubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  taxDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  taxDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  taxDetailValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Buttons ──
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // ── Upload ──
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Records ──
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sourceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInfo: {
    flex: 1,
  },
  recordDescription: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  recordDate: {
    fontSize: 12,
    fontWeight: '400',
  },
  recordAmount: {
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalScrollView: {
    flex: 1,
    maxHeight: 420,
  },
  modalScrollContent: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  analyzingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  screenshotPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 20,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  sourceTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  modalInput: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
});
