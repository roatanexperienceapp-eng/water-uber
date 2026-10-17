import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Note } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { PORTALS } from '@/data/catalogue';
import { sendInbox, type InboxAudience, type InboxCategory } from '@/lib/inbox';
import { radius, space, type, useTheme } from '@/theme';
import type { LangCode } from '@/types';

/** Staff screen: send an Offer, Support note, Update or Priority alert to guests. Admins only (RLS). */
export default function Compose() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [category, setCategory] = useState<InboxCategory>('offer');
  const [audience, setAudience] = useState<InboxAudience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dest, setDest] = useState<string>('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const destinations = [
    { path: '', label: t('noButton'), cta: '' },
    { path: '/', label: t('tab_ride'), cta: t('ctaBookRide') },
    { path: '/pass', label: t('passTitle'), cta: t('passSeeOptions') },
    { path: '/explore', label: t('tab_explore'), cta: t('ctaExplore') },
    { path: '/assistant', label: t('ask'), cta: t('ask') },
    ...PORTALS.filter((p) => p.kind === 'book').map((p) => {
      const name = p.names[i18n.language as LangCode] ?? p.names.en;
      return { path: `/portal/${p.key}`, label: `${p.icon} ${name}`, cta: t('ctaSee').replace('{x}', name) };
    }),
  ];
  const destCta = destinations.find((d) => d.path === dest)?.cta;
  const promoInPriority = category === 'priority' && /(% ?off|discount|descuento|promo|coupon|deal|sale\b|oferta)/i.test(`${title} ${body}`);

  async function send() {
    if (!title.trim() || !body.trim() || promoInPriority) return;
    setBusy(true);
    setMsg('');
    try {
      await sendInbox({
        category,
        audience,
        title: title.trim(),
        body: body.trim(),
        ctaPath: dest || undefined,
        ctaLabel: dest ? destCta?.slice(0, 40) : undefined,
        expiresInDays: days || undefined,
      });
      setMsg(t('inboxSent'));
      setTitle('');
      setBody('');
    } catch (e) {
      setMsg(e instanceof Error && e.message === 'offers_are_not_priority' ? t('noPromoPriority') : t('inboxSendFail'));
    } finally {
      setBusy(false);
    }
  }

  const chips = <T extends string>(value: T, set: (v: T) => void, opts: { v: T; label: string }[]) => (
    <View style={styles.wrap}>
      {opts.map((o) => (
        <Pressable key={o.v} onPress={() => set(o.v)} style={[styles.chip, { backgroundColor: value === o.v ? c.ink : c.tile }]}>
          <Text style={[type.label, { fontSize: 14, color: value === o.v ? c.onInk : c.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(3), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} style={[styles.round, { backgroundColor: c.tile }]}>
            <Ionicons name="chevron-back" size={20} color={c.ink} />
          </Pressable>
          <Text style={[type.h2, { color: c.ink }]}>{t('composeH')}</Text>
        </View>
        {DEMO_MODE && <Note>{t('composeDemo')}</Note>}

        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('composeType')}</Text>
        {chips(category, setCategory, [
          { v: 'offer', label: t('inboxOffers') },
          { v: 'support', label: t('inboxSupport') },
          { v: 'update', label: t('inboxUpdates') },
          { v: 'priority', label: t('inboxPriority') },
        ])}
        {category === 'priority' && <Note>{t('priorityExplain')}</Note>}

        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('composeWho')}</Text>
        {chips(audience, setAudience, [
          { v: 'all', label: t('audAll') },
          { v: 'cruise', label: t('audCruise') },
          { v: 'stay', label: t('audStay') },
        ])}

        <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder={t('composeTitle')} placeholderTextColor={c.muted} style={[styles.input, { backgroundColor: c.tile, color: c.ink }]} />
        <TextInput value={body} onChangeText={setBody} maxLength={1000} multiline placeholder={t('composeBody')} placeholderTextColor={c.muted} style={[styles.input, styles.area, { backgroundColor: c.tile, color: c.ink }]} />

        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('composeButton')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {destinations.map((d) => (
            <Pressable key={d.path || 'none'} onPress={() => setDest(d.path)} style={[styles.chip, { backgroundColor: dest === d.path ? c.ink : c.tile }]}>
              <Text style={[type.label, { fontSize: 14, color: dest === d.path ? c.onInk : c.ink }]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('composeExpires')}</Text>
        {chips(String(days) as '1' | '3' | '7' | '0', (v) => setDays(Number(v)), [
          { v: '1', label: t('oneDay') },
          { v: '3', label: t('passDays').replace('{d}', '3') },
          { v: '7', label: t('passDays').replace('{d}', '7') },
          { v: '0', label: t('noExpiry') },
        ])}

        {title || body ? (
          <Card>
            <Text style={[type.label, { color: category === 'priority' ? c.sos : c.muted }]}>{t('preview')} · {t(`inboxCat_${category}`)}</Text>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{title}</Text>
            <Note>{body}</Note>
          </Card>
        ) : null}

        {promoInPriority && <Text style={[type.small, { color: c.sos }]}>{t('noPromoPriority')}</Text>}
        <Button label={t('composeSend')} loading={busy} disabled={!title.trim() || !body.trim() || promoInPriority} onPress={send} />
        {msg ? <Text style={[type.bodyStrong, { color: c.ink, textAlign: 'center' }]}>{msg}</Text> : null}
        <Note>{t('composeNote')}</Note>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  input: { borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16 },
  area: { minHeight: 110, textAlignVertical: 'top' },
});
