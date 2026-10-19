import '@/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { APP_VARIANT } from '@/config';

// The background location task must be defined at startup, before any screen renders.
if (APP_VARIANT === 'captain' && Platform.OS !== 'web') {
  require('@/lib/captainLocation');
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === 'dark' ? '#000' : '#fff' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="portal/[key]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="confirmation" options={{ gestureEnabled: false }} />
        <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pass" />
        <Stack.Screen name="paid" options={{ gestureEnabled: false }} />
        <Stack.Screen name="split/[token]" />
        <Stack.Screen name="ticket/[id]" />
        <Stack.Screen name="inbox-compose" />
        <Stack.Screen name="give" />
        <Stack.Screen name="captains" />
        <Stack.Screen name="community" />
        <Stack.Screen name="marine" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="me/profile" />
        <Stack.Screen name="me/settings" />
        <Stack.Screen name="me/places" />
        <Stack.Screen name="me/help" />
        <Stack.Screen name="me/wallet" />
        <Stack.Screen name="me/safety" />
        <Stack.Screen name="me/partner" />
        <Stack.Screen name="me/legal" />
        <Stack.Screen name="captain/index" />
      </Stack>
    </SafeAreaProvider>
  );
}
