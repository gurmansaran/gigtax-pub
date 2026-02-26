/**
 * Profile Screen — Full rebuild with all sections.
 * Personal Info, Address (Google Places), SSN, Gig Platforms,
 * Bank Connection, Subscription, Appearance, Sign Out.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  TextInput, ActivityIndicator, Modal, Platform, KeyboardAvoidingView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation, useFocusEffect } from 'expo-router';
import { useAuth, useRevenueCat, useTaxProfile } from '@/lib/CtxProvider';
import { supabase } from '@/lib/supabase';
import { saveUserSSN } from '@/lib/supabase';
import { useRobinhoodTheme, type ThemePreference } from '@/hooks/use-robinhood-theme';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import AddressSearch from '@/components/AddressSearch';
import SSNInput from '@/components/tax/SSNInput';
import BankLinkButton from '@/components/BankLinkButton';
import { formatMMDDYYYY, parseMMDDYYYYToISO, isoToMMDDYYYY } from '@/lib/dateUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function stripPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

const GIG_PLATFORMS = [
  { id: 'uber', name: 'Uber', icon: 'car' },
  { id: 'lyft', name: 'Lyft', icon: 'navigation' },
  { id: 'doordash', name: 'DoorDash', icon: 'package' },
  { id: 'instacart', name: 'Instacart', icon: 'shopping-cart' },
  { id: 'amazonflex', name: 'Amazon Flex', icon: 'truck' },
  { id: 'other', name: 'Other', icon: 'more-horizontal' },
] as const;

const FILING_STATUSES = [
  { key: 'single', label: 'Single' },
  { key: 'married_joint', label: 'MFJ' },
  { key: 'married_separate', label: 'MFS' },
  { key: 'head_household', label: 'HOH' },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user } = useAuth();
  const { taxProfile, updateTaxProfile, refreshProfile } = useTaxProfile();
  const { isPro, presentPaywall, presentCustomerCenter } = useRevenueCat();
  const { colors, isDark, themePreference, setThemePreference } = useRobinhoodTheme();
  const navigation = useNavigation();

  // Local state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [dob, setDob] = useState(''); // MM/DD/YYYY display format
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [ssn, setSsn] = useState('');
  const [filingStatus, setFilingStatus] = useState('single');
  const [gigApps, setGigApps] = useState<string[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Bank connection state
  const [bankConnected, setBankConnected] = useState(false);
  const [bankName, setBankName] = useState('');

  // Dirty tracking
  const initialRef = useRef<Record<string, any> | null>(null);
  const hasSetInitial = useRef(false);

  const isDirty = (() => {
    if (!initialRef.current) return false;
    const i = initialRef.current;
    return (
      firstName !== i.firstName || lastName !== i.lastName ||
      email !== i.email || phoneDigits !== i.phone ||
      dob !== i.dob || street !== i.street || city !== i.city ||
      state !== i.state || zip !== i.zip || filingStatus !== i.filingStatus ||
      JSON.stringify(gigApps) !== JSON.stringify(i.gigApps)
    );
  })();

  // ─── Load Profile ──────────────────────────────────────────────────────

  const loadProfile = useCallback(() => {
    setLoading(true);
    if (user?.email) setEmail(user.email);

    if (taxProfile) {
      setFirstName(taxProfile.firstName || '');
      setLastName(taxProfile.lastName || '');
      setStreet(taxProfile.address || '');
      setCity(taxProfile.city || '');
      setState(taxProfile.state || '');
      setZip(taxProfile.zip || '');
      setSsn(taxProfile.ssn || '');
      setFilingStatus(taxProfile.filingStatus || 'single');
      setGigApps(taxProfile.gigApps || []);

      // DOB: convert ISO (YYYY-MM-DD) to display (MM/DD/YYYY)
      if (taxProfile.dateOfBirth) {
        setDob(isoToMMDDYYYY(taxProfile.dateOfBirth));
      }

      const raw = (taxProfile.phone || '').replace(/\D/g, '').slice(0, 10);
      setPhoneDigits(raw);
    }

    setLoading(false);
  }, [user, taxProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Refresh on focus
  useFocusEffect(useCallback(() => { refreshProfile(); }, [refreshProfile]));

  // Set initial dirty ref once
  useEffect(() => {
    if (!loading && !hasSetInitial.current) {
      hasSetInitial.current = true;
      initialRef.current = {
        firstName, lastName, email, phone: phoneDigits,
        dob, street, city, state, zip, filingStatus, gigApps: [...gigApps],
      };
    }
  }, [loading, firstName, lastName, email, phoneDigits, dob, street, city, state, zip, filingStatus, gigApps]);

  // Unsaved changes warning
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved changes.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, isDirty]);

  // Load bank connection status
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_bank_accounts').select('institution_name').eq('user_id', user.id).limit(1)
      .then(({ data: rows }) => {
        if (rows && rows.length > 0) {
          setBankConnected(true);
          setBankName(rows[0].institution_name || 'Bank');
        }
      });
  }, [user?.id]);

  // ─── Save ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    try {
      setSaving(true);

      // Parse DOB to ISO for storage
      const dobISO = dob ? parseMMDDYYYYToISO(dob) : '';

      await updateTaxProfile({
        firstName,
        lastName,
        address: street,
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        zip: zip.trim().replace(/\D/g, '').slice(0, 10),
        phone: phoneDigits,
        dateOfBirth: dobISO || undefined,
        filingStatus: filingStatus as any,
        gigApps,
      });

      // Save SSN via encrypted RPC if it has 9 digits
      if (ssn.replace(/\D/g, '').length === 9 && user?.id) {
        await saveUserSSN(user.id, ssn);
      }

      // Update email if changed
      if (email !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      }

      // Reset dirty tracking
      initialRef.current = {
        firstName, lastName, email, phone: phoneDigits,
        dob, street, city, state, zip, filingStatus, gigApps: [...gigApps],
      };
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update profile';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Sign Out ──────────────────────────────────────────────────────────

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          try { await supabase.auth.signOut(); router.replace('/login'); }
          catch (e: any) { Alert.alert('Error', e.message || 'Sign out failed'); }
        },
      },
    ]);
  };

  // ─── Gig Platform Toggle ──────────────────────────────────────────────

  const toggleGigApp = (id: string) => {
    setGigApps(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </SafeAreaView>
    );
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
  const fullAddress = [street, [city, state, zip].filter(Boolean).join(', ')].filter(Boolean).join(', ');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ─── Header ─────────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>{initials}</Text>
          </View>
          <Text style={[styles.headerName, { color: colors.text }]}>
            {[firstName, lastName].filter(Boolean).join(' ') || 'Your Name'}
          </Text>
          <Text style={[styles.headerEmail, { color: colors.textSecondary }]}>{email}</Text>
        </View>

        {/* ─── Personal Information ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PERSONAL INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>First Name</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.fieldSep, { backgroundColor: colors.border }]} />

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Last Name</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.fieldSep, { backgroundColor: colors.border }]} />

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date of Birth</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                value={dob}
                onChangeText={(t) => setDob(formatMMDDYYYY(t))}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={[styles.fieldSep, { backgroundColor: colors.border }]} />

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                value={formatPhoneDisplay(phoneDigits)}
                onChangeText={(t) => setPhoneDigits(stripPhone(t))}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>
          </View>
        </View>

        {/* ─── Address ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ADDRESS</Text>
          <TouchableOpacity
            style={[styles.card, styles.addressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowAddressModal(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.addressText, { color: fullAddress ? colors.text : colors.textSecondary }]} numberOfLines={2}>
                {fullAddress || 'Tap to search for your address'}
              </Text>
            </View>
            <Feather name="search" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Address Modal */}
        <Modal visible={showAddressModal} transparent animationType="slide">
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Find Address</Text>
                <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                  <Feather name="x" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.addressSearchWrapper}>
                <AddressSearch
                  placeholder="Search for your address"
                  value={street}
                  onSelect={(addr) => {
                    setStreet(addr.street);
                    setCity(addr.city);
                    setState(addr.state);
                    setZip(addr.zip);
                    setShowAddressModal(false);
                  }}
                />
              </View>
              {street ? (
                <View style={[styles.selectedAddr, { backgroundColor: colors.surface }]}>
                  <Feather name="check-circle" size={16} color={colors.primary} />
                  <Text style={[styles.selectedAddrText, { color: colors.text }]}>
                    {fullAddress}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.modalDoneBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowAddressModal(false)}
              >
                <Text style={[styles.modalDoneText, { color: colors.text }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ─── Tax Information ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TAX INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SSNInput
              label="Social Security Number"
              value={ssn}
              onChangeText={setSsn}
              style={{ marginBottom: 4 }}
              containerStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
            />
            <View style={styles.encryptedBadge}>
              <Feather name="lock" size={12} color={colors.textSecondary} />
              <Text style={[styles.encryptedText, { color: colors.textSecondary }]}>Encrypted & Secure</Text>
            </View>

            <View style={[styles.fieldSep, { backgroundColor: colors.border, marginTop: 12 }]} />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14, marginBottom: 10 }]}>Filing Status</Text>
            <View style={styles.pillRow}>
              {FILING_STATUSES.map((fs) => {
                const active = filingStatus === fs.key;
                return (
                  <TouchableOpacity
                    key={fs.key}
                    style={[
                      styles.pill,
                      { borderColor: active ? colors.primary : colors.border },
                      active && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setFilingStatus(fs.key)}
                  >
                    <Text style={[styles.pillText, { color: active ? colors.background : colors.text }]}>
                      {fs.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── Gig Platforms ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GIG PLATFORMS</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.pillRow}>
              {GIG_PLATFORMS.map((gig) => {
                const active = gigApps.includes(gig.id);
                return (
                  <TouchableOpacity
                    key={gig.id}
                    style={[
                      styles.gigPill,
                      { borderColor: active ? colors.primary : colors.border },
                      active && { backgroundColor: colors.primary + '20' },
                    ]}
                    onPress={() => toggleGigApp(gig.id)}
                  >
                    <Feather name={gig.icon as any} size={16} color={active ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.gigPillText, { color: active ? colors.primary : colors.text }]}>
                      {gig.name}
                    </Text>
                    {active && <Feather name="check" size={14} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── Bank Connection ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>BANK CONNECTION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {bankConnected ? (
              <View style={styles.bankConnectedRow}>
                <View style={[styles.bankIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Feather name="check-circle" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bankName, { color: colors.text }]}>{bankName}</Text>
                  <Text style={[styles.bankSubtext, { color: colors.textSecondary }]}>Connected</Text>
                </View>
              </View>
            ) : (
              <BankLinkButton
                onSuccess={() => {
                  setBankConnected(true);
                  setBankName('Bank');
                }}
              />
            )}
          </View>
        </View>

        {/* ─── Save Button ────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.background }]}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* ─── Subscription ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUBSCRIPTION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {isPro ? (
              <TouchableOpacity style={styles.settingsRow} onPress={() => presentCustomerCenter()}>
                <Feather name="credit-card" size={20} color={colors.primary} />
                <Text style={[styles.settingsRowText, { color: colors.text }]}>Manage Subscription</Text>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.settingsRow} onPress={() => presentPaywall()}>
                <Feather name="zap" size={20} color={colors.primary} />
                <Text style={[styles.settingsRowText, { color: colors.text }]}>Upgrade to Gig Tax Pro</Text>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Appearance ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['system', 'light', 'dark'] as const).map((pref) => {
              const active = themePreference === pref;
              const icon = pref === 'system' ? 'smartphone' : pref === 'light' ? 'sun' : 'moon';
              const label = pref === 'system' ? 'Match System' : pref === 'light' ? 'Light Mode' : 'Dark Mode';
              return (
                <TouchableOpacity
                  key={pref}
                  style={[styles.themeOption, active && { backgroundColor: colors.primary }]}
                  onPress={() => setThemePreference(pref)}
                >
                  <Feather name={icon} size={20} color={active ? colors.background : colors.text} />
                  <Text style={[styles.themeOptionText, { color: active ? colors.background : colors.text }]}>
                    {label}
                  </Text>
                  {active && <Feather name="check" size={20} color={colors.background} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── Sign Out ───────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 60 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerSection: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 24, fontWeight: '700' },
  headerName: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  headerEmail: { fontSize: 14 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: { borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },

  // Form fields
  fieldRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  fieldLabel: { fontSize: 14, fontWeight: '500', width: 100 },
  fieldInput: { flex: 1, fontSize: 16, textAlign: 'right', paddingVertical: 8 },
  fieldSep: { height: StyleSheet.hairlineWidth, marginVertical: 2 },

  // Address
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addressText: { fontSize: 16 },

  // Address modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  addressSearchWrapper: { zIndex: 1000, minHeight: 60, marginBottom: 16 },
  selectedAddr: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 8, marginBottom: 16 },
  selectedAddrText: { fontSize: 15, flex: 1 },
  modalDoneBtn: { padding: 16, borderRadius: 8, alignItems: 'center' },
  modalDoneText: { fontSize: 16, fontWeight: '600' },

  // SSN encrypted badge
  encryptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  encryptedText: { fontSize: 12, fontWeight: '500' },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5 },
  pillText: { fontSize: 14, fontWeight: '600' },

  // Gig pills
  gigPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  gigPillText: { fontSize: 14, fontWeight: '500' },

  // Bank
  bankConnectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bankIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bankName: { fontSize: 16, fontWeight: '600' },
  bankSubtext: { fontSize: 13, marginTop: 2 },

  // Save
  saveButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 32, minHeight: 52, justifyContent: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '700' },

  // Settings rows
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 4, minHeight: 44 },
  settingsRowText: { fontSize: 16, flex: 1 },

  // Theme
  themeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 8, minHeight: 48 },
  themeOptionText: { fontSize: 16, flex: 1 },

  // Sign out
  signOutButton: { padding: 16, alignItems: 'center', marginBottom: 20 },
  signOutText: { fontSize: 16, fontWeight: '600' },
});
