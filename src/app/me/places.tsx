import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DOCKS } from '../../../supabase/functions/_shared/geo.ts';
import { SubScreen } from '@/components/AccountKit';
import { Button, Note } from '@/components/ui';
import { deletePlace, savedPlaces, type SavedPlace } from '@/lib/stay';
import { PLACE_ICONS } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

export default function PlacesScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const load = useCallback(() => {
    savedPlaces().then(setPlaces).catch(() => {});
  }, []);
  useFocusEffect(load);
  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;

  return (
    <SubScreen title={t('savedPlacesH')}>
      {places.length === 0 ? (
        <>
          <Note>{t('noPlaces')}</Note>
          <Button label={t('addPlaceOnRide')} onPress={() => router.navigate('/')} />
        </>
      ) : (
        places.map((p) => (
          <View key={p.id} style={[styles.row, { borderBottomColor: c.line }]}>
            <Ionicons name={PLACE_ICONS[p.icon]} size={22} color={c.flame} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{p.label}</Text>
              <Note>{dockName(p.dockId)}</Note>
            </View>
            <Pressable accessibilityRole="button" onPress={() => deletePlace(p.id).then(load)} style={[styles.small, { backgroundColor: c.tile }]}>
              <Text style={[type.label, { color: c.ink }]}>{t('delete')}</Text>
            </Pressable>
          </View>
        ))
      )}
      {places.length > 0 && <Note>{t('placesTip')}</Note>}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderBottomWidth: 1 },
  small: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
});
