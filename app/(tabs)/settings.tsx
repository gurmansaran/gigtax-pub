import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useRevenueCat } from '@/lib/CtxProvider';
import { supabase } from '@/lib/supabase';
import { useRobinhoodTheme, type ThemePreference } from '@/hooks/use-robinhood-theme';
import { useLanguage } from '@/lib/LanguageContext';
import type { Language } from '@/lib/translations';
import {
  areRemindersEnabled,
  scheduleQuarterlyReminders,
  cancelQuarterlyReminders,
} from '@/lib/reminderService';
import {
  getSyncStatus,
  onSyncStatusChange,
  getLastSyncedAt,
  formatLastSynced,
  type SyncStatus,
} from '@/lib/syncService';
import { syncExpensesFromSupabase } from '@/lib/expenseStore';
import { syncTripsFromSupabase, syncPendingTrips } from '@/lib/tripStore';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { isPro, presentPaywall, presentCustomerCenter } = useRevenueCat();
  const { colors, isDark, themePreference, setThemePreference } = useRobinhoodTheme();
  const { language, setLanguage, t } = useLanguage();
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  // Notification preferences
  const [quarterlyRemindersOn, setQuarterlyRemindersOn] = useState(false);
  const [weeklySummaryOn, setWeeklySummaryOn] = useState(false);

  // Account deletion
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // App version
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  // Sync state
  const [syncStatus, setSyncStatusLocal] = useState<SyncStatus>(getSyncStatus());
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load notification preferences and sync status on mount
  useEffect(() => {
    (async () => {
      const enabled = await areRemindersEnabled();
      setQuarterlyRemindersOn(enabled);
      const weekly = await AsyncStorage.getItem('weekly_summary_enabled');
      setWeeklySummaryOn(weekly === 'true');
      const lastSync = await getLastSyncedAt();
      setLastSynced(lastSync);
    })();

    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatusLocal(status);
    });
    return unsubscribe;
  }, []);

  const handleLogout = () => {
    Alert.alert(
      t('settings.logOut'),
      t('settings.logOutConfirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.logOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/login');
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Sign out failed';
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };

  const handleLanguageSelect = async (lang: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLanguage(lang);
    setLanguageModalVisible(false);
  };

  const currentLanguageLabel = language === 'es' ? 'Español' : 'English';

  const handleToggleQuarterlyReminders = async (value: boolean) => {
    setQuarterlyRemindersOn(value);
    if (value) {
      await scheduleQuarterlyReminders(0); // Will be updated with actual amount when calculated
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await cancelQuarterlyReminders();
    }
  };

  const handleToggleWeeklySummary = async (value: boolean) => {
    setWeeklySummaryOn(value);
    await AsyncStorage.setItem('weekly_summary_enabled', value ? 'true' : 'false');
    if (value) Haptics.selectionAsync();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm account deletion.');
      return;
    }
    if (!user) return;

    setIsDeletingAccount(true);
    try {
      // Delete user data from all tables
      const tables = ['user_income', 'user_expenses', 'tax_payments', 'user_bank_accounts', 'mileage_entries', 'profiles'];
      for (const table of tables) {
        await supabase.from(table).delete().eq('user_id', user.id);
      }

      // Sign out
      await supabase.auth.signOut();

      // Clear local storage
      await AsyncStorage.clear();

      setShowDeleteModal(false);
      router.replace('/login');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleManualSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingTrips(user.id);
      await syncTripsFromSupabase(user.id);
      await syncExpensesFromSupabase(user.id);
      const ts = await getLastSyncedAt();
      setLastSynced(ts);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>
          {user?.email && (
            <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
          )}
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.account')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsItem
            icon="user"
            label={t('settings.profile')}
            onPress={() => router.push('/(tabs)/profile' as any)}
            colors={colors}
            showChevron
          />
          {isPro ? (
            <SettingsItem
              icon="credit-card"
              label={t('settings.manageSubscription')}
              onPress={() => presentCustomerCenter()}
              colors={colors}
              showChevron
              isLast
            />
          ) : (
            <SettingsItem
              icon="zap"
              label={t('settings.upgradeToPro')}
              onPress={() => presentPaywall()}
              colors={colors}
              showChevron
              isLast
            />
          )}
        </View>

        {/* Appearance Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.appearance')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemeOption
            icon="smartphone"
            label={t('settings.system')}
            selected={themePreference === 'system'}
            onPress={() => setThemePreference('system')}
            colors={colors}
          />
          <ThemeOption
            icon="sun"
            label={t('settings.light')}
            selected={themePreference === 'light'}
            onPress={() => setThemePreference('light')}
            colors={colors}
          />
          <ThemeOption
            icon="moon"
            label={t('settings.dark')}
            selected={themePreference === 'dark'}
            onPress={() => setThemePreference('dark')}
            colors={colors}
            isLast
          />
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.preferences')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsItem
            icon="globe"
            label={t('settings.language')}
            rightText={currentLanguageLabel}
            onPress={() => setLanguageModalVisible(true)}
            colors={colors}
            showChevron
          />
          <SettingsItem
            icon="smartphone"
            label={t('settings.hapticFeedback')}
            colors={colors}
            isLast
            rightElement={
              <Switch
                value={hapticEnabled}
                onValueChange={(val) => {
                  setHapticEnabled(val);
                  if (val) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        {/* Tax Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.tax')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsItem
            icon="file-text"
            label={t('settings.taxReturns')}
            onPress={() => router.push('/(tabs)/file-now' as any)}
            colors={colors}
            showChevron
          />
          <SettingsItem
            icon="navigation"
            label={t('settings.mileageTracking')}
            onPress={() => router.push('/(tabs)/earnings' as any)}
            colors={colors}
            showChevron
          />
          <SettingsItem
            icon="link"
            label={t('settings.bankConnections')}
            onPress={() => router.push('/(tabs)/bank-transactions' as any)}
            colors={colors}
            showChevron
          />
          <SettingsItem
            icon="refresh-cw"
            label="Sync Data"
            rightText={isSyncing ? 'Syncing...' : formatLastSynced(lastSynced)}
            onPress={handleManualSync}
            colors={colors}
            showChevron
            isLast
          />
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Notifications</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsItem
            icon="bell"
            label="Quarterly Tax Reminders"
            colors={colors}
            rightElement={
              <Switch
                value={quarterlyRemindersOn}
                onValueChange={handleToggleQuarterlyReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingsItem
            icon="mail"
            label="Weekly Summary"
            colors={colors}
            isLast
            rightElement={
              <Switch
                value={weeklySummaryOn}
                onValueChange={handleToggleWeeklySummary}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        {/* Legal Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Legal</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsItem
            icon="shield"
            label="Privacy Policy"
            onPress={() => WebBrowser.openBrowserAsync('https://gigtaxus.com/privacy')}
            colors={colors}
            showChevron
          />
          <SettingsItem
            icon="file-text"
            label="Terms of Service"
            onPress={() => WebBrowser.openBrowserAsync('https://gigtaxus.com/terms')}
            colors={colors}
            showChevron
            isLast
          />
        </View>

        {/* Support Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('settings.support')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsItem
            icon="help-circle"
            label={t('settings.helpSupport')}
            onPress={() => Alert.alert(t('settings.helpSupport'), t('settings.helpMessage'))}
            colors={colors}
            showChevron
          />
          <SettingsItem
            icon="info"
            label={t('settings.about')}
            rightText={`v${appVersion}`}
            onPress={() => Alert.alert('GigTax', `Version ${appVersion}\nBuilt with ❤️ for gig workers`)}
            colors={colors}
            showChevron
            isLast
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.error }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>{t('settings.logOut')}</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: '#FF453A40' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setShowDeleteModal(true);
          }}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={20} color="#FF453A" />
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textSecondary }]}>
          Version {appVersion}
        </Text>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('settings.languageModalTitle')}
            </Text>

            <TouchableOpacity
              style={[
                styles.languageOption,
                { borderColor: language === 'en' ? colors.primary : colors.border },
              ]}
              onPress={() => handleLanguageSelect('en')}
              activeOpacity={0.8}
            >
              <Text style={styles.languageFlag}>🇺🇸</Text>
              <Text style={[styles.languageOptionText, { color: colors.text }]}>English</Text>
              {language === 'en' && (
                <Feather name="check" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                { borderColor: language === 'es' ? colors.primary : colors.border },
              ]}
              onPress={() => handleLanguageSelect('es')}
              activeOpacity={0.8}
            >
              <Text style={styles.languageFlag}>🇲🇽</Text>
              <Text style={[styles.languageOptionText, { color: colors.text }]}>Español</Text>
              {language === 'es' && (
                <Feather name="check" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelButton, { borderColor: colors.border }]}
              onPress={() => setLanguageModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>⚠️</Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Delete Your Account?
            </Text>
            <Text style={[styles.deleteWarningText, { color: colors.textSecondary }]}>
              This will permanently delete all your data including earnings, expenses, mileage, and tax returns. This action cannot be undone.
            </Text>
            <Text style={[styles.deleteInstructionText, { color: colors.text }]}>
              Type DELETE to confirm:
            </Text>
            <TextInput
              style={[styles.deleteInput, { borderColor: '#FF453A', color: colors.text }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.deleteConfirmButton, {
                opacity: deleteConfirmText === 'DELETE' ? 1 : 0.4,
              }]}
              onPress={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
              activeOpacity={0.8}
            >
              {isDeletingAccount ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.deleteConfirmButtonText}>Delete My Account</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderColor: colors.border }]}
              onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// Settings Item Component
// ============================================================================

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  rightText?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  colors: any;
}

function SettingsItem({
  icon,
  label,
  rightText,
  rightElement,
  onPress,
  showChevron,
  isLast,
  colors,
}: SettingsItemProps) {
  return (
    <TouchableOpacity
      style={[
        styles.item,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.itemLeft}>
        <Feather name={icon} size={20} color={colors.text} />
        <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
      </View>

      <View style={styles.itemRight}>
        {rightText && (
          <Text style={[styles.itemRightText, { color: colors.textSecondary }]}>{rightText}</Text>
        )}
        {rightElement}
        {showChevron && (
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Theme Option Component
// ============================================================================

interface ThemeOptionProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
  isLast?: boolean;
  colors: any;
}

function ThemeOption({ icon, label, selected, onPress, isLast, colors }: ThemeOptionProps) {
  return (
    <TouchableOpacity
      style={[
        styles.item,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.itemLeft}>
        <Feather name={icon} size={20} color={colors.text} />
        <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={styles.itemRight}>
        {selected && <Feather name="check" size={20} color={colors.primary} />}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '600',
  },
  email: {
    fontSize: 16,
    marginTop: 4,
    fontWeight: '400',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 50,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemRightText: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Language modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  languageFlag: {
    fontSize: 28,
  },
  languageOptionText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalCancelButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Delete Account
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteWarningText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteInstructionText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  deleteConfirmButton: {
    backgroundColor: '#FF453A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
