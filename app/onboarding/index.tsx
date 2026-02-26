/**
 * Onboarding Wizard
 * 7-step wizard to collect user profile data.
 * Steps 1-5: profile info. Step 6: Plaid bank link. Step 7: Paywall.
 * All steps in one file with step switching.
 * Saves to database after each step.
 * Fully translated via LanguageContext.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { supabase, getOnboardingStatus, saveUserSSN } from '@/lib/supabase';
import { useAuth, useOnboarding } from '@/lib/CtxProvider';
import { Colors } from '@/constants/Colors';
import ProgressBar from '@/components/ui/ProgressBar';
import BankLinkButton from '@/components/BankLinkButton';
import { useLanguage } from '@/lib/LanguageContext';

// ============================================================================
// DESIGN CONSTANTS - Use unified design tokens
// ============================================================================
const colors = {
  background: Colors.dark.background,
  card: Colors.dark.card,
  text: Colors.dark.text,
  textSecondary: Colors.dark.textSecondary,
  accent: Colors.dark.primary,
  accentDark: Colors.dark.primaryDark,
  border: Colors.dark.borderLight,
  error: Colors.dark.error,
  progressBg: Colors.dark.progressBg,
};

// Gig platforms available for selection
const GIG_PLATFORMS = [
  { id: 'uber', name: 'Uber', icon: 'car' },
  { id: 'lyft', name: 'Lyft', icon: 'navigation' },
  { id: 'doordash', name: 'DoorDash', icon: 'package' },
  { id: 'instacart', name: 'Instacart', icon: 'shopping-cart' },
  { id: 'amazonflex', name: 'Amazon Flex', icon: 'box' },
  { id: 'other', name: 'Other', icon: 'more-horizontal' },
] as const;

// Total number of steps
const TOTAL_STEPS = 7;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { completeOnboarding } = useOnboarding();
  const { language, t } = useLanguage();
  const userId = user?.id ?? null;

  // Redirect to language selection if no language is set
  useEffect(() => {
    if (language === null) {
      router.replace('/onboarding/language');
    }
  }, [language]);

  // Current step (1-7)
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Step 1: Basic Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lastNameEdited, setLastNameEdited] = useState(false);

  // Step 2: Contact
  const [phone, setPhone] = useState('');

  // Step 3: Address
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [addressSelected, setAddressSelected] = useState(false);

  // Step 4: Tax Info
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ssn, setSsn] = useState('');
  const [skipSSN, setSkipSSN] = useState(false);

  // Step 5: Gig Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Step 6: Bank Link
  const [bankLinked, setBankLinked] = useState(false);

  // Step transition animation
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;

  // Google Maps API Key
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (userId) loadUserAndStep();
    else if (!user) {
      router.replace('/login');
    }
  }, [userId]);

  const loadUserAndStep = async () => {
    if (!userId) return;
    setLoadError(null);
    try {
      // Get current onboarding step from database
      const { step } = await getOnboardingStatus(userId);
      setCurrentStep(step);

      // Load existing profile data if any
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        // Populate form fields with existing data
        if (profile.full_name) {
          const nameParts = profile.full_name.split(' ');
          setFirstName(nameParts[0] || '');
          const ln = nameParts.slice(1).join(' ') || '';
          setLastName(ln);
          if (ln) setLastNameEdited(true); // Existing data is trusted
        }
        if (profile.phone) setPhone(profile.phone);
        if (profile.address) {
          setAddress(profile.address);
          setAddressSelected(true);
        }
        if (profile.city) setCity(profile.city);
        if (profile.state) setState(profile.state);
        if (profile.zip) setZip(profile.zip);
        if (profile.home_lat) setHomeLat(profile.home_lat);
        if (profile.home_lng) setHomeLng(profile.home_lng);
        if (profile.date_of_birth) {
          // Convert from YYYY-MM-DD to MM/DD/YYYY
          const parts = profile.date_of_birth.split('-');
          if (parts.length === 3) {
            setDateOfBirth(`${parts[1]}/${parts[2]}/${parts[0]}`);
          }
        }
        if (profile.gig_apps) setSelectedPlatforms(profile.gig_apps);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Don't redirect to login — the user IS authenticated, just can't load profile.
      // Show an error screen with retry/sign-out instead.
      setLoadError(
        "We couldn't load your account. Please check your internet connection."
      );
    } finally {
      setInitialLoading(false);
    }
  };

  const handleRetry = () => {
    if (retryCount >= 2) {
      // After 3 total attempts, suggest signing out
      Alert.alert(
        t('common.error') || 'Error',
        "We've tried multiple times but couldn't load your account. Please sign out and try again.",
        [
          { text: t('onboarding.back') || 'Cancel', style: 'cancel' },
          { text: t('common.signOut') || 'Sign Out', style: 'destructive', onPress: handleSignOut },
        ]
      );
      return;
    }
    setRetryCount((c) => c + 1);
    setInitialLoading(true);
    setLoadError(null);
    loadUserAndStep();
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      router.replace('/login');
    }
  };

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  const isValidName = (name: string): boolean => {
    return name.trim().length >= 2;
  };

  const formatPhone = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const isValidPhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10;
  };

  const formatDateOfBirth = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as MM/DD/YYYY
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
  };

  const isValidDateOfBirth = (dob: string): { valid: boolean; error?: string } => {
    const digits = dob.replace(/\D/g, '');
    if (digits.length !== 8) {
      return { valid: false, error: t('onboarding.step4.error.dobFormat') };
    }

    const month = parseInt(digits.slice(0, 2), 10);
    const day = parseInt(digits.slice(2, 4), 10);
    const year = parseInt(digits.slice(4, 8), 10);

    if (month < 1 || month > 12) {
      return { valid: false, error: t('onboarding.step4.error.dobMonth') };
    }

    if (day < 1 || day > 31) {
      return { valid: false, error: t('onboarding.step4.error.dobDay') };
    }

    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      return { valid: false, error: t('onboarding.step4.error.dobYear') };
    }

    // Check if user is at least 18
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return { valid: false, error: t('onboarding.step4.error.dobAge') };
    }

    return { valid: true };
  };

  const formatSSN = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as XXX-XX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 5) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
    }
  };

  const isValidSSN = (ssn: string): boolean => {
    const digits = ssn.replace(/\D/g, '');
    return digits.length === 9;
  };


  // ============================================================================
  // STEP HANDLERS
  // ============================================================================

  const handleStep1Next = async () => {
    // Validate
    if (!isValidName(firstName)) {
      Alert.alert(t('onboarding.error'), t('onboarding.step1.error.firstName'));
      return;
    }

    if (!isValidName(lastName)) {
      Alert.alert(t('onboarding.error'), t('onboarding.step1.error.lastName'));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      if (!userId) throw new Error('Not authenticated');

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          onboarding_step: 2,
        })
        .eq('id', userId);

      if (error) throw error;

      animateToStep(2);
    } catch (error: any) {
      console.error('Step 1 save error:', error);
      Alert.alert(t('onboarding.saveFailed'), error.message || t('onboarding.saveFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = async () => {
    // Validate
    if (!isValidPhone(phone)) {
      Alert.alert(t('onboarding.error'), t('onboarding.step2.error.phone'));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      if (!userId) throw new Error('Not authenticated');

      // Save to database (store just digits)
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: phone.replace(/\D/g, ''),
          onboarding_step: 3,
        })
        .eq('id', userId);

      if (error) throw error;

      animateToStep(3);
    } catch (error: any) {
      console.error('Step 2 save error:', error);
      Alert.alert(t('onboarding.saveFailed'), error.message || t('onboarding.saveFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Next = async () => {
    // Validate full address including city, state, zip
    if (!addressSelected || !address) {
      Alert.alert(t('onboarding.error'), t('onboarding.step3.error.address'));
      return;
    }
    if (!city || !state || !zip) {
      Alert.alert(t('onboarding.step3.error.incompleteTitle'), t('onboarding.step3.error.incomplete'));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      if (!userId) throw new Error('Not authenticated');

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({
          address: address,
          city: city,
          state: state,
          zip: zip,
          home_lat: homeLat,
          home_lng: homeLng,
          onboarding_step: 4,
        })
        .eq('id', userId);

      if (error) throw error;

      animateToStep(4);
    } catch (error: any) {
      console.error('Step 3 save error:', error);
      Alert.alert(t('onboarding.saveFailed'), error.message || t('onboarding.saveFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep4Next = async () => {
    // Validate date of birth
    const dobValidation = isValidDateOfBirth(dateOfBirth);
    if (!dobValidation.valid) {
      Alert.alert(t('onboarding.error'), dobValidation.error || t('onboarding.step4.error.dob'));
      return;
    }

    // Validate SSN only if not skipped
    if (!skipSSN && ssn.length > 0 && !isValidSSN(ssn)) {
      Alert.alert(t('onboarding.error'), t('onboarding.step4.error.ssn'));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      if (!userId) throw new Error('Not authenticated');

      // Convert MM/DD/YYYY to YYYY-MM-DD for database
      const dobDigits = dateOfBirth.replace(/\D/g, '');
      const month = dobDigits.slice(0, 2);
      const day = dobDigits.slice(2, 4);
      const year = dobDigits.slice(4, 8);
      const formattedDob = `${year}-${month}-${day}`;

      // Build update payload - SSN saved via encrypted RPC, not plaintext
      const updateData: Record<string, any> = {
        date_of_birth: formattedDob,
        onboarding_step: 5,
      };

      // Save SSN via encrypted RPC — NEVER store in plaintext
      if (!skipSSN && ssn.length > 0 && isValidSSN(ssn)) {
        console.log('🔐 Encrypting SSN...');
        const ssnResult = await saveUserSSN(userId!, ssn);
        if (!ssnResult.success) {
          console.error('❌ SSN encryption failed:', ssnResult.error);
          setLoading(false);
          Alert.alert(
            t('onboarding.step4.error.encryptionTitle') || 'Encryption Error',
            t('onboarding.step4.error.encryptionMessage') || "We couldn't securely encrypt your SSN. Please check your internet connection and try again. Your SSN will never be stored without encryption."
          );
          return;
        }
        console.log('✅ SSN encrypted successfully');
      }

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      animateToStep(5);
    } catch (error: any) {
      console.error('Step 4 save error:', error);
      Alert.alert(t('onboarding.saveFailed'), error.message || t('onboarding.saveFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep5Next = async () => {
    // Validate
    if (selectedPlatforms.length === 0) {
      Alert.alert(t('onboarding.error'), t('onboarding.step5.error.noPlatform'));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      if (!userId) throw new Error('Not authenticated');

      // Save gig apps and advance to bank link step
      const { error } = await supabase
        .from('profiles')
        .update({
          gig_apps: selectedPlatforms,
          onboarding_step: 6,
        })
        .eq('id', userId);

      if (error) throw error;

      animateToStep(6);
    } catch (error: any) {
      console.error('Step 5 save error:', error);
      Alert.alert(t('onboarding.saveFailed'), error.message || t('onboarding.saveFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep6Next = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateToStep(7);
  };

  const handleStep7Complete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      if (!userId) throw new Error('Not authenticated');

      // Mark onboarding as complete via the provider
      await completeOnboarding();

      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      console.error('Step 7 error:', error);
      Alert.alert(t('onboarding.error'), error.message || t('onboarding.saveFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const animateToStep = (nextStep: number, direction: 'forward' | 'back' = 'forward') => {
    const outX = direction === 'forward' ? -50 : 50;
    const inX = direction === 'forward' ? 50 : -50;

    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(stepTranslateX, { toValue: outX, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentStep(nextStep as any);
      stepTranslateX.setValue(inX);
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(stepTranslateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 1) {
      animateToStep(currentStep - 1, 'back');
    }
  };

  const togglePlatform = (platformId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    );
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <ProgressBar progress={currentStep / TOTAL_STEPS} colorScheme="dark" />
      <Text style={styles.progressText}>{t('onboarding.step')} {currentStep} {t('onboarding.of')} {TOTAL_STEPS}</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step1.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.step1.subtitle')}</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>{t('onboarding.step1.firstName.label')}</Text>
        <View style={styles.inputWrapper}>
          <Feather name="user" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('onboarding.step1.firstName.placeholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            editable={!loading}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>{t('onboarding.step1.lastName.label')}</Text>
        <View style={styles.inputWrapper}>
          <Feather name="user" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              setLastNameEdited(true);
            }}
            placeholder={t('onboarding.step1.lastName.placeholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            spellCheck={false}
            editable={!loading}
            selectTextOnFocus={true}
            onFocus={() => {
              if (!lastNameEdited && lastName) {
                setLastName('');
              }
            }}
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step2.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.step2.subtitle')}</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>{t('onboarding.step2.phone.label')}</Text>
        <View style={styles.inputWrapper}>
          <Feather name="phone" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(text) => setPhone(formatPhone(text))}
            placeholder={t('onboarding.step2.phone.placeholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            maxLength={14}
            editable={!loading}
          />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step3.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.step3.subtitle')}</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>{t('onboarding.step3.address.label')}</Text>
        <GooglePlacesAutocomplete
          placeholder={t('onboarding.step3.address.placeholder')}
          onPress={(data, details = null) => {
            if (details) {
              const addressComponents = details.address_components || [];
              let street = '';
              let cityValue = '';
              let stateValue = '';
              let zipValue = '';

              addressComponents.forEach((component) => {
                const types = component.types;
                if (types.includes('street_number')) {
                  street = component.long_name + ' ';
                }
                if (types.includes('route')) {
                  street += component.long_name;
                }
                if (types.includes('locality')) {
                  cityValue = component.long_name;
                }
                if (types.includes('administrative_area_level_1')) {
                  stateValue = component.short_name;
                }
                if (types.includes('postal_code')) {
                  zipValue = component.long_name;
                }
              });

              setAddress(street.trim() || details.formatted_address || '');
              setCity(cityValue);
              setState(stateValue);
              setZip(zipValue);
              setHomeLat(details.geometry?.location?.lat || null);
              setHomeLng(details.geometry?.location?.lng || null);
              setAddressSelected(true);
            }
          }}
          query={{
            key: googleMapsApiKey,
            language: 'en',
            components: 'country:us',
          }}
          fetchDetails={true}
          enablePoweredByContainer={false}
          disableScroll={true}
          listViewDisplayed="auto"
          styles={{
            container: { flex: 0, width: '100%', zIndex: 1000 },
            textInputContainer: { backgroundColor: 'transparent' },
            textInput: {
              backgroundColor: colors.card,
              color: colors.text,
              borderRadius: 12,
              height: 50,
              fontSize: 16,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.border,
            },
            listView: {
              backgroundColor: colors.card,
              borderRadius: 12,
              marginTop: 8,
              borderWidth: 1,
              borderColor: colors.border,
            },
            row: {
              backgroundColor: colors.card,
              padding: 16,
            },
            separator: {
              height: 1,
              backgroundColor: colors.border,
            },
            description: {
              color: colors.text,
              fontSize: 14,
            },
          }}
          textInputProps={{
            placeholderTextColor: colors.textSecondary,
            editable: !loading,
          }}
          debounce={300}
          minLength={2}
        />
      </View>

      {addressSelected && (
        <View style={styles.addressPreview}>
          <Text style={styles.addressPreviewTitle}>{t('onboarding.step3.selectedAddress')}</Text>
          <Text style={styles.addressPreviewText}>{address}</Text>
          {city && state && (
            <Text style={styles.addressPreviewText}>{city}, {state} {zip}</Text>
          )}
        </View>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step4.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.step4.subtitle')}</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>{t('onboarding.step4.dob.label')}</Text>
        <View style={styles.inputWrapper}>
          <Feather name="calendar" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={(text) => setDateOfBirth(formatDateOfBirth(text))}
            placeholder={t('onboarding.step4.dob.placeholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={10}
            editable={!loading}
          />
        </View>
      </View>

      {!skipSSN ? (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('onboarding.step4.ssn.label')}</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={ssn}
              onChangeText={(text) => setSsn(formatSSN(text))}
              placeholder={t('onboarding.step4.ssn.placeholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={11}
              secureTextEntry={true}
              editable={!loading}
            />
          </View>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              setSkipSSN(true);
              setSsn('');
            }}
          >
            <Text style={styles.skipButtonText}>
              {t('onboarding.step4.ssn.skip')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.skippedBox}>
          <Feather name="check-circle" size={20} color={colors.accent} />
          <Text style={styles.skippedText}>
            {t('onboarding.step4.ssn.skipped')}
          </Text>
          <TouchableOpacity onPress={() => setSkipSSN(false)}>
            <Text style={styles.undoText}>{t('onboarding.step4.ssn.undo')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step5.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.step5.subtitle')}</Text>

      <View style={styles.platformGrid}>
        {GIG_PLATFORMS.map((platform) => (
          <TouchableOpacity
            key={platform.id}
            style={[
              styles.platformCard,
              selectedPlatforms.includes(platform.id) && styles.platformCardSelected,
            ]}
            onPress={() => togglePlatform(platform.id)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Feather
              name={platform.icon as any}
              size={28}
              color={
                selectedPlatforms.includes(platform.id)
                  ? colors.accent
                  : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.platformName,
                selectedPlatforms.includes(platform.id) && styles.platformNameSelected,
              ]}
            >
              {platform.name}
            </Text>
            {selectedPlatforms.includes(platform.id) && (
              <View style={styles.checkmark}>
                <Feather name="check" size={16} color={colors.background} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step6.title')}</Text>
      <Text style={styles.stepSubtitle}>{t('onboarding.step6.subtitle')}</Text>

      <View style={{ gap: 16, marginTop: 8 }}>
        {[
          { icon: 'refresh-cw', text: t('onboarding.step6.benefit1') },
          { icon: 'tag', text: t('onboarding.step6.benefit2') },
          { icon: 'edit-3', text: t('onboarding.step6.benefit3') },
        ].map((item) => (
          <View key={item.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Feather name={item.icon as any} size={18} color={colors.accent} />
            </View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500', flex: 1 }}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 32, alignItems: 'center' }}>
        <BankLinkButton
          onSuccess={() => {
            setBankLinked(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
          onError={() => {
            // User can still skip or retry
          }}
        />
      </View>

      {bankLinked && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent }}>
          <Feather name="check-circle" size={20} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>
            {t('onboarding.step6.success')}
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep7 = () => (
    <View style={styles.stepContent}>
      <View style={{ alignItems: 'flex-end' }}>
        <TouchableOpacity
          onPress={handleStep7Complete}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ opacity: 0.6 }}
        >
          <Feather name="x" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={[styles.stepTitle, { textAlign: 'center' }]}>{t('onboarding.step7.title')}</Text>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.accent, padding: 24, alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          {t('onboarding.step7.freePlan')}
        </Text>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: 4 }}>
          {t('onboarding.step7.price')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          {t('onboarding.step7.priceSubtext')}
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        {[
          t('onboarding.step7.feature1'),
          t('onboarding.step7.feature2'),
          t('onboarding.step7.feature3'),
          t('onboarding.step7.feature4'),
          t('onboarding.step7.feature5'),
        ].map((feature) => (
          <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="check" size={18} color={colors.accent} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    console.log('Onboarding: Rendering step', currentStep, 'of', TOTAL_STEPS);
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      case 7:
        return renderStep7();
      default:
        return renderStep1();
    }
  };

  const handleNextPress = () => {
    switch (currentStep) {
      case 1:
        handleStep1Next();
        break;
      case 2:
        handleStep2Next();
        break;
      case 3:
        handleStep3Next();
        break;
      case 4:
        handleStep4Next();
        break;
      case 5:
        handleStep5Next();
        break;
      case 6:
        handleStep6Next();
        break;
      case 7:
        handleStep7Complete();
        break;
    }
  };

  const getButtonText = () => {
    if (currentStep === 7) return t('onboarding.step7.continueButton');
    if (currentStep === 6 && !bankLinked) return t('onboarding.skip');
    return t('onboarding.continue');
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Feather name="wifi-off" size={48} color={colors.textSecondary} />
          <Text style={[styles.stepTitle, { textAlign: 'center', marginTop: 24 }]}>
            {t('onboarding.error') || 'Error'}
          </Text>
          <Text style={[styles.stepSubtitle, { textAlign: 'center', marginTop: 8 }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            activeOpacity={0.8}
            style={{ marginTop: 24, width: '80%', borderRadius: 12, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentDark]}
              style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 12 }}
            >
              <Text style={{ color: colors.background, fontSize: 17, fontWeight: '600' }}>
                {t('onboarding.retry') || 'Retry'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSignOut}
            style={{ marginTop: 16, paddingVertical: 12 }}
          >
            <Text style={{ color: colors.error, fontSize: 16, fontWeight: '600' }}>
              {t('common.signOut') || 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Progress Bar (hidden on paywall step) */}
        {currentStep < 7 && renderProgressBar()}

        {/* Content with step transition animation */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: stepOpacity, transform: [{ translateX: stepTranslateX }] }}>
            {renderCurrentStep()}
          </Animated.View>
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {currentStep > 1 && currentStep < 7 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
              <Text style={styles.backButtonText}>{t('onboarding.back')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNextPress}
            disabled={loading}
            activeOpacity={0.8}
            style={[styles.nextButtonWrapper, (currentStep === 1 || currentStep === 7) && styles.nextButtonFull]}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentDark]}
              style={styles.nextButton}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {getButtonText()}
                  </Text>
                  <Feather name="arrow-right" size={20} color={colors.background} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  progressContainer: {
    padding: 20,
    paddingTop: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.progressBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  addressPreview: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addressPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 8,
  },
  addressPreviewText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  platformCard: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginBottom: 12,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  platformCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(198, 255, 94, 0.1)',
  },
  platformName: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  platformNameSelected: {
    color: colors.accent,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 8,
  },
  backButtonText: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '600',
  },
  nextButtonWrapper: {
    flex: 2,
    height: 56,
    minHeight: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.background,
  },
  skipButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  skippedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  skippedText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  undoText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
});
