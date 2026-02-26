/**
 * BankLinkButton Component
 * Handles Plaid Link integration for connecting bank accounts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/CtxProvider';
import { supabase } from '@/lib/supabase';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

import {
  create,
  open,
  destroy,
  dismissLink,
  LinkIOSPresentationStyle,
  LinkLogLevel,
  type LinkSuccess,
  type LinkExit,
} from 'react-native-plaid-link-sdk';

interface BankLinkButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function BankLinkButton({ onSuccess, onError }: BankLinkButtonProps) {
  const { user } = useAuth();
  const { colors } = useRobinhoodTheme();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(true);

  // Fetch link token from Supabase Edge Function
  useEffect(() => {
    fetchLinkToken();
  }, []);

  const fetchLinkToken = async () => {
    if (!user) {
      setFetchingToken(false);
      return;
    }

    try {
      setFetchingToken(true);
      
      // Get the session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-plaid-link-token', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.link_token) {
        setLinkToken(data.link_token);
      } else {
        throw new Error('No link token received');
      }
    } catch (error) {
      console.error('Error fetching link token:', error);
      Alert.alert(
        'Connection Error',
        'Failed to initialize bank connection. Please try again.',
        [{ text: 'OK' }]
      );
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setFetchingToken(false);
    }
  };

  // Handle Plaid Link success
  const handlePlaidSuccess = async (success: LinkSuccess) => {
    const publicToken = success.publicToken;
    const metadata = success.metadata;
    if (!user) return;

    setLoading(true);
    try {
      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Exchange public token via Edge Function
      const { data, error } = await supabase.functions.invoke('exchange-plaid-token', {
        body: { 
          public_token: publicToken,
          institution_name: metadata?.institution?.name,
          institution_id: metadata?.institution?.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        Alert.alert(
          'Bank Linked!',
          `${data.institution_name || 'Your bank'} has been successfully linked!`,
          [{ text: 'OK' }]
        );
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error('Failed to link bank account');
      }
    } catch (error) {
      console.error('Error exchanging public token:', error);
      Alert.alert(
        'Connection Error',
        'Failed to complete bank connection. Please try again.',
        [{ text: 'OK' }]
      );
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Plaid Link exit (v12 API: call dismissLink after exit)
  const handlePlaidExit = (exit: LinkExit) => {
    try {
      dismissLink();
    } catch (_) {
      /* ignore */
    }
    if (exit.error) {
      console.error('Plaid Link error:', exit.error);
      const errorMsg =
        exit.error?.displayMessage ??
        exit.error?.errorMessage ??
        'Bank connection was cancelled or failed.';
      Alert.alert('Connection Cancelled', errorMsg, [{ text: 'OK' }]);
      if (onError) {
        onError(new Error(errorMsg));
      }
    }
  };

  // Open Plaid Link (v12 API: destroy prior session, create then open)
  const handlePress = async () => {
    if (!linkToken) {
      Alert.alert('Error', 'Link token not available. Please try again.');
      fetchLinkToken();
      return;
    }

    if (loading) return;

    try {
      await destroy();
      create({
        token: linkToken,
        noLoadingState: false,
        logLevel: LinkLogLevel.ERROR,
        onLoad: () => {},
      });
      open({
        onSuccess: handlePlaidSuccess,
        onExit: handlePlaidExit,
        iOSPresentationStyle: LinkIOSPresentationStyle.MODAL,
        logLevel: LinkLogLevel.ERROR,
      });
    } catch (err: unknown) {
      console.warn('Plaid native module not available (e.g. Expo Go). Run: npx expo run:ios', err);
      Alert.alert(
        'Bank connection unavailable',
        'Linking requires a development build. Run "npx expo run:ios" and try again.',
        [{ text: 'OK' }]
      );
      if (onError) {
        onError(err instanceof Error ? err : new Error('Plaid unavailable'));
      }
    }
  };

  if (fetchingToken) {
    return (
      <View style={styles.container}>
        <View style={[styles.button, { backgroundColor: colors.primary }]}>
          <ActivityIndicator size="small" color={colors.background} />
          <Text style={[styles.buttonText, { color: colors.background }]}>Initializing...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: colors.primary },
          loading && styles.buttonDisabled
        ]}
        onPress={handlePress}
        disabled={loading || !linkToken}>
        {loading ? (
          <>
            <ActivityIndicator size="small" color={colors.background} style={styles.icon} />
            <Text style={[styles.buttonText, { color: colors.background }]}>Connecting...</Text>
          </>
        ) : (
          <>
            <Ionicons name="card-outline" size={24} color={colors.background} style={styles.icon} />
            <Text style={[styles.buttonText, { color: colors.background }]}>Connect Primary Bank</Text>
          </>
        )}
      </TouchableOpacity>
      
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Securely connect your bank account to automatically track expenses
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: 280,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
});
