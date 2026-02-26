import { Stack } from 'expo-router';

export default function FilingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="expense-review" />
      <Stack.Screen name="amendment" />
    </Stack>
  );
}
