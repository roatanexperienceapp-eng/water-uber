import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { crowdFor, roatanDate, shipCalls, type CrowdLevel } from '@/lib/cruise';
import { radius, space, type, useTheme } from '@/theme';

const COLORS: Record<CrowdLevel, string> = { quiet: '#22C55E', busy: '#F59E0B', very_busy: '#EA580C', packed: '#D92D20' };
const BARS: Record<CrowdLevel, number> = { quiet: 1, busy: 2, very_busy: 3, packed: 4 };

/** How busy the beaches are today, from the ships in port. Useful to cruise and week-stay guests alike. */
export function CrowdMeter() {
  const { t } = useTranslation();
  const c = useTheme();
  const [state, setState] = useState<ReturnType<typeof crowdFor> | null>(null);
  useEffect(() => {
    const today = roatanDate(new Date());
    shipCalls(today, 1).then((calls) => setState(crowdFor(calls, today))).catch(() => {});
  }, []);
  if (!state) return null;
  const color = COLORS[state.level];
  return (
    <View style={[styles.card, { backgroundColor: c.tile }]}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, { height: 6 + i * 5, backgroundColor: i <= BARS[state.level] ? color : c.tile2 }]} />
        ))}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: c.ink }]}>
          {t(`crowd_${state.level}`)} · {t('crowdShips').replace('{n}', String(state.ships)).replace('{p}', state.passengers.toLocaleString())}
        </Text>
        <Text style={[type.small, { color: c.muted }]}>{t(`crowdTip_${state.level}`)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(3) },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, width: 34 },
  bar: { width: 6, borderRadius: 2 },
});
