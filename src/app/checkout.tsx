import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS } from '../../supabase/functions/_shared/geo.ts';
import { PRICING, quoteFare, type RideMode, type RideTiming } from '../../supabase/functions/_shared/pricing.ts';
import {
  ACTIVITY_HOURS, dockForArea, FEATURE_SETTINGS, nightMode, passBreakEvenRides, passCovers, passDefinition, pickupForActivity,
  type PassId,
} from '../../supabase/functions/_shared/features.ts';
import { Button, Card, Note, Stepper } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { LISTINGS } from '@/data/catalogue';
import { createBooking, createRide, startPayment } from '@/lib/api';
import { clock, usd } from '@/lib/format';
import { pay } from '@/lib/payments';
import { buyPass, createRepeatRide, currentPass, savedPlaces, type GuestPass } from '@/lib/stay';
import { hhmm, hourLabel, shortDate, ymd } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

type Params = {
  kind: 'ride' | 'listing' | 'pass';
  // ride
  from?: string;
  to?: string;
  riders?: string;
  mode?: RideMode;
  timing?: RideTiming;
  scheduledFor?: string;
  kids?: string;
  towels?: string;
  repeat?: string;
  weekdays?: string;
  repeatFor?: string;
  joinMin?: string;
  // listing
  id?: string;
  // pass
  passId?: PassId;
};

const ACTIVITY_TIMES = ['08:00', '09:00', '10:00', '13:00', '14:00', '18:00'];
const FLAT_DOCKS = ['we', 'inf', 'hmb', 'ban', 'fos'];

export default function Checkout() {
  const p = useLocalSearchParams<Params>();
  const { t } = useTranslation();
  const c = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={back} style={[styles.round, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[type.h2, { color: c.ink }]}>{t('checkoutH')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }}>
        {p.kind === 'ride' && <RideCheckout p={p} busy={busy} setBusy={setBusy} setErr={setErr} />}
        {p.kind === 'listing' && <ListingCheckout id={p.id ?? ''} busy={busy} setBusy={setBusy} setErr={setErr} />}
        {p.kind === 'pass' && <PassCheckout passId={p.passId ?? 'week'} busy={busy} setBusy={setBusy} setErr={setErr} />}
        {err ? <Text style={[type.small, { color: c.sos, textAlign: 'center' }]}>{err}</Text> : null}
        <Note center>{DEMO_MODE ? t('demoPay') : t('lock')}</Note>
      </ScrollView>
    </SafeAreaView>
  );
}

type Flow = { busy: boolean; setBusy: (b: boolean) => void; setErr: (s: string) => void };

/** Runs the processor sheet for something the server already priced. */
async function payFor(target: { rideId: string } | { bookingId: string } | { passId: string }, description: string) {
  const { paymentId, amountUsd } = await startPayment(target);
  if (amountUsd <= 0) return;
  const res = await pay({ amountUsd, description, referenceId: paymentId });
  if (!res.ok) throw new Error(res.error ?? 'payment_failed');
}

function errorText(t: (k: string) => string, e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  if (code === 'boats_closed') return t('closedH');
  if (code === 'payments_not_configured') return t('payNotReady');
  return t('cardErr');
}

// ---------------------------------------------------------------------------------------------
function RideCheckout({ p, busy, setBusy, setErr }: { p: Params } & Flow) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const from = p.from ?? 'inf';
  const to = p.to ?? 'we';
  const riders = Number(p.riders ?? 1);
  const timing = (p.timing ?? 'now') as RideTiming;
  const mode = (p.mode ?? 'shared') as RideMode;
  const at = p.scheduledFor ? new Date(p.scheduledFor) : new Date();
  const quote = quoteFare({ from, to, riders, mode, timing });
  const [pass, setPass] = useState<GuestPass | null>(null);
  useEffect(() => {
    currentPass().then(setPass).catch(() => {});
  }, []);
  const cover = passCovers(pass, { from, to, riders, at });
  const covered = cover.covered;
  const night = nightMode(at);
  const total = covered ? cover.fareUsd : quote.total + (night === 'night' ? FEATURE_SETTINGS.night.surchargePerRider * riders : 0);
  const free = covered && total === 0;
  const repeat = p.repeat === '1';
  const weekdays = (p.weekdays ?? '').split(',').filter(Boolean).map(Number);
  const dockName = (id: string) => DOCKS.find((d) => d.id === id)?.name ?? id;

  async function confirm() {
    setBusy(true);
    setErr('');
    try {
      const ride = await createRide({ from, to, riders, mode, timing, scheduledFor: p.scheduledFor || undefined, hasKids: p.kids === '1', needsTowels: p.towels === '1' });
      if (ride.status === 'awaiting_payment') await payFor({ rideId: ride.id }, `${dockName(from)} → ${dockName(to)}`);
      if (repeat) {
        // The first pickup is the ride just booked; the repeat rule starts the next day.
        const start = new Date(at.getTime() + 86_400_000);
        const end = new Date(at.getTime() + Number(p.repeatFor ?? 6) * 86_400_000);
        await createRepeatRide({ from, to, riders, time: hhmm(at), weekdays, startDate: ymd(start), endDate: ymd(end) });
      }
      router.replace({ pathname: '/confirmation', params: { kind: 'ride', id: ride.id } });
    } catch (e) {
      setErr(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <Text style={[type.label, { color: c.muted }]}>{t('rideSummary')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>
          {dockName(from)} → {dockName(to)}
        </Text>
        <Note>
          {riders} {t('u_rider').toLowerCase()} · {t(mode === 'shared' ? 'shared' : 'private')} · {timing === 'scheduled' ? `${shortDate(at, i18n.language)} ${clock(at, i18n.language)}` : t('now')}
        </Note>
        {p.joinMin ? <Note>{t('joinedBoat').replace('{m}', p.joinMin)}</Note> : null}
        <Note>{quote.breakdown}</Note>
      </Card>

      {timing === 'scheduled' && (
        <Row icon="shield-checkmark" title={t('guaranteeH')} body={t('guaranteeMsg').replace('{c}', String(FEATURE_SETTINGS.guarantee.missedPickupCreditUsd))} />
      )}
      {night === 'night' && <Row icon="moon" title={t('nightH')} body={t('nightMsg')} />}
      {repeat && (
        <Row
          icon="repeat"
          title={t('repeatToggle')}
          body={`${weekdays.length ? weekdays.map((d) => t(`wd${d}`)).join(' ') : t('everyDay')} · ${clock(at, i18n.language)} · ${t('passDays').replace('{d}', p.repeatFor ?? '6')} · ${t('perRide').replace('{p}', covered ? t('included') : usd(quote.total))}`}
        />
      )}
      {covered && (
        <Row
          icon="ticket"
          title={t('passCovered')}
          body={`${pass ? t(`pass_${pass.passId}`) : ''}${cover.extraRiders ? ` · ${t('passExtra').replace('{n}', String(cover.extraRiders)).replace('{p}', usd(cover.fareUsd))}` : ''}`}
        />
      )}

      <View style={styles.total}>
        <Text style={[type.h2, { color: c.ink }]}>{t('total')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{free ? t('included') : usd(total)}</Text>
      </View>
      <Button label={free ? t('confirmBook') : t('payBtn')} trailing={free ? undefined : usd(total)} loading={busy} onPress={confirm} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function ListingCheckout({ id, busy, setBusy, setErr }: { id: string } & Flow) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const listing = LISTINGS.find((l) => l.id === id);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => new Date(Date.now() + i * 86_400_000)), []);
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('09:00');
  const [qty, setQty] = useState(2);
  const [withTaxi, setWithTaxi] = useState(true);
  // Most week-stay rentals are in West Bay; a saved "My rental" place overrides this.
  const [home, setHome] = useState('inf');
  const [pass, setPass] = useState<GuestPass | null>(null);

  useEffect(() => {
    currentPass().then(setPass).catch(() => {});
    savedPlaces()
      .then((ps) => {
        const h = ps.find((x) => x.icon === 'home');
        if (h) setHome(h.dockId);
      })
      .catch(() => {});
  }, []);

  if (!listing) return <Note>{t('noResults')}</Note>;
  const instant = listing.booking === 'instant' && listing.priceUsd != null;
  const activityTotal = instant ? (listing.unit === 'boat' ? listing.priceUsd! : listing.priceUsd! * qty) : undefined;

  // Boat booked with the activity
  const dest = dockForArea(listing.area);
  const hours = ACTIVITY_HOURS[listing.portal] ?? 2;
  const taxiPossible = dest !== null && dest !== home && hours > 0;
  const riders = Math.min(qty, PRICING.maxRiders);
  const start = new Date(`${ymd(days[day])}T${time}:00`);
  const there = taxiPossible && dest ? quoteFare({ from: home, to: dest, riders, mode: 'private', timing: 'scheduled' }) : null;
  const pickupAt = pickupForActivity(start, there?.rideMinutes ?? 0);
  const backAt = new Date(start.getTime() + hours * 3_600_000);
  const tooSoon = taxiPossible && withTaxi ? pickupAt.getTime() < Date.now() + 15 * 60_000 : start.getTime() < Date.now();
  const legFare = (at: Date) => {
    if (!there || !dest) return 0;
    const cv = passCovers(pass, { from: home, to: dest, riders, at });
    return cv.covered ? cv.fareUsd : there.total;
  };
  const taxiTotal = taxiPossible && withTaxi ? legFare(pickupAt) + legFare(backAt) : 0;
  const late = taxiPossible && withTaxi && nightMode(backAt) === 'boats_closed';
  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;
  const unitLabel = t(`u_${listing.unit ?? 'person'}`);

  async function confirm() {
    if (tooSoon || late) return;
    setBusy(true);
    setErr('');
    try {
      const booking = await createBooking({ listing: listing!, date: ymd(days[day]), time, quantity: qty });
      const paid = booking.status === 'awaiting_payment';
      if (paid) await payFor({ bookingId: booking.id }, listing!.name);
      if (taxiPossible && withTaxi && dest) {
        for (const [a, b, when] of [
          [home, dest, pickupAt],
          [dest, home, backAt],
        ] as const) {
          const ride = await createRide({ from: a, to: b, riders, mode: 'private', timing: 'scheduled', scheduledFor: when.toISOString(), hasKids: false, needsTowels: listing!.portal === 'snork' || listing!.portal === 'dive', bookingId: booking.id });
          if (ride.status === 'awaiting_payment') await payFor({ rideId: ride.id }, `${dockName(a)} → ${dockName(b)}`);
        }
      }
      router.replace({ pathname: '/confirmation', params: { kind: 'booking', id: booking.id, taxi: taxiPossible && withTaxi ? '1' : '0', paid: paid ? '1' : '0' } });
    } catch (e) {
      setErr(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <Text style={[type.label, { color: c.muted }]}>{t('what')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{listing.name}</Text>
        <Note>
          {listing.area} · {listing.priceText ?? t('askPrice')}
        </Note>
      </Card>

      <Text style={[type.bodyStrong, { color: c.ink }]}>{t('date')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
        {days.map((d, i) => (
          <Pressable key={i} onPress={() => setDay(i)} style={[styles.pill, { backgroundColor: i === day ? c.ink : c.tile }]}>
            <Text style={[type.label, { fontSize: 14, color: i === day ? c.onInk : c.ink }]}>{i === 0 ? t('today') : shortDate(d, i18n.language)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[type.bodyStrong, { color: c.ink }]}>{t('time')}</Text>
      <View style={styles.wrap}>
        {ACTIVITY_TIMES.map((x) => (
          <Pressable key={x} onPress={() => setTime(x)} style={[styles.pill, { backgroundColor: x === time ? c.ink : c.tile }]}>
            <Text style={[type.label, { fontSize: 14, color: x === time ? c.onInk : c.ink }]}>{clock(new Date(`2026-01-01T${x}:00`), i18n.language)}</Text>
          </Pressable>
        ))}
      </View>
      <Stepper label={unitLabel} value={qty} min={1} max={20} onChange={setQty} />

      {/* Feature 7: the boat there and back is booked with the activity */}
      <Card>
        {dest !== null && hours > 0 ? (
          <>
            <View style={styles.switchRow}>
              <Ionicons name="boat" size={20} color={c.flame} />
              <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('addTaxi')}</Text>
              <Switch value={withTaxi} onValueChange={setWithTaxi} trackColor={{ true: c.flame }} />
            </View>
            {withTaxi && (
              <>
                <Text style={[type.label, { color: c.muted }]}>{t('from_')}</Text>
                <View style={styles.wrap}>
                  {FLAT_DOCKS.map((d) => (
                    <Pressable key={d} onPress={() => setHome(d)} style={[styles.pill, { backgroundColor: d === home ? c.ink : c.bg }]}>
                      <Text style={[type.label, { fontSize: 13, color: d === home ? c.onInk : c.ink }]}>{dockName(d)}</Text>
                    </Pressable>
                  ))}
                </View>
                {taxiPossible ? (
                  <>
                    <Note>• {t('taxiThere').replace('{t}', clock(pickupAt, i18n.language)).replace('{dock}', dockName(home))}</Note>
                    <Note>• {t('taxiBack').replace('{t}', clock(backAt, i18n.language))}</Note>
                    <Note>• {t('guaranteeH')}</Note>
                  </>
                ) : (
                  <Note>{t('sameDock')}</Note>
                )}
                {late ? <Text style={[type.small, { color: c.sos }]}>{t('closedMsg').replace('{h}', hourLabel(FEATURE_SETTINGS.night.lastBoatHour, i18n.language))}</Text> : null}
              </>
            )}
          </>
        ) : (
          <Note>{dest === null ? t('noDockNear') : t('goRide')}</Note>
        )}
      </Card>

      <View style={{ gap: 4 }}>
        <View style={styles.total}>
          <Text style={[type.body, { color: c.ink }]}>{listing.name}</Text>
          <Text style={[type.bodyStrong, { color: c.ink }]}>{activityTotal != null ? usd(activityTotal) : t('byOperator')}</Text>
        </View>
        {taxiTotal > 0 || (taxiPossible && withTaxi) ? (
          <View style={styles.total}>
            <Text style={[type.body, { color: c.ink }]}>{t('withTaxi')}</Text>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{taxiTotal === 0 ? t('included') : usd(taxiTotal)}</Text>
          </View>
        ) : null}
      </View>
      {!instant && <Note>{t('quoteHint')}</Note>}
      {tooSoon && <Text style={[type.small, { color: c.sos }]}>{t('noTaxi')}</Text>}
      <Button
        label={instant ? t('payBtn') : t('sendReq')}
        trailing={instant ? usd((activityTotal ?? 0) + taxiTotal) : taxiTotal ? usd(taxiTotal) : undefined}
        loading={busy}
        disabled={tooSoon || late}
        onPress={confirm}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function PassCheckout({ passId, busy, setBusy, setErr }: { passId: PassId } & Flow) {
  const { t } = useTranslation();
  const c = useTheme();
  const def = passDefinition(passId);

  async function confirm() {
    setBusy(true);
    setErr('');
    try {
      const { id } = await buyPass(passId);
      await payFor({ passId: id }, t(`pass_${passId}`));
      router.replace({ pathname: '/confirmation', params: { kind: 'pass', id } });
    } catch (e) {
      setErr(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <Text style={[type.label, { color: c.muted }]}>{t('passTitle')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{t(`pass_${passId}`)}</Text>
        <Note>
          {t('passDays').replace('{d}', String(def.days))} · {def.rides ? t('passRides').replace('{n}', String(def.rides)) : t('passUnlimited')} ·{' '}
          {def.riders === 1 ? t('passOneRider') : t('passRiders').replace('{n}', String(def.riders))}
        </Note>
        <Note>{t('passBreakEven').replace('{n}', String(passBreakEvenRides(passId)))}</Note>
        <Note>{t('passOnlyZone')}</Note>
      </Card>
      <View style={styles.total}>
        <Text style={[type.h2, { color: c.ink }]}>{t('total')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{usd(def.priceUsd)}</Text>
      </View>
      <Button label={t('payBtn')} trailing={usd(def.priceUsd)} loading={busy} onPress={confirm} />
    </>
  );
}

function Row({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const c = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: c.tile }]}>
      <Ionicons name={icon} size={20} color={c.flame} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: c.ink }]}>{title}</Text>
        {body ? <Note>{body}</Note> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(2) },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(3) },
});
