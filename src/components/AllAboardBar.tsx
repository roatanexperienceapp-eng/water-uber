import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { countdown, CRUISE_SETTINGS, islandClock, useMyShip } from '@/lib/cruise';
import { radius, space, type, useTheme } from '@/theme';

/** Always-visible all-aboard countdown for cruise guests. Turns orange under 2 h and red under 1 h. */
export function AllAboardBar() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const ship = useMyShip();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!ship) return null;
  const left = countdown(ship.allAboardAt, now);
  const backBy = new Date(ship.allAboardAt.getTime() - CRUISE_SETTINGS.backAtPortMinutesBefore * 60_000);
  const bg = !left ? c.tile2 : left.minutes < 60 ? c.sos : left.minutes < 120 ? '#C2410C' : c.ink;
  return (
    <View style={[styles.bar, { backgroundColor: bg }]} accessibilityRole="summary">
      <Text style={{ fontSize: 20 }}>🚢</Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: '#fff' }]}>
          {left ? t('aboardIn').replace('{t}', left.text) : t('shipSailed')} · {islandClock(ship.allAboardAt, i18n.language)}
        </Text>
        <Text style={[type.small, { color: '#fff', opacity: 0.85 }]}>
          {t('backAtPortBy').replace('{t}', islandClock(backBy, i18n.language))} · {t('islandTime')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3) },
});
