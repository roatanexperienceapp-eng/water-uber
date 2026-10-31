import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Note } from '@/components/ui';
import { clock, usd } from '@/lib/format';
import {
  acceptLandRide, advanceLandRide, arrivedLandRide, driverRides, landRideGuest, myVehicle, setVehicleOnline,
  type DriverRide, type MyVehicle,
} from '@/lib/driver';
import { space, type, useTheme } from '@/theme';

const ERR: Record<string, string> = {
  license_not_verified: 'drvErrLicense',
  finish_current_ride: 'drvErrBusy',
  ride_not_available: 'drvErrTaken',
  vehicle_too_small: 'drvErrSmall',
};

/** Crew app, land taxi drivers: go online, take paid rides, arrived → picked up → done. */
export function DriverPanel() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [car, setCar] = useState<MyVehicle | null | undefined>(undefined);
  const [online, setOnline] = useState(false);
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [guestFor, setGuestFor] = useState<{ rideId: string; name: string; whatsapp?: string } | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    driverRides().then(setRides).catch(() => {});
  }, []);
  useEffect(() => {
    myVehicle().then(setCar).catch(() => setCar(null));
  }, []);
  useEffect(() => {
    if (!car) return;
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [car, load]);

  const current = rides.find((r) => r.mine && (r.status === 'accepted' || r.status === 'onboard')) ?? null;
  const open = rides.filter((r) => !r.mine && r.status === 'paid');
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    landRideGuest(currentId).then((g) => g && setGuestFor({ rideId: currentId, ...g })).catch(() => {});
  }, [currentId]);
  const guest = guestFor && guestFor.rideId === currentId ? guestFor : null;

  if (car === undefined) return null; // still loading
  if (car === null) {
    // Not linked to a vehicle yet: say so instead of hiding the section.
    return (
      <>
        <Text style={[type.h2, { color: c.ink }]}>{t('drvH')}</Text>
        <Card>
          <View style={styles.row}>
            <Ionicons name="car" size={22} color={c.muted} />
            <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('drvNotSetUp')}</Text>
          </View>
          <Note>{t('drvNotSetUpHint')}</Note>
        </Card>
      </>
    );
  }

  async function toggle() {
    if (!car) return;
    try {
      if (!online && Platform.OS !== 'web') {
        const { startSharing } = await import('@/lib/captainLocation');
        const r = await startSharing(car.id, { title: t('drvOnline'), body: t('bgLocNote') }, 'vehicle');
        if (r !== 'started') return setMsg(t('locDenied'));
      } else if (online && Platform.OS !== 'web') {
        const { stopSharing } = await import('@/lib/captainLocation');
        await stopSharing();
      }
      await setVehicleOnline(car.id, !online).catch(() => {});
      setOnline(!online);
      setMsg(!online ? t('drvOnline') : t('offlineNow'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      setMsg('');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      const key = Object.keys(ERR).find((k) => code.includes(k));
      setMsg(key ? t(ERR[key]) : code);
    }
    load();
  }

  const nav = (r: DriverRide) => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${r.pickupLat},${r.pickupLon}&travelmode=driving`);
  const when = (r: DriverRide) => (r.scheduledFor ? clock(new Date(r.scheduledFor), i18n.language) : t('now'));

  return (
    <>
      <Text style={[type.h2, { color: c.ink }]}>{t('drvH')}</Text>
      <Card>
        <View style={styles.row}>
          <Ionicons name={car.kind === 'van' ? 'bus' : 'car'} size={22} color={c.flame} />
          <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>
            {car.name}
            {car.plate ? ` · ${car.plate}` : ''}
          </Text>
          {car.certified ? (
            <Text style={[type.label, { color: '#16A34A' }]}>✓ {t('certified')}</Text>
          ) : (
            <Text style={[type.label, { color: c.sos }]}>{t('licencePending')}</Text>
          )}
        </View>
        <Button variant={online ? 'ink' : 'brand'} label={online ? t('goOffline') : t('goOnline')} onPress={toggle} />
        {msg ? <Note>{msg}</Note> : !car.certified ? <Note>{t('drvUnverified')}</Note> : null}
      </Card>

      {current && (
        <Card style={{ borderWidth: 2, borderColor: c.flame }}>
          <Text style={[type.label, { color: c.flame }]}>{t('drvCurrent')}</Text>
          <Text style={[type.bodyStrong, { color: c.ink }]}>
            {current.pickupLabel} → {current.dropoffLabel}
          </Text>
          <Note>
            {guest?.name || t('otwGuest')} · {current.riders} {t('u_rider').toLowerCase()} · {usd(current.fareUsd)}
          </Note>
          <View style={styles.btns}>
            <Button small variant="tile" label={t('drvNavigate')} onPress={() => nav(current)} style={{ flex: 1 }} />
            {guest?.whatsapp ? (
              <Button small variant="tile" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${guest.whatsapp!.replace(/\D/g, '')}`)} style={{ flex: 1 }} />
            ) : null}
          </View>
          {current.status === 'accepted' && !current.arrivedAt && <Button small label={t('drvArrived')} onPress={() => act(() => arrivedLandRide(current.id))} />}
          {current.status === 'accepted' && current.arrivedAt && <Button small label={t('pickedUp')} onPress={() => act(() => advanceLandRide(current.id, 'onboard'))} />}
          {current.status === 'onboard' && <Button small variant="ink" label={t('complete')} onPress={() => act(() => advanceLandRide(current.id, 'completed'))} />}
        </Card>
      )}

      {open.length === 0 ? (
        <Note>{t('drvNone')}</Note>
      ) : (
        open.map((r) => (
          <Card key={r.id}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>
              {r.pickupLabel} → {r.dropoffLabel}
            </Text>
            <Note>
              {when(r)} · {r.riders} {t('u_rider').toLowerCase()} · {t(r.vehicle === 'van' ? 'landVan' : 'landCar')} · {r.km.toFixed(1)} km · {usd(r.fareUsd)}
            </Note>
            <Button small label={t('accept')} disabled={!!current || !car.certified} onPress={() => act(() => acceptLandRide(r.id))} />
          </Card>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  btns: { flexDirection: 'row', gap: space(2) },
});
