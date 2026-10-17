import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Page shell for the Account sub-screens: back button, big title, scrolling content. */
export function SubScreen({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} style={[styles.round, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[type.h1, { color: c.ink }]}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Uber-style list row: outline icon, title, optional subtitle, optional badge. */
export function MenuRow(p: { icon: IconName; title: string; sub?: string; badge?: string; danger?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={p.onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={p.icon} size={24} color={p.danger ? c.sos : c.ink} style={{ width: 30 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, { color: p.danger ? c.sos : c.ink }]}>{p.title}</Text>
        {p.sub ? <Text style={[type.small, { color: c.muted, fontSize: 14 }]}>{p.sub}</Text> : null}
      </View>
      {p.badge ? (
        <View style={[styles.badge, { backgroundColor: c.flame }]}>
          <Text style={[type.label, { color: '#fff', fontSize: 13 }]}>{p.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Big rounded tile with icon + label (Help, Wallet, Safety, Inbox). */
export function Tile(p: { icon: IconName; label: string; badge?: number; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={p.onPress} style={({ pressed }) => [styles.tile, { backgroundColor: c.tile, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={p.icon} size={26} color={c.ink} />
      <Text style={[styles.tileText, { color: c.ink }]}>{p.label}</Text>
      {p.badge ? (
        <View style={[styles.dot, { backgroundColor: c.flame }]}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{p.badge > 9 ? '9+' : p.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingVertical: space(4) },
  rowTitle: { fontSize: 18, fontWeight: '500' },
  badge: { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.lg, paddingHorizontal: space(5), paddingVertical: space(6) },
  tileText: { fontSize: 18, fontWeight: '500' },
  dot: { marginLeft: 'auto', minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
