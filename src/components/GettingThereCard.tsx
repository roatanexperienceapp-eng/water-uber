import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BUSINESS } from '../../supabase/functions/_shared/business.ts';
import { DOCKS } from '../../supabase/functions/_shared/geo.ts';
import { gettingThere, timingFor, VAN_SETTINGS, vanLeavesAt, type MoveOption, type Point } from '../../supabase/functions/_shared/transport.ts';
import { Button, Note } from '@/components/ui';
import { sharePosition, stopSharingPosition } from '@/lib/api';
import { islandClock } from '@/lib/cruise';
import { usd } from '@/lib/format';
import { readJSON, writeJSON } from '@/lib/localStore';
import { useNow } from '@/lib/useNow';
import { radius, space, type, useTheme } from '@/theme';

/** Show the card from this long before the start until the start. */
const SHOW_HOURS_BEFORE = 6;
/** While sharing, send the position this often (only while the screen is open). */
const SHARE_EVERY_MS = 2 * 60_000;
const SHARE_KEY = 'share.position.v1';

export interface GettingThereProps {
  /** Ticket or ride id: remembers the guest's sharing choice for this trip. */
  tripId: string;
  title: string;
  start: Date;
  dest: (Point & { dockId?: string }) | null;
  destName: string;
  riders: number;
  /** Our van is booked: show its time instead of telling the guest how to get there. */
  vanPickupAt?: string;
}

const dockName = (id?: string) => DOCKS.find((d) => d.id === id)?.name ?? id ?? '';

/**
 * Trip day: how far the guest is from the meeting point, how long each way takes, when to leave,
 * and buttons to book the water taxi, call our van or open directions. Optional: share location with our crew.
 */
export function GettingThereCard(p: GettingThereProps) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const now = useNow(30_000);
  const [here, setHere] = useState<Point | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [denied, setDenied] = useState(false);
  const [sharing, setSharing] = useState(() => readJSON<Record<string, boolean>>(SHARE_KEY, {})[p.tripId] === true);
  const [shareErr, setShareErr] = useState('');
  const asked = useRef(false);

  const visible = now.getTime() >= p.start.getTime() - SHOW_HOURS_BEFORE * 3_600_000 && now.getTime() < p.start.getTime();

  const locate = useCallback(async (ask: boolean) => {
    try {
      const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (ask) setDenied(true);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const pt = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setHere(pt);
      setAccuracy(pos.coords.accuracy ?? undefined);
      setDenied(false);
      return { pt, acc: pos.coords.accuracy ?? undefined };
    } catch {
      return null;
    }
  }, []);

  // Use the position without a prompt if the guest already allowed it.
  useEffect(() => {
    if (!visible || asked.current) return;
    asked.current = true;
    void locate(false);
  }, [visible, locate]);

  // Sharing: send now and every 2 minutes while this screen is open.
  useEffect(() => {
    if (!visible || !sharing) return;
    let alive = true;
    const send = async () => {
      const got = await locate(false);
      if (!alive || !got) return;
      try {
        await sharePosition(got.pt.lat, got.pt.lon, got.acc);
        setShareErr('');
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        setShareErr(msg.includes('off_island') ? t('shareOffIsland') : msg.includes('no_trip_today') ? t('shareNoTrip') : t('shareFailed'));
      }
    };
    void send();
    const id = setInterval(send, SHARE_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [visible, sharing, locate, t]);

  const toggleShare = async (on: boolean) => {
    if (on) {
      const got = await locate(true);
      if (!got) return;
    }
    setSharing(on);
    writeJSON(SHARE_KEY, { ...readJSON<Record<string, boolean>>(SHARE_KEY, {}), [p.tripId]: on });
    if (!on) {
      setShareErr('');
      stopSharingPosition().catch(() => {});
    }
  };

  if (!visible || !p.dest) return null;

  const plan = here ? gettingThere(here, p.dest, p.riders) : null;
  const clock = (d: Date) => islandClock(d, i18n.language);
  const km = plan ? plan.km : null;
  const best = plan?.best ?? null;
  const timing = best ? timingFor(now, p.start, best.minutes) : null;
  const vanAt = p.vanPickupAt ? new Date(p.vanPickupAt) : null;

  const modeLabel = (o: MoveOption) =>
    o.mode === 'walk'
      ? t('moveWalk').replace('{m}', String(o.minutes))
      : o.mode === 'taxi'
        ? t('moveTaxi').replace('{m}', String(o.minutes)).replace('{dock}', dockName(o.fromDock)).replace('{p}', usd(o.fareUsd ?? 0))
        : t('moveVan').replace('{m}', String(o.minutes));
  const modeIcon = (o: MoveOption) => (o.mode === 'walk' ? 'walk' : o.mode === 'taxi' ? 'boat' : 'bus') as 'walk' | 'boat' | 'bus';

  const bookTaxi = (o: MoveOption) =>
    router.push({ pathname: '/checkout', params: { kind: 'ride', from: o.fromDock, to: o.toDock, riders: String(Math.min(p.riders, 12)), mode: 'private', timing: 'now' } });
  const callVan = () => {
    const msg = t('vanWaMsg').replace('{trip}', p.title).replace('{t}', clock(p.start));
    const where = here ? ` https://maps.google.com/?q=${here.lat.toFixed(5)},${here.lon.toFixed(5)}` : '';
    void Linking.openURL(`https://wa.me/${BUSINESS.phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(msg + where)}`);
  };
  const directions = (mode: 'walking' | 'driving') =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.dest!.lat},${p.dest!.lon}&travelmode=${mode}`);

  const tone =
    timing?.status === 'late' ? { bg: '#FDECEA', fg: '#5a1a12', icon: 'alert-circle' as const, color: c.sos }
    : timing?.status === 'leave_now' ? { bg: '#FFF4E5', fg: '#663C00', icon: 'time' as const, color: '#B45309' }
    : { bg: '#E8F7EE', fg: '#14532D', icon: 'checkmark-circle' as const, color: '#16A34A' };

  return (
    <View style={[styles.card, { borderColor: c.line, backgroundColor: c.bg }]}>
      <View style={styles.head}>
        <Ionicons name="navigate" size={18} color={c.flame} />
        <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('gtH')}</Text>
        {km != null && <Text style={[type.label, { color: c.muted }]}>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</Text>}
      </View>
      <Text style={[type.small, { color: c.muted }]}>
        {p.destName} · {clock(p.start)}
      </Text>

      {vanAt ? (
        <View style={[styles.row, { backgroundColor: c.tile }]}>
          <Ionicons name="bus" size={20} color={c.flame} />
          <Text style={[type.small, { color: c.ink, flex: 1 }]}>
            {t('vanWindow').replace('{t}', clock(vanAt)).replace('{l}', clock(vanLeavesAt(vanAt))).replace('{m}', String(VAN_SETTINGS.waitMinutes))}
          </Text>
        </View>
      ) : null}

      {!here ? (
        <>
          <Note>{denied ? t('gtDenied') : t('gtAsk')}</Note>
          {!denied && <Button variant="ink" label={t('gtFind')} onPress={() => void locate(true)} />}
        </>
      ) : plan?.arrived ? (
        <View style={[styles.row, { backgroundColor: '#E8F7EE' }]}>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
          <Text style={[type.small, { color: '#14532D', flex: 1 }]}>{t('gtArrived')}</Text>
        </View>
      ) : !vanAt && best && timing ? (
        <>
          <View style={[styles.row, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={20} color={tone.color} />
            <Text style={[type.small, { color: tone.fg, flex: 1 }]}>
              {timing.status === 'late'
                ? t('gtLate').replace('{m}', String(timing.minutesLate))
                : timing.status === 'leave_now'
                  ? t('gtLeaveNow')
                  : t('gtLeaveBy').replace('{t}', clock(timing.leaveBy))}
            </Text>
          </View>
          {plan!.options.map((o) => (
            <View key={o.mode} style={[styles.option, { borderColor: o === best ? c.flame : c.line }]}>
              <Ionicons name={modeIcon(o)} size={18} color={o === best ? c.flame : c.ink} />
              <Text style={[type.small, { color: c.ink, flex: 1 }]}>
                {modeLabel(o)}
                {o === best ? ` · ${t('gtBest')}` : ''}
              </Text>
              {o.mode === 'taxi' ? (
                <Pressable accessibilityRole="button" onPress={() => bookTaxi(o)} style={[styles.chip, { backgroundColor: c.ink }]}>
                  <Text style={[type.label, { color: c.onInk }]}>{t('gtBook')}</Text>
                </Pressable>
              ) : o.mode === 'van' ? (
                <Pressable accessibilityRole="button" onPress={callVan} style={[styles.chip, { backgroundColor: c.ink }]}>
                  <Text style={[type.label, { color: c.onInk }]}>{t('gtCallVan')}</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => void directions('walking')} style={[styles.chip, { backgroundColor: c.ink }]}>
                  <Text style={[type.label, { color: c.onInk }]}>{t('gtMap')}</Text>
                </Pressable>
              )}
            </View>
          ))}
          {timing.status === 'late' && (
            <Pressable accessibilityRole="button" onPress={callVan}>
              <Text style={[type.small, { color: c.flame, fontWeight: '700' }]}>{t('gtTellUs')}</Text>
            </Pressable>
          )}
        </>
      ) : null}

      <View style={styles.switchRow}>
        <Ionicons name="location" size={18} color={c.flame} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: c.ink }]}>{t('shareH')}</Text>
          <Note>{t('shareHint')}</Note>
        </View>
        <Switch value={sharing} onValueChange={(v) => void toggleShare(v)} trackColor={{ true: c.flame }} />
      </View>
      {sharing && !shareErr && <Note>{t('shareOn')}{accuracy ? ` · ±${Math.round(accuracy)} m` : ''}</Note>}
      {shareErr ? <Text style={[type.small, { color: c.sos }]}>{shareErr}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space(4), gap: space(2) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radius.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radius.md, borderWidth: 1 },
  chip: { paddingHorizontal: space(3), paddingVertical: 6, borderRadius: 999 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingTop: space(2) },
});
