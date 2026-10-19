import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { safetyFor } from '../../supabase/functions/_shared/marine.ts';
import { Note } from '@/components/ui';
import { MARINE_GUIDE, type GuideGroup, type GuideSpecies } from '@/data/marineGuide';
import { normalize } from '@/lib/search';
import { radius, space, type, useTheme } from '@/theme';

const GROUPS: GuideGroup[] = ['fish', 'turtle', 'ray', 'shark', 'eel', 'invertebrate', 'mammal', 'coral'];
const STATUS_COLOR: Record<string, [string, string]> = {
  cr: ['#FDECEA', '#B42318'], en: ['#FFF1E6', '#B54708'], sanctuary: ['#E6F4FF', '#175CD3'], protected: ['#E6F4FF', '#175CD3'], invasive: ['#F2F4F7', '#344054'],
};

/** Roatán reef species guide: search, filter by group, tap for a fact, habitat and safety notes. */
export function MarineGuide({ onSaw }: { onSaw: (name: string) => void }) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<GuideGroup | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const nq = normalize(q);
  const list = MARINE_GUIDE.filter((s) => (!group || s.group === group) && (!nq || normalize(`${s.names.en} ${s.names.es} ${s.sci}`).includes(nq)));

  return (
    <View style={{ gap: space(3) }}>
      <Note>{t('guideSub').replace('{n}', String(MARINE_GUIDE.length))}</Note>
      <View style={[styles.search, { backgroundColor: c.tile }]}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('guideSearch')} placeholderTextColor={c.muted} style={[type.body, { flex: 1, color: c.ink }]} accessibilityLabel={t('guideSearch')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label={t('gAll')} on={!group} onPress={() => setGroup(null)} />
        {GROUPS.map((g) => (
          <Chip key={g} label={t(`g_${g}`)} on={group === g} onPress={() => setGroup(group === g ? null : g)} />
        ))}
      </ScrollView>

      <View style={{ gap: space(2) }}>
        {list.map((s) => (
          <Row key={s.id} s={s} lang={i18n.language} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onSaw={() => onSaw(s.names.en)} />
        ))}
        {!list.length && <Note center>{t('noResults')}</Note>}
      </View>
      <Note>🌊 {t('guideNote')}</Note>
    </View>
  );
}

function Row({ s, lang, open, onToggle, onSaw }: { s: GuideSpecies; lang: string; open: boolean; onToggle: () => void; onSaw: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const safety = safetyFor(s.names.en, s.sci);
  const badge = STATUS_COLOR[s.status];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={[styles.row, { backgroundColor: c.tile }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: c.bg }]}>
          <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]}>{lang === 'es' ? s.names.es : s.names.en}</Text>
          <Text style={[type.small, { color: c.muted, fontSize: 12 }]} numberOfLines={1}>
            {lang === 'es' ? s.names.en : s.names.es} · <Text style={{ fontStyle: 'italic' }}>{s.sci}</Text>
          </Text>
        </View>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge[0] }]}>
            <Text style={[type.label, { fontSize: 11, color: badge[1] }]}>{t(`st_${s.status}`)}</Text>
          </View>
        )}
      </View>
      {open && (
        <View style={{ gap: space(2) }}>
          <Text style={[type.small, { color: c.ink }]}>{s.fact[lang as keyof GuideSpecies['fact']] ?? s.fact.en}</Text>
          <View style={styles.tags}>
            <View style={[styles.tag, { backgroundColor: c.bg }]}>
              <Text style={[type.label, { fontSize: 12, color: c.ink }]}>📍 {t(`hab_${s.habitat}`)}</Text>
            </View>
          </View>
          {safety.map((n) => (
            <View key={n} style={styles.safety}>
              <Ionicons name="warning" size={15} color="#B42318" />
              <Text style={[type.small, { color: '#7A271A', flex: 1, fontSize: 13 }]}>{t(`safety_${n}`)}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={onSaw} style={[styles.saw, { backgroundColor: c.ink }]}>
            <Text style={[type.label, { color: c.onInk, fontSize: 13 }]}>👀 {t('guideSaw')}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, { backgroundColor: on ? c.ink : c.tile }]}>
      <Text style={[type.label, { fontSize: 13, color: on ? c.onInk : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: 9 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  row: { borderRadius: radius.lg, padding: space(3), gap: space(2) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 120 },
  tags: { flexDirection: 'row', gap: 6 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDECEA', borderRadius: radius.sm, padding: 8 },
  saw: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
});
