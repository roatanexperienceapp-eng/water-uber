import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LAND_PRICING, LandQuoteError, onIsland, pickupEta, quoteLand, roadKm, vehicleFor,
  type LandQuote, type LandTiming, type LiveVehicle, type VehicleKind,
} from '../../../supabase/functions/_shared/land.ts';
import LiveMap from '@/components/LiveMap';
import { LanguageButton } from '@/components/LanguageButton';
import { CurrencyButton } from '@/components/CurrencyButton';
import { Button, Note, Segmented, Stepper } from '@/components/ui';
import { HOME_CENTER } from '@/config';
import { clock, usd } from '@/lib/format';
import { createLandRide, subscribeVehicles, type Spot } from '@/lib/land';
import { pay } from '@/lib/payments';
import { useNow } from '@/lib/useNow';
import { radius, space, type, useTheme } from '@/theme';
import { PlacePicker } from './PlacePicker';
import { ServiceSwitch } from './ServiceSwitch';

function nextSlots(count: number): Date[] {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  d.setMinutes(d.getMinutes() + 30);
  return Array.from({ length: count }, (_, i) => new Date(d.getTime() + i * 30 * 60000));
}

const ERRORS: Record<string, string> = {
  off_island: 'landErrOffIsland',
  too_close: 'landErrSame',
  too_far: 'landErrFar',
  too_many_riders: 'landErrRiders',
  payments_not_configured: 'payNotReady',
};

/** Land taxi: Uber-style. Where from, where to, car or van, price up front, pay, then follow the car. */
export function LandHome() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const { height } = useWindowDimensions();
  const [cars, setCars] = useState<LiveVehicle[]>([]);
  const [pickup, setPickup] = useState<Spot | null>(null);
  const [dropoff, setDropoff] = useState<Spot | null>(null);
  const [picker, setPicker] = useState<null | 'pickup' | 'dropoff'>(null);
  const [riders, setRiders] = useState(2);
  const [wantVan, setWantVan] = useState(false);
  const [timing, setTiming] = useState<LandTiming>('now');
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [locNote, setLocNote] = useState('');

  const now = useNow(30_000);
  useEffect(() => subscribeVehicles(setCars), []);
  const slots = useMemo(() => nextSlots(24), []);

  // Use the phone's location for pickup if the guest already allowed it (no prompt here).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (alive && onIsland(here)) setPickup((p) => p ?? { ...here, label: t('landMyLocation') });
      } catch {
        // pick by hand
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  async function useMyLocation() {
    setPicker(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setLocNote(t('noLoc'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      if (!onIsland(here)) return setLocNote(t('landNotOnIsland'));
      setLocNote('');
      setPickup({ ...here, label: t('landMyLocation') });
    } catch {
      setLocNote(t('noLoc'));
    }
  }

  const needVan = vehicleFor(riders) === 'van';
  const vehicle: VehicleKind = needVan || wantVan ? 'van' : 'car';
  const quotes = useMemo(() => {
    const out: Partial<Record<VehicleKind, LandQuote | string>> = {};
    if (!pickup || !dropoff) return out;
    for (const v of ['car', 'van'] as const) {
      if (v === 'car' && needVan) continue;
      try {
        out[v] = quoteLand({ from: pickup, to: dropoff, riders, vehicle: v, timing });
      } catch (e) {
        out[v] = e instanceof LandQuoteError ? e.message : 'bad_request';
      }
    }
    return out;
  }, [pickup, dropoff, riders, timing, needVan]);
  const quote = typeof quotes[vehicle] === 'object' ? (quotes[vehicle] as LandQuote) : null;
  const quoteErr = typeof quotes[vehicle] === 'string' ? (quotes[vehicle] as string) : '';
  const eta = pickup ? pickupEta(cars, pickup, vehicle) : null;
  const start = timing === 'scheduled' ? slots[slot] : new Date(now.getTime() + (eta ?? 10) * 60_000);
  const arrive = quote ? new Date(start.getTime() + quote.minutes * 60_000) : null;
  const free = cars.filter((v) => v.available).length;

  // Frame both pins; roads wind, so no straight line is drawn between them.
  const center = pickup && dropoff
    ? { latitude: (pickup.lat + dropoff.lat) / 2, longitude: (pickup.lon + dropoff.lon) / 2 }
    : pickup ? { latitude: pickup.lat, longitude: pickup.lon } : HOME_CENTER;
  const rangeMiles = pickup && dropoff ? Math.min(12, Math.max(2, (roadKm(pickup, dropoff) / LAND_PRICING.roadFactor / 1.609) * 0.65)) : pickup ? 3 : 7;

  async function request() {
    if (!pickup || !dropoff || !quote) return;
    setBusy(true);
    setErr('');
    try {
      const ride = await createLandRide({
        pickup, dropoff, riders, vehicle, timing,
        scheduledFor: timing === 'scheduled' ? slots[slot].toISOString() : undefined,
      });
      const path = `/land/${ride.id}`;
      const { outcome } = await pay({ landRideId: ride.id }, path);
      if (outcome === 'redirected') return;
      if (outcome === 'cancelled') setErr(t('payCancelled'));
      if (outcome === 'failed') setErr(t('payFailed'));
      router.push({ pathname: '/land/[id]', params: { id: ride.id } });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setErr(t(ERRORS[code] ?? 'payFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ServiceSwitch />
          <View style={{ alignItems: 'flex-end', gap: space(1) }}>
            <LanguageButton />
            <CurrencyButton />
          </View>
        </View>
        <Text style={[type.hero, { color: c.ink, paddingHorizontal: space(4), marginBottom: space(3) }]}>{t('landGreet')}</Text>

        <View style={[styles.mapWrap, { height: Math.round(height * 0.38) }]}>
          <LiveMap
            center={center}
            rangeMiles={rangeMiles}
            boats={[]}
            docks={[]}
            route={[]}
            diveSites={[]}
            satellite={false}
            onBoatPress={() => {}}
            onDivePress={() => {}}
            cars={cars}
            pins={[
              ...(pickup ? [{ id: 'pu', kind: 'pickup' as const, lat: pickup.lat, lon: pickup.lon }] : []),
              ...(dropoff ? [{ id: 'do', kind: 'dropoff' as const, lat: dropoff.lat, lon: dropoff.lon }] : []),
            ]}
          />
          <View style={[styles.livePill, { backgroundColor: c.bg }]}>
            <View style={styles.liveDot} />
            <Text style={[type.label, { color: c.ink }]}>{t('landCarsFree').replace('{n}', String(free))}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={[styles.legs, { backgroundColor: c.tile }]}>
            {(['pickup', 'dropoff'] as const).map((k, i) => {
              const s = k === 'pickup' ? pickup : dropoff;
              return (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={t(k === 'pickup' ? 'landPickup' : 'landDropoff')} onPress={() => setPicker(k)} style={[styles.leg, i === 1 && { borderTopWidth: 1, borderTopColor: c.tile2 }]}>
                  <View style={[i === 0 ? styles.dotFrom : styles.dotTo, { backgroundColor: i === 0 ? c.ink : c.flame }]} />
                  <Text style={[type.bodyStrong, { color: s ? c.ink : c.muted, flex: 1 }]} numberOfLines={1}>
                    {s?.label ?? t(k === 'pickup' ? 'landWherePickup' : 'landWhereTo')}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={c.muted} />
                </Pressable>
              );
            })}
          </View>
          {locNote ? <Note>{locNote}</Note> : null}

          <Stepper label={t('riders')} value={riders} min={1} max={LAND_PRICING.van.seats} onChange={setRiders} />

          {(['car', 'van'] as const).map((v) => {
            const q = quotes[v];
            const disabled = v === 'car' && needVan;
            const on = vehicle === v;
            const vEta = pickup ? pickupEta(cars, pickup, v) : null;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled }}
                disabled={disabled}
                onPress={() => setWantVan(v === 'van')}
                style={[styles.opt, { borderColor: on ? c.ink : c.line, opacity: disabled ? 0.45 : 1 }]}
              >
                <Text style={{ fontSize: 30 }}>{v === 'car' ? '🚗' : '🚐'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>
                    {t(v === 'car' ? 'landCar' : 'landVan')} · {LAND_PRICING[v].seats} {t('ridersSeats')}
                  </Text>
                  <Note>
                    {disabled
                      ? t('landCarTooSmall')
                      : timing === 'now'
                        ? vEta != null ? t('landEta').replace('{m}', String(vEta)) : t('landNoCar')
                        : t('landBookAhead')}
                  </Note>
                </View>
                <Text style={[type.h2, { color: c.ink }]}>{typeof q === 'object' ? usd(q.totalUsd) : '—'}</Text>
              </Pressable>
            );
          })}

          {quote && arrive ? (
            <Text style={[type.bodyStrong, { color: c.ink }]}>
              {quote.km.toFixed(1)} km · {t('rideMin').replace('{m}', String(quote.minutes))} · {t('arrive')} ~{clock(arrive, i18n.language)}
            </Text>
          ) : quoteErr ? (
            <Text style={[type.small, { color: c.sos }]}>{t(ERRORS[quoteErr] ?? 'landErrSame')}</Text>
          ) : null}

          <Segmented
            value={timing}
            onChange={setTiming}
            options={[
              { value: 'now', label: t('now') },
              { value: 'scheduled', label: t('later') },
            ]}
          />
          {timing === 'scheduled' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
              {slots.map((s, i) => (
                <Pressable key={s.toISOString()} onPress={() => setSlot(i)} style={[styles.slot, { backgroundColor: i === slot ? c.ink : c.tile }]}>
                  <Text style={[type.label, { fontSize: 14, color: i === slot ? c.onInk : c.ink }]}>{clock(s, i18n.language)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={[styles.banner, { backgroundColor: c.tile }]}>
            <Ionicons name="shield-checkmark" size={20} color={c.flame} />
            <Text style={[type.small, { color: c.ink, flex: 1 }]}>{t('landTrust')}</Text>
          </View>

          {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
          <Button
            label={timing === 'scheduled' ? t('landReserve') : t('landRequest')}
            trailing={quote ? usd(quote.totalUsd) : undefined}
            disabled={!quote || (timing === 'now' && eta == null)}
            loading={busy}
            onPress={request}
          />
          <Note center>{timing === 'now' && pickup && eta == null ? t('landNoCarNow') : t('landNote')}</Note>
        </View>
      </ScrollView>

      <PlacePicker
        visible={picker !== null}
        title={t(picker === 'pickup' ? 'landPickup' : 'landDropoff')}
        onMyLocation={picker === 'pickup' ? useMyLocation : undefined}
        onPick={(s) => {
          if (picker === 'pickup') setPickup(s);
          else setDropoff(s);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingTop: space(2), paddingBottom: space(3) },
  mapWrap: { marginHorizontal: space(4), borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#11618A' },
  livePill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  panel: { padding: space(4), gap: space(4) },
  legs: { borderRadius: radius.md },
  leg: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(4) },
  dotFrom: { width: 9, height: 9, borderRadius: 5 },
  dotTo: { width: 9, height: 9 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md, borderWidth: 2 },
  slot: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(3) },
});
