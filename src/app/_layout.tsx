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
        <Stack.Screen name="captain/index" />
      </Stack>
    </SafeAreaProvider>
  );
}
