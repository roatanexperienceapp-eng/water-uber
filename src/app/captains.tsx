import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Note } from '@/components/ui';
import { LISTINGS } from '@/data/catalogue';
import { useCrew } from '@/lib/crew';
import { radius, space, type, useTheme } from '@/theme';

const ROLE_ICON = { taxi: '🚤', fishing: '🎣', snorkel: '🤿' } as const;

/** Our captains and our own tours, in one place. */
export default function Captains() {
  const { t } = useTranslation();
  const c = useTheme();
  const crew = useCrew();
  const ours = LISTINGS.filter((l) => l.ours && (l.portal === 'snork' || l.portal === 'fish') && l.priceText);

  return (
    <SubScreen title={t('captainsH')}>
      <Note>{t('captainsSub')}</Note>
      <View style={{ gap: space(2) }}>
        {crew.map((m) => (
          <View key={m.id} style={[styles.row, { backgroundColor: c.tile }]}>
            <View style={[styles.avatar, { backgroundColor: c.ink }]}>
              <Text style={[type.bodyStrong, { color: c.onInk }]}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{m.name}</Text>
              <Text style={[type.small, { color: c.muted }]}>{m.roles.map((r) => `${ROLE_ICON[r]} ${t(`role_${r}`)}`).join('  ·  ')}</Text>
            </View>
            {m.certified ? (
              <View style={[styles.badge, { backgroundColor: '#E8F7EE' }]}>
                <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
                <Text style={[type.label, { color: '#14532D', fontSize: 12 }]}>{t('certified')}</Text>
              </View>
            ) : (
              <Text style={[type.small, { color: c.muted, fontSize: 12 }]}>{t('licencePending')}</Text>
            )}
          </View>
        ))}
      </View>

      <Text style={[type.h2, { color: c.ink, marginTop: space(2) }]}>{t('ourToursH')}</Text>
      {ours.map((l) => (
        <Pressable
          key={l.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/checkout', params: { kind: 'listing', id: l.id } })}
          style={({ pressed }) => [styles.tour, { borderColor: c.line, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ fontSize: 22 }}>{l.portal === 'fish' ? '🎣' : '🤿'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{l.name}</Text>
            <Text style={[type.small, { color: c.muted }]}>{l.priceText}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => router.push('/pass')} style={[styles.tour, { borderColor: c.flame }]}>
        <Ionicons name="gift" size={22} color={c.flame} />
        <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('pkgH')}</Text>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Pressable>
    </SubScreen>
  );
}

function initials(name: string): string {
  const words = name.replace(/^Captain\s+/i, '').split(/\s+/).filter(Boolean);
  return words.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.lg, padding: space(3) },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  tour: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderWidth: 1, borderRadius: radius.lg, padding: space(3) },
});
