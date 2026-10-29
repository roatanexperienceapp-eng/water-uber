import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { KEY_PLACES, LAND_PLACES, type LandPlace, type PlaceKind } from '../../../supabase/functions/_shared/land.ts';
import type { Spot } from '@/lib/land';
import { normalize } from '@/lib/search';
import { radius, space, type, useTheme } from '@/theme';

const ICON: Record<PlaceKind, keyof typeof Ionicons.glyphMap> = {
  airport: 'airplane', port: 'boat', beach: 'sunny', town: 'business', park: 'leaf', health: 'medkit', shop: 'pricetag',
  community: 'home', dive: 'water', gas: 'speedometer', pharmacy: 'bandage', hotel: 'bed', restaurant: 'restaurant',
  store: 'cart', bank: 'cash', landmark: 'flag',
};

/** Filter chips: each covers one or more place kinds. */
const FILTERS: { key: string; kinds: PlaceKind[] }[] = [
  { key: 'all', kinds: [] },
  { key: 'hotel', kinds: ['hotel'] },
  { key: 'restaurant', kinds: ['restaurant'] },
  { key: 'dive', kinds: ['dive'] },
  { key: 'store', kinds: ['store', 'shop'] },
  { key: 'pharmacy', kinds: ['pharmacy', 'health'] },
  { key: 'gas', kinds: ['gas'] },
  { key: 'park', kinds: ['park', 'beach'] },
  { key: 'community', kinds: ['community', 'town', 'airport', 'port'] },
];

const KEY_IDS = new Set(KEY_PLACES.map((p) => p.id));
const MAX_ROWS = 400;

/** Pick a pickup or drop-off: key places first, then every place on the island by community, with filters. */
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
  const [filter, setFilter] = useState('all');
  const nq = normalize(q);
  const sections = useMemo(() => {
    const kinds = FILTERS.find((f) => f.key === filter)?.kinds ?? [];
    const match = (x: LandPlace) => (!kinds.length || kinds.includes(x.kind)) && (!nq || normalize(`${x.name} ${x.area}`).includes(nq));
    const list = LAND_PLACES.filter(match).slice(0, MAX_ROWS);
    const popular = list.filter((x) => KEY_IDS.has(x.id));
    const byArea = new Map<string, LandPlace[]>();
    for (const x of list) {
      if (KEY_IDS.has(x.id)) continue;
      byArea.set(x.area, [...(byArea.get(x.area) ?? []), x]);
    }
    const rest = [...byArea.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([title, data]) => ({ title, data: data.sort((a, b) => a.name.localeCompare(b.name)) }));
    return [...(popular.length ? [{ title: t('landPopular'), data: popular }] : []), ...rest];
  }, [nq, filter, t]);

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={styles.scrim} onPress={p.onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.bg }]} onPress={() => {}}>
          <Text style={[type.h2, { color: c.ink }]}>{p.title}</Text>
          <View style={[styles.search, { backgroundColor: c.tile }]}>
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('landSearch')} placeholderTextColor={c.muted} style={[type.body, { flex: 1, color: c.ink }]} autoCorrect={false} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }} style={{ flexGrow: 0 }}>
            {FILTERS.map((f) => {
              const on = f.key === filter;
              return (
                <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(f.key)} style={[styles.chip, { backgroundColor: on ? c.ink : c.tile }]}>
                  <Text style={[type.label, { color: on ? c.onInk : c.ink }]}>{t(`placeF_${f.key}`)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {p.onMyLocation && !nq && filter === 'all' ? (
            <Pressable accessibilityRole="button" onPress={p.onMyLocation} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: c.ink }]}>
                <Ionicons name="navigate" size={16} color={c.onInk} />
              </View>
              <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('landMyLocation')}</Text>
            </Pressable>
          ) : null}
          <SectionList
            style={{ maxHeight: 440 }}
            sections={sections}
            keyExtractor={(x) => x.id}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled={false}
            initialNumToRender={30}
            renderSectionHeader={({ section }) => <Text style={[type.label, { color: c.muted, paddingTop: space(3), paddingBottom: 4 }]}>{section.title}</Text>}
            renderItem={({ item: x }) => (
              <Pressable accessibilityRole="button" onPress={() => p.onPick({ lat: x.lat, lon: x.lon, label: x.name, placeId: x.id })} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.tile }]}>
                  <Ionicons name={ICON[x.kind] ?? 'location'} size={16} color={c.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.ink }]} numberOfLines={1}>{x.name}</Text>
                  <Text style={[type.small, { color: c.muted }]}>{t(`placeK_${x.kind}`)} · {x.area}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[type.small, { color: c.muted, padding: space(3) }]}>{t('landNoPlace')}</Text>}
          />
          <Text style={[type.small, { color: c.muted, fontSize: 11 }]}>{t('osmCredit')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(8), gap: space(3) },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: 10 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 10, paddingHorizontal: 4 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
