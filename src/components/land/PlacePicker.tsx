import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LAND_PLACES, type PlaceKind } from '../../../supabase/functions/_shared/land.ts';
import type { Spot } from '@/lib/land';
import { normalize } from '@/lib/search';
import { radius, space, type, useTheme } from '@/theme';

const ICON: Record<PlaceKind, keyof typeof Ionicons.glyphMap> = {
  airport: 'airplane', port: 'boat', beach: 'sunny', town: 'location', park: 'leaf', health: 'medkit', shop: 'bag',
};

/** Pick a place on the island, or "My location". */
export function PlacePicker(p: {
  visible: boolean;
  title: string;
  onPick: (s: Spot) => void;
  onMyLocation?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const [q, setQ] = useState('');
  const nq = normalize(q);
  const list = LAND_PLACES.filter((x) => !nq || normalize(`${x.name} ${x.area}`).includes(nq));
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={styles.scrim} onPress={p.onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.bg }]} onPress={() => {}}>
          <Text style={[type.h2, { color: c.ink }]}>{p.title}</Text>
          <View style={[styles.search, { backgroundColor: c.tile }]}>
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('landSearch')} placeholderTextColor={c.muted} style={[type.body, { flex: 1, color: c.ink }]} autoCorrect={false} />
          </View>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            {p.onMyLocation && !nq ? (
              <Pressable accessibilityRole="button" onPress={p.onMyLocation} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.ink }]}>
                  <Ionicons name="navigate" size={16} color={c.onInk} />
                </View>
                <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('landMyLocation')}</Text>
              </Pressable>
            ) : null}
            {list.map((x) => (
              <Pressable key={x.id} accessibilityRole="button" onPress={() => p.onPick({ lat: x.lat, lon: x.lon, label: x.name, placeId: x.id })} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.tile }]}>
                  <Ionicons name={ICON[x.kind]} size={16} color={c.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>{x.name}</Text>
                  <Text style={[type.small, { color: c.muted }]}>{x.area}</Text>
                </View>
              </Pressable>
            ))}
            {list.length === 0 && <Text style={[type.small, { color: c.muted, padding: space(3) }]}>{t('landNoPlace')}</Text>}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(10), gap: space(3) },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 12, paddingHorizontal: 4 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
