import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Note } from '@/components/ui';
import { listInbox, markRead, safeInboxPath, type InboxCategory, type InboxMessage } from '@/lib/inbox';
import { radius, space, type, useTheme } from '@/theme';

type Filter = 'all' | InboxCategory;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'inboxAll' },
  { key: 'offer', label: 'inboxOffers' },
  { key: 'support', label: 'inboxSupport' },
  { key: 'update', label: 'inboxUpdates' },
  { key: 'priority', label: 'inboxPriority' },
];
const ICON: Record<InboxCategory, keyof typeof Ionicons.glyphMap> = {
  offer: 'pricetag',
  support: 'chatbubble-ellipses',
  update: 'information-circle',
  priority: 'alert-circle',
};

// Our own wording on purpose: iPhones (Hermes engine) have no Intl.RelativeTimeFormat, and
// calling it crashed this screen in Expo Go. Same text on every phone and in every language.
const AGO: Record<string, [now: string, min: string, hour: string, day: string]> = {
  en: ['just now', '{n} min ago', '{n} h ago', '{n} d ago'],
  es: ['ahora', 'hace {n} min', 'hace {n} h', 'hace {n} d'],
  fr: ["à l'instant", 'il y a {n} min', 'il y a {n} h', 'il y a {n} j'],
  de: ['gerade eben', 'vor {n} Min.', 'vor {n} Std.', 'vor {n} T.'],
  pt: ['agora', 'há {n} min', 'há {n} h', 'há {n} d'],
  it: ['ora', '{n} min fa', '{n} h fa', '{n} g fa'],
  zh: ['刚刚', '{n}分钟前', '{n}小时前', '{n}天前'],
};

function ago(iso: string, lang: string, now = Date.now()): string {
  const w = AGO[lang] ?? AGO.en;
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return w[0];
  if (m < 60) return w[1].replace('{n}', String(m));
  if (m < 48 * 60) return w[2].replace('{n}', String(Math.round(m / 60)));
  return w[3].replace('{n}', String(Math.round(m / 1440)));
}

export default function Inbox() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<InboxMessage[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await listInbox(i18n.language).catch(() => []));
    setLoading(false);
  }, [i18n.language]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Priority first (unread), then newest.
  const shown = items
    .filter((m) => filter === 'all' || m.category === filter)
    .sort((a, b) => Number(b.category === 'priority' && !b.read) - Number(a.category === 'priority' && !a.read) || b.createdAt.localeCompare(a.createdAt));
  const unreadBy = (k: Filter) => items.filter((m) => !m.read && (k === 'all' || m.category === k)).length;

  async function tap(m: InboxMessage) {
    setOpen(open === m.id ? null : m.id);
    if (!m.read) {
      setItems((xs) => xs.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
      await markRead([m.id]).catch(() => {});
    }
  }

  async function readAll() {
    const ids = shown.filter((m) => !m.read).map((m) => m.id);
    setItems((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, read: true } : x)));
    await markRead(ids).catch(() => {});
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(12) }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.ink }]}>{t('inboxH')}</Text>
          {unreadBy(filter) > 0 && (
            <Pressable accessibilityRole="button" onPress={readAll} hitSlop={8}>
              <Text style={[type.label, { color: c.muted, fontSize: 14 }]}>{t('markAllRead')}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const n = unreadBy(f.key);
            return (
              <Pressable
                key={f.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, { backgroundColor: on ? c.ink : c.tile }]}
              >
                <Text style={[styles.chipText, { color: on ? c.onInk : c.ink }]}>{t(f.label)}</Text>
                {n > 0 && <View style={[styles.chipDot, { backgroundColor: f.key === 'priority' ? c.sos : c.flame }]} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {filter === 'priority' && <Text style={[type.small, { color: c.muted, paddingHorizontal: space(5), marginBottom: space(2) }]}>{t('priorityExplain')}</Text>}

        {shown.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={filter === 'all' ? 'mail-open-outline' : ICON[filter]} size={34} color={c.muted} />
            <Text style={[type.bodyStrong, { color: c.ink }]}>{t('inboxEmpty')}</Text>
            <Note center>{t(`inboxEmpty_${filter}`)}</Note>
          </View>
        ) : (
          shown.map((m) => {
            const expanded = open === m.id;
            const path = safeInboxPath(m.ctaPath);
            const pri = m.category === 'priority';
            return (
              <Pressable key={m.id} accessibilityRole="button" onPress={() => tap(m)} style={[styles.item, { borderBottomColor: c.line }, pri && !m.read && { backgroundColor: '#FDECEA' }]}>
                <View style={[styles.icon, { backgroundColor: pri ? c.sos : m.category === 'offer' ? c.flame : c.tile }]}>
                  <Ionicons name={ICON[m.category]} size={20} color={pri || m.category === 'offer' ? '#fff' : c.ink} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.row}>
                    <Text style={[type.label, { color: pri ? c.sos : c.muted }]}>
                      {t(`inboxCat_${m.category}`)}
                      {m.personal ? ` · ${t('forYou')}` : ''}
                    </Text>
                    <Text style={[type.label, { color: c.muted }]}>{ago(m.createdAt, i18n.language)}</Text>
                  </View>
                  <Text style={[type.bodyStrong, { color: pri && !m.read ? '#1a1a1a' : c.ink, fontWeight: m.read ? '600' : '800' }]}>{m.title}</Text>
                  <Text style={[type.small, { color: pri && !m.read ? '#3f2a27' : c.muted }]} numberOfLines={expanded ? undefined : 2}>
                    {m.body}
                  </Text>
                  {path && m.ctaLabel && (
                    <Pressable accessibilityRole="button" onPress={() => router.push(path as never)} style={[styles.cta, { backgroundColor: pri ? c.sos : c.ink }]}>
                      <Text style={[type.label, { color: '#fff', fontSize: 14 }]}>{m.ctaLabel}</Text>
                    </Pressable>
                  )}
                </View>
                {!m.read && <View style={[styles.unread, { backgroundColor: pri ? c.sos : c.flame }]} />}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: space(5), paddingTop: space(4), paddingBottom: space(4) },
  title: { fontSize: 40, fontWeight: '800', letterSpacing: -1.4 },
  chips: { gap: space(2), paddingHorizontal: space(4), paddingBottom: space(4) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 11 },
  chipText: { fontSize: 17, fontWeight: '600' },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  empty: { alignItems: 'center', gap: space(2), paddingTop: space(16), paddingHorizontal: space(8) },
  item: { flexDirection: 'row', gap: space(3), paddingHorizontal: space(5), paddingVertical: space(4), borderBottomWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cta: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, marginTop: space(1) },
  unread: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
});
