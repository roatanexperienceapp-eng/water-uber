import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FEATURE_SETTINGS, passBreakEvenRides, passFor, passSizeFor } from '../../supabase/functions/_shared/features.ts';
import { BUNDLE_SETTINGS } from '../../supabase/functions/_shared/bundle.ts';
import { Button, Card, Note } from '@/components/ui';
import { packageTourOptions, quotePackage, type PickedTour } from '@/lib/bundles';
import { islandClock, islandDay, roatanDate, roatanInstant } from '@/lib/cruise';
import { usd } from '@/lib/format';
import { passName } from '@/lib/passName';
import { currentPass, type GuestPass } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { useNow } from '@/lib/useNow';
import { radius, space, type, useTheme } from '@/theme';

const TOUR_TIMES = ['08:00', '09:00', '10:00', '13:00', '14:00'];
type Kind = 'snorkel' | 'fishing';

/**
 * Ride passes: choose how many people (any number 2–12) and 1 or 2 weeks; price = $35 per person per week.
 * Add your own snorkel / fishing tour to make it a package and save (BUNDLE_SETTINGS).
 */
export default function PassScreen() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const now = useNow();
  const { minGroup, maxGroup, perPersonPerWeek } = FEATURE_SETTINGS.passPricing;
  const [active, setActive] = useState<GuestPass | null>(null);
  const [size, setSize] = useState<number>(passSizeFor(Number(group) || minGroup));
  const [days, setDays] = useState<7 | 14>(7);
  // Package: at most one tour per kind, each with its own day and time.
  const [picked, setPicked] = useState<Record<Kind, PickedTour | null>>({ snorkel: null, fishing: null });
  useFocusEffect(
    useCallback(() => {
      currentPass().then(setActive).catch(() => {});
    }, []),
  );

  const pass = passFor(size, days)!;
  const today = roatanDate(now);
  const passDays = Array.from({ length: days }, (_, i) => roatanDate(new Date(now.getTime() + i * 86_400_000)));
  const timesFor = (date: string) => TOUR_TIMES.filter((x) => roatanInstant(date, x).getTime() > now.getTime() + 60 * 60_000);
  const firstDay = passDays.find((d) => timesFor(d).length > 0) ?? passDays[1];
  // A tour must fall inside the pass: drop days that are no longer in range (e.g. switching 2 weeks → 1 week).
  const inRange = (p: PickedTour | null) => (p && passDays.includes(p.date) ? p : null);
  const snorkel = inRange(picked.snorkel);
  const fishing = inRange(picked.fishing);
  const tours = [snorkel, fishing].filter(Boolean) as PickedTour[];
  const quote = tours.length ? quotePackage(pass.id, tours) : null;
  const options = packageTourOptions();

  function toggleTour(kind: Kind, listingId: string) {
    setPicked((p) => {
      const cur = p[kind];
      if (cur?.listingId === listingId) return { ...p, [kind]: null };
      return { ...p, [kind]: { listingId, date: cur?.date ?? firstDay, time: cur?.time ?? timesFor(firstDay)[0] ?? '09:00' } };
    });
  }
  const setWhen = (kind: Kind, patch: Partial<PickedTour>) =>
    setPicked((p) => {
      const cur = p[kind];
      if (!cur) return p;
      const next = { ...cur, ...patch };
      const ok = timesFor(next.date);
      if (!ok.includes(next.time)) next.time = ok[0] ?? next.time;
      return { ...p, [kind]: next };
    });

  function buy() {
    if (quote) router.push({ pathname: '/checkout', params: { kind: 'bundle', passId: pass.id, tours: JSON.stringify(tours) } });
    else router.push({ pathname: '/checkout', params: { kind: 'pass', passId: pass.id } });
  }

  const current = { snorkel, fishing };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.round, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[type.h1, { color: c.ink }]}>{t('passTitle')}</Text>
        <Note>{t('passIntro')}</Note>

        {active && (
          <Card style={{ backgroundColor: c.ink }}>
            <Text style={[type.label, { color: c.flame }]}>{t('passActive')}</Text>
            <Text style={[type.h2, { color: c.onInk }]}>{passName(t, active.passId)}</Text>
            <Text style={[type.small, { color: c.onInk, opacity: 0.8 }]}>
              {t('passExpires').replace('{d}', shortDate(active.expiresAt, i18n.language))} · {t('passUnlimited')}
            </Text>
          </Card>
        )}

        {/* How many people: any number from 2 to 12 */}
        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('passHowMany')}</Text>
        <View style={[styles.stepper, { backgroundColor: c.tile }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('fewerPeople')} disabled={size <= minGroup} onPress={() => setSize((n) => Math.max(minGroup, n - 1))} style={[styles.stepBtn, { backgroundColor: c.bg, opacity: size <= minGroup ? 0.35 : 1 }]}>
            <Ionicons name="remove" size={28} color={c.ink} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }} accessibilityLiveRegion="polite">
            <Text style={[styles.bigNum, { color: c.ink }]}>{size}</Text>
            <Text style={[type.label, { color: c.muted }]}>{t('peopleShort')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('morePeople')} disabled={size >= maxGroup} onPress={() => setSize((n) => Math.min(maxGroup, n + 1))} style={[styles.stepBtn, { backgroundColor: c.bg, opacity: size >= maxGroup ? 0.35 : 1 }]}>
            <Ionicons name="add" size={28} color={c.ink} />
          </Pressable>
        </View>
        <Note center>
          {t('passPerPerson').replace('{p}', usd(perPersonPerWeek))} · {t('passGroupRange').replace('{min}', String(minGroup)).replace('{max}', String(maxGroup))}
        </Note>

        {/* How long */}
        <View style={styles.lengths}>
          {([7, 14] as const).map((d) => {
            const on = d === days;
            const opt = passFor(size, d)!;
            return (
              <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setDays(d)} style={[styles.length, { borderColor: on ? c.flame : c.line }]}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{d === 7 ? t('oneWeek') : t('twoWeeks')}</Text>
                <Text style={[type.h1, { color: c.ink }]}>{usd(opt.priceUsd)}</Text>
                <Text style={[type.small, { color: c.muted }]}>{t('passTotalFor').replace('{n}', String(size))}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <Text style={[type.h2, { color: c.ink }]}>{passName(t, pass.id)}</Text>
          <Note>✓ {t('passUnlimitedGroup').replace('{n}', String(pass.riders))}</Note>
          <Note>✓ {t('passBreakEven').replace('{n}', String(passBreakEvenRides(pass.id)))}</Note>
          <Note>✓ {t('passExtraRule')}</Note>
          <Note>{t('passOnlyZone')}</Note>
        </Card>

        {/* Package builder */}
        <View style={[styles.pkgHead, { backgroundColor: c.flame }]}>
          <Ionicons name="gift" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: '#fff' }]}>{t('pkgH')}</Text>
            <Text style={[type.small, { color: '#fff' }]}>
              {t('pkgSave').replace('{a}', String(BUNDLE_SETTINGS.discountPctByTours[1])).replace('{b}', String(BUNDLE_SETTINGS.discountPctByTours[2]))}
            </Text>
          </View>
        </View>

        {(['snorkel', 'fishing'] as const).map((kind) => {
          const sel = current[kind];
          return (
            <View key={kind} style={{ gap: space(2) }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{kind === 'snorkel' ? `🤿 ${t('pkgSnorkel')}` : `🎣 ${t('pkgFishing')}`}</Text>
              {options
                .filter((o) => o.kind === kind)
                .map((o) => {
                  const on = sel?.listingId === o.listingId;
                  const disabled = o.priceUsd == null;
                  return (
                    <Pressable
                      key={o.listingId}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled }}
                      disabled={disabled}
                      onPress={() => toggleTour(kind, o.listingId)}
                      style={[styles.tour, { borderColor: on ? c.ink : c.line, opacity: disabled ? 0.5 : 1 }]}
                    >
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? c.flame : c.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: c.ink }]}>{o.name}</Text>
                        <Note>
                          {o.priceUsd == null
                            ? t('pkgComingSoon')
                            : o.unit === 'person'
                              ? `${usd(o.priceUsd)} × ${size} = ${usd(o.priceUsd * size)}`
                              : `${usd(o.priceUsd)} ${t('perBoat')}`}
                        </Note>
                      </View>
                    </Pressable>
                  );
                })}
              {sel && (
                <View style={{ gap: space(2) }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
                    {passDays.map((d) => {
                      const on = sel.date === d;
                      const disabled = timesFor(d).length === 0;
                      return (
                        <Pressable key={d} disabled={disabled} onPress={() => setWhen(kind, { date: d })} style={[styles.pill, { backgroundColor: on ? c.ink : c.tile, opacity: disabled ? 0.4 : 1 }]}>
                          <Text style={[type.label, { fontSize: 13, color: on ? c.onInk : c.ink }]}>{d === today ? t('today') : islandDay(roatanInstant(d, '12:00'), i18n.language)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.wrap}>
                    {timesFor(sel.date).map((x) => {
                      const on = sel.time === x;
                      return (
                        <Pressable key={x} onPress={() => setWhen(kind, { time: x })} style={[styles.pill, { backgroundColor: on ? c.ink : c.tile }]}>
                          <Text style={[type.label, { fontSize: 13, color: on ? c.onInk : c.ink }]}>{islandClock(roatanInstant(sel.date, x), i18n.language)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Total */}
        <Card>
          <View style={styles.line}>
            <Text style={[type.body, { color: c.ink, flex: 1 }]}>{passName(t, pass.id)}</Text>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{usd(pass.priceUsd)}</Text>
          </View>
          {tours.map((tr) => {
            const o = options.find((x) => x.listingId === tr.listingId)!;
            return (
              <View key={tr.listingId} style={styles.line}>
                <Text style={[type.body, { color: c.ink, flex: 1 }]} numberOfLines={1}>
                  {o.name} · {islandDay(roatanInstant(tr.date, tr.time), i18n.language)}
                </Text>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{usd(o.unit === 'person' ? o.priceUsd! * size : o.priceUsd!)}</Text>
              </View>
            );
          })}
          {quote && (
            <View style={styles.line}>
              <Text style={[type.bodyStrong, { color: '#16A34A' }]}>{t('pkgDiscount').replace('{p}', String(quote.discountPct))}</Text>
              <Text style={[type.bodyStrong, { color: '#16A34A' }]}>−{usd(quote.discountCents / 100)}</Text>
            </View>
          )}
          <View style={[styles.line, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: space(2) }]}>
            <Text style={[type.h2, { color: c.ink }]}>{t('total')}</Text>
            <Text style={[type.h2, { color: c.ink }]}>{usd(quote ? quote.totalCents / 100 : pass.priceUsd)}</Text>
          </View>
        </Card>

        <Button label={quote ? t('pkgBuy') : t('buyPass')} trailing={usd(quote ? quote.totalCents / 100 : pass.priceUsd)} onPress={buy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: space(3) },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bigNum: { fontSize: 48, fontWeight: '800', letterSpacing: -1.5, lineHeight: 54 },
  lengths: { flexDirection: 'row', gap: space(3) },
  length: { flex: 1, borderWidth: 2, borderRadius: radius.lg, padding: space(4), gap: 2 },
  pkgHead: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.lg, padding: space(4), marginTop: space(2) },
  tour: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderWidth: 2, borderRadius: radius.md, padding: space(3) },
  pill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2) },
});
