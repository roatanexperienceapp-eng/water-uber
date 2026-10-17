import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { APP_VARIANT } from '@/config';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const c = useTheme();
  if (APP_VARIANT === 'captain') return <Redirect href="/captain" />;
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab_ride'), tabBarIcon: icon('boat') }} />
      <Tabs.Screen name="explore" options={{ title: t('tab_explore'), tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="trips" options={{ title: t('tab_trips'), tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="account" options={{ title: t('tab_account'), tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
