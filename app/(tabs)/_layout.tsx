import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useLanguage } from '@/lib/LanguageContext';

export default function TabLayout() {
  const { session, loading } = useAuth();
  const { colors } = useRobinhoodTheme();
  const { t } = useLanguage();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tabs.insights'),
          tabBarIcon: ({ color }) => <Feather name="bar-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t('tabs.expenses'),
          tabBarIcon: ({ color }) => <Feather name="pie-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('tabs.earnings'),
          tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="file-now"
        options={{
          title: t('tabs.fileNow'),
          tabBarIcon: ({ color }) => <Feather name="file-text" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <Feather name="settings" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analysis',
          tabBarIcon: ({ color }) => <Feather name="trending-up" size={24} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="deductions"
        options={{
          title: 'Deductions',
          tabBarIcon: ({ color }) => <Feather name="check-circle" size={24} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="bank-transactions"
        options={{
          title: 'Bank Transactions',
          tabBarIcon: ({ color }) => <Feather name="credit-card" size={24} color={color} />,
          href: null,
        }}
      />
    </Tabs>
  );
}
