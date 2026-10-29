import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onIsland, roadKm, driveMinutes } from '../../supabase/functions/_shared/land.ts';
import { Button, Note } from '@/components/ui';
import { ISLAND_PLACES } from '@/data/islandPlaces';
import { setPendingDropoff, setService } from '@/lib/service';
import { radius, space, type, useTheme } from '@/theme';

const GAS_STATIONS = ISLAND_PLACES.filter((p) => p.kind === 'gas');

/** Gas stations on the island, nearest first, with directions or a land taxi there. */
export default function GasStations() {
  const { t } = useTranslation();
  const c = useTheme();
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const pt = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (onIsland(pt)) setHere(pt);
      } catch {
        // list by community instead
      }
    })();
  }, []);

  const list = useMemo(() => {
    const rows = GAS_STATIONS.map((g) => ({ ...g, km: here ? roadKm(here, g) : null }));
    return rows.sort((a, b) => (a.km != null && b.km != null ? a.km - b.km : a.community.localeCompare(b.community) || a.name.localeCompare(b.name)));
  }, [here]);

  function taxiHere(g: (typeof GAS_STATIONS)[number]) {
    setPendingDropoff({ lat: g.lat, lon: g.lon, label: g.name, placeId: g.id });
    setService('land');
    router.replace('/');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(3) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} style={[styles.back, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[type.h1, { color: c.ink }]}>⛽ {t('gasH')}</Text>
        <Note>{here ? t('gasNearest') : t('gasByArea')}</Note>
        {list.length === 0 && <Note>{t('gasNone')}</Note>}
        {list.map((g) => (
          <View key={g.id} style={[styles.card, { backgroundColor: c.tile }]}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: c.flame }]}>
                <Ionicons name="speedometer" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{g.name}</Text>
                <Text style={[type.small, { color: c.muted }]}>
                  {g.community}
                  {g.km != null ? ` · ${g.km.toFixed(1)} km · ~${driveMinutes(g.km)} min` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Button small variant="ink" label={t('drvNavigate')} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}&travelmode=driving`)} style={{ flex: 1 }} />
              <Button small label={t('gasTaxi')} onPress={() => taxiHere(g)} style={{ flex: 1 }} />
            </View>
          </View>
        ))}
        <Text style={[type.small, { color: c.muted, fontSize: 11 }]}>{t('osmCredit')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, padding: space(3), gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
