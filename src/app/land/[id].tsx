import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driveMinutes, roadKm } from '../../../supabase/functions/_shared/land.ts';
import LiveMap from '@/components/LiveMap';
import { Button, Card, Note } from '@/components/ui';
import { clock, usd } from '@/lib/format';
import { cancelLandRide, getLandRide, landRideDriver, type LandDriver, type LandRide } from '@/lib/land';
import { pay } from '@/lib/payments';
import { radius, space, type, useTheme } from '@/theme';

const STEPS = ['paid', 'accepted', 'arrived', 'onboard', 'completed'] as const;
type Step = (typeof STEPS)[number];

function stepOf(r: LandRide): Step | 'awaiting_payment' | 'cancelled' {
  if (r.status === 'awaiting_payment' || r.status === 'cancelled') return r.status;
  if (r.status === 'accepted' && r.arrivedAt) return 'arrived';
  return r.status as Step;
}

/** Follow a land taxi: finding a driver → on the way (live) → arrived → on board → done. */
export default function LandRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const { height } = useWindowDimensions();
  const [ride, setRide] = useState<LandRide | null>(null);
  const [driver, setDriver] = useState<LandDriver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    const r = await getLandRide(id).catch(() => null);
    setRide(r);
    setLoaded(true);
    if (r && ['accepted', 'onboard', 'completed'].includes(r.status)) setDriver(await landRideDriver(id).catch(() => null));
  }, [id]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (!loaded) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!ride) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: space(5) }}>
        <Note>{t('landNotFound')}</Note>
        <Button variant="tile" label={t('backLbl')} onPress={() => router.replace('/trips')} />
      </SafeAreaView>
    );
  }

  const step = stepOf(ride);
  const carHere = driver?.lat != null && driver?.lon != null ? { lat: driver.lat, lon: driver.lon } : null;
  const toward = step === 'onboard' ? ride.dropoff : ride.pickup;
  const etaMin = carHere ? driveMinutes(roadKm(carHere, toward)) : null;
  const center = carHere ?? ride.pickup;

  const title: Record<string, string> = {
    awaiting_payment: t('landStAwait'),
    cancelled: t('landStCancelled'),
    paid: ride.timing === 'scheduled' ? t('landStBooked') : t('landStFinding'),
    accepted: t('landStComing'),
    arrived: t('landStArrived'),
    onboard: t('landStOnboard'),
    completed: t('landStDone'),
  };

  async function payNow() {
    setBusy(true);
    setErr('');
    try {
      const { outcome } = await pay({ landRideId: ride!.id }, `/land/${ride!.id}`);
      if (outcome === 'cancelled') setErr(t('payCancelled'));
      if (outcome === 'failed') setErr(t('payFailed'));
      await load();
    } catch (e) {
      setErr(e instanceof Error && e.message === 'payments_not_configured' ? t('payNotReady') : t('payFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setErr('');
    try {
      await cancelLandRide(ride!.id);
      setConfirmCancel(false);
      await load();
    } catch {
      setErr(t('landCantCancel'));
    } finally {
      setBusy(false);
    }
  }

  const doneIdx = STEPS.indexOf(step as Step);
  const canCancel = ['awaiting_payment', 'paid', 'accepted'].includes(ride.status) && step !== 'arrived';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.back, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>

        <Text style={[type.h1, { color: c.ink }]}>{title[step]}</Text>
        {etaMin != null && (step === 'accepted' || step === 'onboard') ? (
          <Text style={[type.bodyStrong, { color: c.flame }]}>
            {(step === 'accepted' ? t('landEtaPickup') : t('landEtaDrop')).replace('{m}', String(etaMin))}
          </Text>
        ) : null}

        <View style={[styles.mapWrap, { height: Math.round(height * 0.34) }]}>
          <LiveMap
            center={{ latitude: center.lat, longitude: center.lon }}
            rangeMiles={2}
            boats={[]}
            docks={[]}
            route={[]}
            diveSites={[]}
            satellite={false}
            onBoatPress={() => {}}
            onDivePress={() => {}}
            cars={carHere ? [{ id: 'mine', kind: driver!.vehicleKind, available: false, mine: true, ...carHere }] : []}
            pins={[
              { id: 'pu', kind: 'pickup', lat: ride.pickup.lat, lon: ride.pickup.lon },
              { id: 'do', kind: 'dropoff', lat: ride.dropoff.lat, lon: ride.dropoff.lon },
            ]}
          />
        </View>

        {step !== 'awaiting_payment' && step !== 'cancelled' && (
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepRow}>
                <View style={[styles.stepDot, { backgroundColor: i <= doneIdx ? c.flame : c.tile2 }]} />
                <Text style={[type.small, { color: i <= doneIdx ? c.ink : c.muted, fontWeight: i === doneIdx ? '700' : '400' }]}>{t(`landStep_${s}`)}</Text>
              </View>
            ))}
          </View>
        )}

        {driver && (step === 'accepted' || step === 'arrived' || step === 'onboard') && (
          <Card>
            <View style={styles.driverRow}>
              <View style={[styles.avatar, { backgroundColor: c.ink }]}>
                <Ionicons name="person" size={22} color={c.onInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{driver.name}</Text>
                <Note>
                  {[driver.color, driver.vehicleName].filter(Boolean).join(' ')}
                </Note>
              </View>
              {driver.plate ? (
                <View style={[styles.plate, { borderColor: c.ink }]}>
                  <Text style={[type.label, { color: c.ink, letterSpacing: 1 }]}>{driver.plate}</Text>
                </View>
              ) : null}
            </View>
            {driver.whatsapp ? (
              <Button small variant="ink" label={t('waBtn')} onPress={() => Linking.openURL(`https://wa.me/${driver.whatsapp!.replace(/\D/g, '')}`)} />
            ) : null}
            <Note>{t('landCheckPlate')}</Note>
          </Card>
        )}

        <Card>
          <View style={styles.legRow}>
            <View style={[styles.dotFrom, { backgroundColor: c.ink }]} />
            <Text style={[type.body, { color: c.ink, flex: 1 }]}>{ride.pickup.label}</Text>
          </View>
          <View style={styles.legRow}>
            <View style={[styles.dotTo, { backgroundColor: c.flame }]} />
            <Text style={[type.body, { color: c.ink, flex: 1 }]}>{ride.dropoff.label}</Text>
          </View>
          <Note>
            {t(ride.vehicle === 'van' ? 'landVan' : 'landCar')} · {ride.riders} {t('u_rider').toLowerCase()} · {ride.km.toFixed(1)} km
            {ride.scheduledFor ? ` · ${clock(new Date(ride.scheduledFor), i18n.language)}` : ''} · {usd(ride.fareUsd)}
          </Note>
        </Card>

        {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
        {ride.status === 'awaiting_payment' && <Button label={t('payBtn')} trailing={usd(ride.fareUsd)} loading={busy} onPress={payNow} />}
        {step === 'completed' && <Button variant="ink" label={t('landAnother')} onPress={() => router.replace('/')} />}

        {canCancel && !confirmCancel && <Button variant="tile" label={t('landCancel')} onPress={() => setConfirmCancel(true)} />}
        {confirmCancel && (
          <Card>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{t('landCancelQ')}</Text>
            <Note>{ride.status === 'accepted' ? t('landCancelNoRefund') : ride.status === 'paid' ? t('landCancelRefund') : t('landCancelFree')}</Note>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <Button small variant="sos" label={t('landCancelYes')} loading={busy} onPress={cancel} style={{ flex: 1 }} />
              <Button small variant="tile" label={t('landCancelNo')} onPress={() => setConfirmCancel(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#11618A' },
  steps: { gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  plate: { borderWidth: 2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  dotFrom: { width: 9, height: 9, borderRadius: 5 },
  dotTo: { width: 9, height: 9 },
});
