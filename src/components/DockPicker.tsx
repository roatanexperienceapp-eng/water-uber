import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DOCKS, FLAT_ZONE, type DockArea } from '../../supabase/functions/_shared/geo.ts';
import { normalize } from '@/lib/search';
import { radius, space, type, useTheme } from '@/theme';

const AREA_ORDER: DockArea[] = ['West End', 'West Bay', 'Sandy Bay', 'Coxen Hole', 'French Harbour', 'East End'];
const AREA_KEY: Record<DockArea, string> = {
  'West End': 'area_westEnd', 'West Bay': 'area_westBay', 'Sandy Bay': 'area_sandyBay',
  'Coxen Hole': 'area_coxen', 'French Harbour': 'area_french', 'East End': 'area_eastEnd',
};

/**
 * Pier picker: grouped by area, scrollable, with a filter box (27 piers).
 * `only` limits the list (e.g. the flat-fare zone for the taxi add-on).
 */
export function DockPicker(p: { visible: boolean; selected?: string; only?: readonly string[]; onPick: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [q, setQ] = useState('');
  const nq = normalize(q);
  const docks = DOCKS.filter((d) => (!p.only || p.only.includes(d.id)) && (!nq || normalize(d.name).includes(nq)));

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={styles.scrim} onPress={p.onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.bg }]} onPress={() => {}}>
          <Text style={[type.h2, { color: c.ink }]}>{t('pickDock')}</Text>
          <View style={[styles.search, { backgroundColor: c.tile }]}>
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('searchDock')} placeholderTextColor={c.muted} style={[type.body, { flex: 1, color: c.ink }]} autoCorrect={false} />
          </View>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            {AREA_ORDER.map((area) => {
              const list = docks.filter((d) => d.area === area);
              if (!list.length) return null;
              return (
                <View key={area} style={{ marginBottom: space(2) }}>
                  <View style={styles.head}>
                    <Text style={[type.label, { color: c.muted }]}>{t(AREA_KEY[area])}</Text>
                    <Text style={[type.label, { color: FLAT_ZONE.includes(list[0].id) ? '#16A34A' : c.muted, fontSize: 12 }]}>
                      {FLAT_ZONE.includes(list[0].id) ? t('flatZoneTag') : t('perMileTag')}
                    </Text>
                  </View>
                  {list.map((d) => {
                    const on = d.id === p.selected;
                    return (
                      <Pressable key={d.id} accessibilityRole="button" onPress={() => { setQ(''); p.onPick(d.id); }} style={[styles.item, on && { backgroundColor: c.tile }]}>
                        <Ionicons name="boat-outline" size={18} color={c.ink} />
                        <Text style={[type.body, { color: c.ink, flex: 1, fontWeight: on ? '700' : '500' }]}>{d.name}</Text>
                        {on && <Ionicons name="checkmark" size={18} color={c.flame} />}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
            {!docks.length && <Text style={[type.body, { color: c.muted, padding: space(3) }]}>{t('noResults')}</Text>}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(8), gap: space(3) },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.sm },
});
