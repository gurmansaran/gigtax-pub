/**
 * Onboarding Layout
 * Stack layout for the onboarding flow including language selection.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="language" />
      <Stack.Screen name="index" />
    </Stack>
  );
}
