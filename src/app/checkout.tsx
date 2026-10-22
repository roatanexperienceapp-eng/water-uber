import { activityTotalUsd, boatsFor, TOUR_SETTINGS } from '../../supabase/functions/_shared/tours.ts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS, FLAT_ZONE } from '../../supabase/functions/_shared/geo.ts';
import { PRICING, quoteFare, type RideMode, type RideTiming } from '../../supabase/functions/_shared/pricing.ts';
import {
  ACTIVITY_HOURS, dockForArea, FEATURE_SETTINGS, nightMode, passBreakEvenRides, passCovers, passDefinition, pickupForActivity,
  type PassId,
} from '../../supabase/functions/_shared/features.ts';
import { AllAboardBar } from '@/components/AllAboardBar';
import { DockPicker } from '@/components/DockPicker';
import { Button, Card, Note, Stepper } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { LISTINGS } from '@/data/catalogue';
import { createBooking, createRide, isDemo } from '@/lib/api';
import {
  CRUISE_SETTINGS, cruiseStartTimes, fitsPortTime, islandClock, islandDay, roatanDate, roatanInstant, useMyShip,
} from '@/lib/cruise';
import { usd } from '@/lib/format';
import { passName } from '@/lib/passName';
import { meetingText } from '@/lib/meeting';
import { pay, type PayOutcome } from '@/lib/payments';
import { startZelle, type ZelleTarget } from '@/lib/api';
import { ZELLE } from '../../supabase/functions/_shared/business.ts';
import { VAN_SETTINGS, vanPlan, vanPriceUsd } from '../../supabase/functions/_shared/transport.ts';
import { buyPass, createRepeatRide, currentPass, savedPlaces, type GuestPass } from '@/lib/stay';
import { createPackage, packageTourOptions, quotePackage, type PickedTour } from '@/lib/bundles';
import { hhmm, hourLabel, ymd } from '@/lib/stayUi';
import { useNow } from '@/lib/useNow';
import { radius, space, type, useTheme } from '@/theme';

type Params = {
  kind: 'ride' | 'listing' | 'pass' | 'bundle';
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
  // pass / bundle
  passId?: PassId;
  tours?: string; // JSON PickedTour[]
};

const ACTIVITY_TIMES = ['08:00', '09:00', '10:00', '13:00', '14:00', '18:00'];
const FLAT_DOCKS = FLAT_ZONE;

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
        {p.kind === 'pass' && <PassCheckout passId={p.passId ?? 'week2'} busy={busy} setBusy={setBusy} setErr={setErr} />}
        {p.kind === 'bundle' && <BundleCheckout passId={p.passId ?? 'week2'} toursJson={p.tours ?? '[]'} busy={busy} setBusy={setBusy} setErr={setErr} />}
        {err ? <Text style={[type.small, { color: c.sos, textAlign: 'center' }]}>{err}</Text> : null}
        <View style={styles.secure}>
          <Ionicons name="lock-closed" size={14} color={c.muted} />
          <Note center>{DEMO_MODE ? t('demoPay') : t('securePay')}</Note>
        </View>
        <Note center>{t('lock')}</Note>
      </ScrollView>
    </SafeAreaView>
  );
}

type Flow = { busy: boolean; setBusy: (b: boolean) => void; setErr: (s: string) => void };

function errorText(t: (k: string) => string, e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  const known: Record<string, string> = {
    boats_closed: 'closedH',
    payments_not_configured: 'payNotReady',
    misses_ship: 'missesShip',
    van_too_soon: 'vanTooSoon',
    too_late_to_split: 'tooLateSplit',
    split_closed: 'splitClosed',
    no_shares_left: 'splitFull',
  };
  return t(known[code] ?? 'payFailed');
}

/** After pay(): go to the confirmation, or explain what happened. */
function afterPay(outcome: PayOutcome, t: (k: string) => string, setErr: (s: string) => void, confirmation: { pathname: '/confirmation'; params: Record<string, string> }) {
  if (outcome === 'redirected') return; // web: the checkout page takes over and comes back on /paid
  if (outcome === 'cancelled') return setErr(t('payCancelled'));
  if (outcome === 'failed') return setErr(t('payFailed'));
  // 'paid' or 'pending' (webhook not in yet): the confirmation screen shows the live status.
  router.replace(confirmation);
}

const confirmPath = (kind: string, id: string) => `/confirmation?kind=${kind}&id=${encodeURIComponent(id)}`;

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
      if (repeat) {
        // The first pickup is the ride just booked; the repeat rule starts the next day. Created before
        // paying so nothing is lost if the web checkout navigates away.
        const start = new Date(at.getTime() + 86_400_000);
        const end = new Date(at.getTime() + Number(p.repeatFor ?? 6) * 86_400_000);
        await createRepeatRide({ from, to, riders, time: hhmm(at), weekdays, startDate: ymd(start), endDate: ymd(end) });
      }
      const target = { pathname: '/confirmation' as const, params: { kind: 'ride', id: ride.id } };
      if (ride.status !== 'awaiting_payment') return router.replace(target);
      const { outcome } = await pay({ rideId: ride.id }, confirmPath('ride', ride.id));
      afterPay(outcome, t, setErr, target);
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
          {riders} {t('u_rider').toLowerCase()} · {t(mode === 'shared' ? 'shared' : 'private')} · {timing === 'scheduled' ? `${islandDay(at, i18n.language)} ${islandClock(at, i18n.language)}` : t('now')}
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
          body={`${weekdays.length ? weekdays.map((d) => t(`wd${d}`)).join(' ') : t('everyDay')} · ${islandClock(at, i18n.language)} · ${t('passDays').replace('{d}', p.repeatFor ?? '6')} · ${t('perRide').replace('{p}', covered ? t('included') : usd(quote.total))}`}
        />
      )}
      {covered && (
        <Row
          icon="ticket"
          title={t('passCovered')}
          body={`${pass ? passName(t, pass.passId) : ''}${cover.extraRiders ? ` · ${t('passExtra').replace('{n}', String(cover.extraRiders)).replace('{p}', usd(cover.fareUsd))}` : ''}`}
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
  const ship = useMyShip();
    const now = useNow();
  const [days] = useState(() => Array.from({ length: 10 }, (_, i) => roatanDate(new Date(new Date().getTime() + i * 86_400_000))));
  const [day, setDay] = useState(1);
  const [pickedTime, setTime] = useState('09:00');
  const [qty, setQty] = useState(2);
  const [withTaxi, setWithTaxi] = useState(true);
  const [withVan, setWithVan] = useState(true);
  const [split, setSplit] = useState(false);
  const [shares, setShares] = useState(2);
  // Most week-stay rentals are in West Bay; a saved "My rental" place overrides this.
  const [home, setHome] = useState('inf');
  const [homePicker, setHomePicker] = useState(false);
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
  const activityTotal = instant ? activityTotalUsd(listing.priceUsd!, listing.unit, qty) : undefined;
  // Per-boat charters still count people: it decides how many boats the group needs.
  const unitLabel = t(`u_${listing.unit === 'boat' ? 'person' : listing.unit ?? 'person'}`);
  const boats = listing.unit === 'boat' ? boatsFor(qty) : 0;

  // ---- Cruise mode: the ship's day only, and only start times that get the group back in time ----
  const cruise = ship && ship.date >= roatanDate(now) ? ship : null;
  const cruiseTimes = cruise ? cruiseStartTimes(cruise, listing, now) : [];
  const date = cruise ? cruise.date : days[day];
  const time = cruise ? (cruiseTimes.includes(pickedTime) ? pickedTime : cruiseTimes[0] ?? '') : pickedTime;
  const start = time ? roatanInstant(date, time) : null;
  const fit = cruise && start ? fitsPortTime(cruise, { area: listing.area, portal: listing.portal, start, durationMinutes: listing.durationMinutes }) : null;
  const unknownArea = !!fit && !fit.fits && fit.reason === 'unknown_area';
  const cruiseBlocked = !!cruise && (cruiseTimes.length === 0 && !unknownArea);

  // ---- Boat there and back (week-stay guests; cruise guests come by road from the port) ----
  const dest = dockForArea(listing.area);
  const hours = ACTIVITY_HOURS[listing.portal] ?? 2;
  const offerTaxi = !cruise && dest !== null && hours > 0;
  const taxiOn = offerTaxi && withTaxi && !split && dest !== home;
  const riders = Math.min(qty, PRICING.maxRiders);
  const there = taxiOn && dest ? quoteFare({ from: home, to: dest, riders, mode: 'private', timing: 'scheduled' }) : null;
  const pickupAt = start ? pickupForActivity(start, there?.rideMinutes ?? 0) : null;
  const backAt = start ? new Date(start.getTime() + hours * 3_600_000) : null;
  const tooSoon = !start || (taxiOn && pickupAt ? pickupAt.getTime() < now.getTime() + 15 * 60_000 : start.getTime() < now.getTime() + 15 * 60_000);
  const legFare = (at: Date | null) => {
    if (!there || !dest || !at) return 0;
    const cv = passCovers(pass, { from: home, to: dest, riders, at });
    return cv.covered ? cv.fareUsd : there.total;
  };
  const taxiTotal = taxiOn ? legFare(pickupAt) + legFare(backAt) : 0;
  const late = taxiOn && !!backAt && nightMode(backAt) === 'boats_closed';
  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;

  // ---- Our van from the cruise port and back (fixed-price bookings; not when the business picks up itself) ----
  const van = cruise && instant && start && !(listing.portPickup && !listing.ours)
    ? vanPlan(cruise, { area: listing.area, portal: listing.portal, start, durationMinutes: listing.durationMinutes, people: qty })
    : null;
  const vanOn = !!van && withVan;
  const vanUsd = vanOn ? vanPriceUsd(qty) : 0;
  const vanTooSoon = vanOn && !!van && van.pickupAt.getTime() < now.getTime() + 10 * 60_000;

  // ---- Split with my group (fixed-price bookings only) ----
  const maxShares = Math.min(CRUISE_SETTINGS.splitMaxShares, Math.max(2, qty));
  const shareCount = Math.min(shares, maxShares);
  const eachUsd = activityTotal ? Math.ceil(((activityTotal + vanUsd) * 100) / shareCount) / 100 : 0;
  const payNow = split ? eachUsd : (activityTotal ?? 0) + taxiTotal + vanUsd;

  const zelleOk = ZELLE.enabled && instant && !split && !!start && start.getTime() - now.getTime() >= ZELLE.minLeadHours * 3_600_000;

  async function confirm(method: 'card' | 'zelle' = 'card') {
    if (tooSoon || late || cruiseBlocked || vanTooSoon) return;
    setBusy(true);
    setErr('');
    try {
      // Everything that belongs to this purchase is created BEFORE paying (see lib/payments.ts).
      const booking = await createBooking({
        listing: listing!,
        date,
        time,
        quantity: qty,
        shipCallId: cruise && !isDemo ? cruise.id : undefined,
        splitShares: split ? shareCount : undefined,
        van: vanOn,
        ship: cruise,
      });
      if (taxiOn && dest && pickupAt && backAt) {
        for (const [a, b, when] of [
          [home, dest, pickupAt],
          [dest, home, backAt],
        ] as const) {
          await createRide({ from: a, to: b, riders, mode: 'private', timing: 'scheduled', scheduledFor: when.toISOString(), hasKids: false, needsTowels: listing!.portal === 'snork' || listing!.portal === 'dive', bookingId: booking.id });
        }
      }
      const target = { pathname: '/confirmation' as const, params: { kind: 'booking', id: booking.id } };
      if (booking.split) {
        const { outcome } = await pay({ splitToken: booking.split.token, shares: 'one' }, confirmPath('booking', booking.id));
        return afterPay(outcome, t, setErr, target);
      }
      if (booking.status !== 'awaiting_payment') return router.replace(target); // request: price comes later
      if (method === 'zelle') return await goZelle({ bookingId: booking.id }, payNow, { kind: 'booking', id: booking.id });
      // One checkout pays the activity and its taxi rides together.
      const { outcome } = await pay({ bookingId: booking.id }, confirmPath('booking', booking.id));
      afterPay(outcome, t, setErr, target);
    } catch (e) {
      setErr(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {cruise && <AllAboardBar />}
      <Card>
        <Text style={[type.label, { color: c.muted }]}>{t('what')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{listing.name}</Text>
        <Note>
          {listing.area} · {listing.priceText ?? t('askPrice')}
        </Note>
      </Card>

      <Text style={[type.bodyStrong, { color: c.ink }]}>{t('date')}</Text>
      {cruise ? (
        <Note>
          {islandDay(cruise.allAboardAt, i18n.language)} · {t('shipDayOnly').replace('{ship}', cruise.ship)}
        </Note>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {days.map((d, i) => (
            <Pressable key={d} onPress={() => setDay(i)} style={[styles.pill, { backgroundColor: i === day ? c.ink : c.tile }]}>
              <Text style={[type.label, { fontSize: 14, color: i === day ? c.onInk : c.ink }]}>{i === 0 ? t('today') : islandDay(roatanInstant(d, '12:00'), i18n.language)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Text style={[type.bodyStrong, { color: c.ink }]}>
        {t('time')} <Text style={[type.small, { color: c.muted }]}>· {t('islandTime')}</Text>
      </Text>
      {cruise && cruiseTimes.length === 0 && !unknownArea ? (
        <View style={[styles.row, { backgroundColor: '#FDECEA' }]}>
          <Ionicons name="alert-circle" size={20} color={c.sos} />
          <Text style={[type.small, { color: '#5a1a12', flex: 1 }]}>{t('noTimeFits')}</Text>
        </View>
      ) : (
        <View style={styles.wrap}>
          {(cruise && !unknownArea
            ? cruiseTimes
            : cruise
              ? // Unknown drive time: at least never offer a start after the guest must be back at the port.
                ACTIVITY_TIMES.filter((x) => {
                  const at = roatanInstant(date, x).getTime();
                  return at > now.getTime() + 30 * 60_000 && at < cruise.allAboardAt.getTime() - CRUISE_SETTINGS.backAtPortMinutesBefore * 60_000;
                })
              : ACTIVITY_TIMES
          ).map((x) => (
            <Pressable key={x} onPress={() => setTime(x)} style={[styles.pill, { backgroundColor: x === time ? c.ink : c.tile }]}>
              <Text style={[type.label, { fontSize: 14, color: x === time ? c.onInk : c.ink }]}>{islandClock(roatanInstant(date, x), i18n.language)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {fit?.fits && (
        <View style={[styles.row, { backgroundColor: '#E8F7EE' }]}>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
          <Text style={[type.small, { color: '#14532D', flex: 1 }]}>
            {t('backInTime').replace('{t}', islandClock(fit.backAtPort, i18n.language)).replace('{m}', String(fit.spareMinutes))}
          </Text>
        </View>
      )}
      {unknownArea && <Note>{t('fitUnknown')}</Note>}

      <Stepper label={unitLabel} value={qty} min={1} max={20} onChange={setQty} />
      {boats > 0 && <Note>{t('boatsNeeded').replace('{n}', String(boats)).replace('{s}', String(TOUR_SETTINGS.seatsPerBoat))}</Note>}

      {/* Our own tours: run by our captains */}
      {listing.ours && (listing.portal === 'snork' || listing.portal === 'fish') && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/captains')} style={[styles.row, { backgroundColor: c.tile }]}>
          <Ionicons name="shield-checkmark" size={20} color={c.flame} />
          <Text style={[type.small, { color: c.ink, flex: 1 }]}>{t('withOurCaptains')}</Text>
          <Ionicons name="chevron-forward" size={16} color={c.muted} />
        </Pressable>
      )}

      {/* Where to meet */}
      <Card>
        <Text style={[type.bodyStrong, { color: c.ink }]}>📍 {t('meetH')}</Text>
        <Note>{meetingText(listing, cruise, t, vanOn && van ? islandClock(van.pickupAt, i18n.language) : null)}</Note>
      </Card>

      {/* Our van from the cruise port */}
      {van && (
        <Card>
          <View style={styles.switchRow}>
            <Ionicons name="bus" size={20} color={c.flame} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{t('vanToggle')}</Text>
              <Note>{t('vanPrice').replace('{p}', usd(VAN_SETTINGS.roundTripPerPerson))}</Note>
            </View>
            <Switch value={withVan} onValueChange={setWithVan} trackColor={{ true: c.flame }} />
          </View>
          {withVan ? (
            <>
              <Note>• {t('vanThere').replace('{t}', islandClock(van.pickupAt, i18n.language))}</Note>
              <Note>• {t('vanBack').replace('{t}', islandClock(van.returnPickupAt, i18n.language))}</Note>
              <Note>• {t('vanAtPort').replace('{t}', islandClock(van.backAtPort, i18n.language))}</Note>
              {van.vans > 1 && <Note>• {t('vansNeeded').replace('{n}', String(van.vans)).replace('{s}', String(VAN_SETTINGS.seatsPerVan))}</Note>}
            </>
          ) : (
            <Note>{t('vanOffHint').replace('{m}', String(van.transferMinutes))}</Note>
          )}
          {vanTooSoon && <Text style={[type.small, { color: c.sos }]}>{t('vanTooSoon')}</Text>}
        </Card>
      )}

      {/* Split with my group */}
      {instant && (
        <Card>
          <View style={styles.switchRow}>
            <Ionicons name="people" size={20} color={c.flame} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{t('splitToggle')}</Text>
              <Note>{t('splitHint')}</Note>
            </View>
            <Switch value={split} onValueChange={setSplit} trackColor={{ true: c.flame }} />
          </View>
          {split && (
            <>
              <Stepper label={t('splitWays')} value={shareCount} min={2} max={maxShares} onChange={setShares} />
              <Note>{t('splitEach').replace('{p}', usd(eachUsd)).replace('{n}', String(shareCount))}</Note>
              <Note>{t('splitRule').replace('{m}', String(CRUISE_SETTINGS.splitPayBeforeMinutes))}</Note>
              {offerTaxi && <Note>{t('splitNoTaxi')}</Note>}
            </>
          )}
        </Card>
      )}

      {/* Boat there and back (week-stay guests) */}
      {offerTaxi && !split && (
        <Card>
          <View style={styles.switchRow}>
            <Ionicons name="boat" size={20} color={c.flame} />
            <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('addTaxi')}</Text>
            <Switch value={withTaxi} onValueChange={setWithTaxi} trackColor={{ true: c.flame }} />
          </View>
          {withTaxi && (
            <>
              <Text style={[type.label, { color: c.muted }]}>{t('from_')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setHomePicker(true)} style={[styles.row, { backgroundColor: c.bg }]}>
                <Ionicons name="boat-outline" size={18} color={c.ink} />
                <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{dockName(home)}</Text>
                <Ionicons name="chevron-down" size={18} color={c.muted} />
              </Pressable>
              <DockPicker visible={homePicker} selected={home} only={FLAT_DOCKS} onPick={(d) => { setHome(d); setHomePicker(false); }} onClose={() => setHomePicker(false)} />
              {taxiOn && pickupAt && backAt ? (
                <>
                  <Note>• {t('taxiThere').replace('{t}', islandClock(pickupAt, i18n.language)).replace('{dock}', dockName(home))}</Note>
                  <Note>• {t('taxiBack').replace('{t}', islandClock(backAt, i18n.language))}</Note>
                  <Note>• {t('guaranteeH')} · {t('oneCheckout')}</Note>
                </>
              ) : (
                <Note>{t('sameDock')}</Note>
              )}
              {late ? <Text style={[type.small, { color: c.sos }]}>{t('closedMsg').replace('{h}', hourLabel(FEATURE_SETTINGS.night.lastBoatHour, i18n.language))}</Text> : null}
            </>
          )}
        </Card>
      )}
      {!offerTaxi && !cruise && dest === null && ACTIVITY_HOURS[listing.portal] ? <Note>{t('noDockNear')}</Note> : null}

      <View style={{ gap: 4 }}>
        <View style={styles.total}>
          <Text style={[type.body, { color: c.ink }]}>{listing.name}</Text>
          <Text style={[type.bodyStrong, { color: c.ink }]}>{activityTotal != null ? usd(activityTotal) : t('byOperator')}</Text>
        </View>
        {taxiOn ? (
          <View style={styles.total}>
            <Text style={[type.body, { color: c.ink }]}>{t('withTaxi')}</Text>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{taxiTotal === 0 ? t('included') : usd(taxiTotal)}</Text>
          </View>
        ) : null}
        {vanOn ? (
          <View style={styles.total}>
            <Text style={[type.body, { color: c.ink }]}>{t('vanLine').replace('{n}', String(qty))}</Text>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{usd(vanUsd)}</Text>
          </View>
        ) : null}
        {split && (
          <View style={styles.total}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{t('yourShare')}</Text>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{usd(eachUsd)}</Text>
          </View>
        )}
      </View>
      {!instant && <Note>{t('quoteHint')}</Note>}
      {!instant && taxiOn && <Note>{t('taxiWithQuote')}</Note>}
      {tooSoon && !cruiseBlocked && <Text style={[type.small, { color: c.sos }]}>{t('tooSoon')}</Text>}
      <Button
        label={instant ? t('payBtn') : t('sendReq')}
        trailing={instant ? usd(payNow) : undefined}
        loading={busy}
        disabled={tooSoon || late || cruiseBlocked || vanTooSoon}
        onPress={() => confirm()}
      />
      {zelleOk && <ZelleButton disabled={busy || tooSoon || late || cruiseBlocked || vanTooSoon} onPress={() => confirm('zelle')} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function PassCheckout({ passId, busy, setBusy, setErr }: { passId: PassId } & Flow) {
  const { t } = useTranslation();
  const c = useTheme();
  const def = passDefinition(passId);

  async function confirm(method: 'card' | 'zelle' = 'card') {
    setBusy(true);
    setErr('');
    try {
      const { id } = await buyPass(passId);
      if (method === 'zelle') return await goZelle({ passId: id }, def.priceUsd, { kind: 'pass', id });
      const { outcome } = await pay({ passId: id }, confirmPath('pass', id));
      afterPay(outcome, t, setErr, { pathname: '/confirmation', params: { kind: 'pass', id } });
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
        <Text style={[type.h2, { color: c.ink }]}>{passName(t, passId)}</Text>
        <Note>
          {t('passDays').replace('{d}', String(def.days))} · {def.rides ? t('passRides').replace('{n}', String(def.rides)) : t('passUnlimited')} ·{' '}
          {t('passUnlimitedGroup').replace('{n}', String(def.riders))}
        </Note>
        <Note>{t('passBreakEven').replace('{n}', String(passBreakEvenRides(passId)))}</Note>
        <Note>{t('passOnlyZone')}</Note>
      </Card>
      <View style={styles.total}>
        <Text style={[type.h2, { color: c.ink }]}>{t('total')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{usd(def.priceUsd)}</Text>
      </View>
      <Button label={t('payBtn')} trailing={usd(def.priceUsd)} loading={busy} onPress={() => confirm()} />
      {ZELLE.enabled && <ZelleButton disabled={busy} onPress={() => confirm('zelle')} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
/** Package: pass + tours, priced with the package discount; one payment confirms everything. */
function BundleCheckout({ passId, toursJson, busy, setBusy, setErr }: { passId: PassId; toursJson: string } & Flow) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const now = useNow();
  let tours: PickedTour[] = [];
  try {
    tours = JSON.parse(toursJson) as PickedTour[];
  } catch {
    tours = [];
  }
  const quote = quotePackage(passId, tours);
  const def = passDefinition(passId);
  const opts = packageTourOptions();
  if (!quote) return <Note>{t('payFailed')}</Note>;

  const firstTour = Math.min(...tours.map((tr) => roatanInstant(tr.date, tr.time).getTime()));
  const zelleOk = ZELLE.enabled && (tours.length === 0 || firstTour - now.getTime() >= ZELLE.minLeadHours * 3_600_000);

  async function confirm(method: 'card' | 'zelle' = 'card') {
    setBusy(true);
    setErr('');
    try {
      const { bundleId, passRowId } = await createPackage(passId, tours);
      if (method === 'zelle') return await goZelle({ bundleId }, quote!.totalCents / 100, { kind: 'pass', id: passRowId, bundle: '1' });
      const { outcome } = await pay({ bundleId }, `/confirmation?kind=pass&id=${encodeURIComponent(passRowId)}&bundle=1`);
      afterPay(outcome, t, setErr, { pathname: '/confirmation', params: { kind: 'pass', id: passRowId, bundle: '1' } });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setErr(code === 'outside_pass' ? t('pkgOutside') : code === 'tour_unavailable' ? t('pkgComingSoon') : errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <Text style={[type.label, { color: c.flame }]}>{t('pkgH')}</Text>
        <Text style={[type.h2, { color: c.ink }]}>{passName(t, passId)}</Text>
        <Note>{t('passUnlimitedGroup').replace('{n}', String(def.riders))}</Note>
        {tours.map((tr) => {
          const o = opts.find((x) => x.listingId === tr.listingId);
          return (
            <Note key={tr.listingId}>
              + {o?.name} · {islandDay(roatanInstant(tr.date, tr.time), i18n.language)} {islandClock(roatanInstant(tr.date, tr.time), i18n.language)} · {def.riders} {t('u_person').toLowerCase()}
            </Note>
          );
        })}
      </Card>
      <View style={{ gap: 4 }}>
        <View style={styles.total}>
          <Text style={[type.body, { color: c.ink }]}>{t('pkgSubtotal')}</Text>
          <Text style={[type.body, { color: c.ink }]}>{usd(quote.subtotalCents / 100)}</Text>
        </View>
        <View style={styles.total}>
          <Text style={[type.bodyStrong, { color: '#16A34A' }]}>{t('pkgDiscount').replace('{p}', String(quote.discountPct))}</Text>
          <Text style={[type.bodyStrong, { color: '#16A34A' }]}>−{usd(quote.discountCents / 100)}</Text>
        </View>
        <View style={styles.total}>
          <Text style={[type.h2, { color: c.ink }]}>{t('total')}</Text>
          <Text style={[type.h2, { color: c.ink }]}>{usd(quote.totalCents / 100)}</Text>
        </View>
      </View>
      <Note>{t('pkgOnePayment')}</Note>
      <Button label={t('payBtn')} trailing={usd(quote.totalCents / 100)} loading={busy} onPress={() => confirm()} />
      {zelleOk && <ZelleButton disabled={busy} onPress={() => confirm('zelle')} />}
    </>
  );
}

/** Zelle: the item is already created and held; show the transfer instructions. */
async function goZelle(target: ZelleTarget, amountUsd: number, confirm: Record<string, string>) {
  const z = await startZelle(target, amountUsd);
  router.push({ pathname: '/zelle', params: { ...confirm, amount: String(z.amountUsd), to: z.zelle.to, code: z.zelle.code } });
}

function ZelleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 4 }}>
      <Button variant="tile" label={t('payZelle')} disabled={disabled} onPress={onPress} />
      <Note center>{t('payZelleSub')}</Note>
    </View>
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
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
