import '@/i18n';
import { CaveatBrush_400Regular, useFonts } from '@expo-google-fonts/caveat-brush';
import { router, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { APP_VARIANT } from '@/config';
import { installErrorReporting, reportError, setErrorRoute } from '@/lib/errorReport';

// Crashes anywhere in the app are reported to the office (App health).
installErrorReporting();

// The background location task must be defined at startup, before any screen renders.
if (APP_VARIANT === 'captain' && Platform.OS !== 'web') {
  require('@/lib/captainLocation');
}

/** Shown instead of a frozen or red screen when a screen crashes. The crash is reported first. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  useEffect(() => {
    reportError(error, 'render');
  }, [error]);
  const ink = dark ? '#f5f5f5' : '#0b0b0c';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: dark ? '#000' : '#fff' }}>
      <Text style={{ fontSize: 44 }}>🛟</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: ink, textAlign: 'center' }}>{t('crashTitle')}</Text>
      <Text style={{ fontSize: 15, color: dark ? '#a5a8ad' : '#5f6368', textAlign: 'center' }}>{t('crashBody')}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={{ backgroundColor: '#FF4A1C', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{t('crashRetry')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { retry(); router.replace('/'); }} hitSlop={8}>
        <Text style={{ color: ink, fontWeight: '700', fontSize: 14 }}>{t('crashHome')}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const path = usePathname();
  useEffect(() => {
    setErrorRoute(path);
  }, [path]);
  // Brush lettering for the "Water taxi ▾" title. Screens render right away; the title switches font once loaded.
  useFonts({ CaveatBrush_400Regular });
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === 'dark' ? '#000' : '#fff' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="portal/[key]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="zelle" />
        <Stack.Screen name="confirmation" options={{ gestureEnabled: false }} />
        <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pass" />
        <Stack.Screen name="paid" options={{ gestureEnabled: false }} />
        <Stack.Screen name="split/[token]" />
        <Stack.Screen name="ticket/[id]" />
        <Stack.Screen name="land/[id]" />
        <Stack.Screen name="gas" />
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
