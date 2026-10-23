import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { PORTS } from '../../supabase/functions/_shared/cruise.ts';
import { DOCKS } from '../../supabase/functions/_shared/geo.ts';
import { gettingThere, meetingPoint, timingFor, vanLeavesAt } from '../../supabase/functions/_shared/transport.ts';
import { Card, Note } from '@/components/ui';
import { guestsOnTheWay, type GuestOnTheWay } from '@/lib/api';
import { islandClock } from '@/lib/cruise';
import { useNow } from '@/lib/useNow';
import { radius, space, type, useTheme } from '@/theme';

const dockName = (id?: string) => DOCKS.find((d) => d.id === id)?.name ?? id ?? '';

function destinationOf(g: GuestOnTheWay) {
  if (g.kind === 'ride') {
    const d = DOCKS.find((x) => x.id === g.fromDock);
    return d ? { lat: d.lat, lon: d.lon } : null;
  }
  // Van guests have to reach the van at their port gate.
  if (g.vanPickupAt && g.shipPort) return { lat: PORTS[g.shipPort].lat, lon: PORTS[g.shipPort].lon };
  return g.area ? meetingPoint({ area: g.area }) : null;
}

/** Crew app: today's paid guests, where they are (if they share it) and whether they will make it. */
export function GuestsOnTheWay() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const now = useNow(30_000);
  const [rows, setRows] = useState<GuestOnTheWay[] | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    guestsOnTheWay()
      .then((r) => {
        setRows(r);
        setErr('');
      })
      .catch((e) => setErr(String((e as Error)?.message ?? e).includes('crew_only') ? t('otwCrewOnly') : t('otwFailed')));
  }, [t]);
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const clock = (iso: string) => islandClock(new Date(iso), i18n.language);
  const upcoming = (rows ?? []).filter((g) => new Date(g.startsAt).getTime() > now.getTime() - 30 * 60_000);

  return (
    <>
      <Text style={[type.h2, { color: c.ink }]}>{t('otwH')}</Text>
      {err ? <Note>{err}</Note> : rows && upcoming.length === 0 ? <Note>{t('otwNone')}</Note> : null}
      {upcoming.map((g) => {
        const dest = destinationOf(g);
        const start = g.vanPickupAt ? vanLeavesAt(new Date(g.vanPickupAt)) : new Date(g.startsAt);
        const plan = g.lat != null && g.lon != null && dest ? gettingThere({ lat: g.lat, lon: g.lon }, dest, g.people) : null;
        const timing = plan?.best ? timingFor(now, start, plan.best.minutes) : null;
        const ago = g.positionAt ? Math.max(0, Math.round((now.getTime() - new Date(g.positionAt).getTime()) / 60_000)) : null;
        const status = plan?.arrived ? 'here' : timing?.status ?? null;
        const badge =
          status === 'here' ? { label: t('otwHere'), bg: '#E8F7EE', fg: '#14532D' }
          : status === 'late' ? { label: t('otwLate').replace('{m}', String(timing!.minutesLate)), bg: '#FDECEA', fg: '#5a1a12' }
          : status === 'leave_now' ? { label: t('otwTight'), bg: '#FFF4E5', fg: '#663C00' }
          : status === 'early' ? { label: t('otwOnTime'), bg: '#E8F7EE', fg: '#14532D' }
          : { label: t('otwNoLocation'), bg: c.tile, fg: c.muted };
        return (
          <Card key={`${g.kind}-${g.tripId}`}>
            <View style={styles.top}>
              <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>
                {g.guestName || t('otwGuest')} · {g.people} {t('u_person').toLowerCase()}
              </Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[type.label, { color: badge.fg }]}>{badge.label}</Text>
              </View>
            </View>
            <Note>
              {g.kind === 'ride' ? `🛥 ${dockName(g.fromDock)} → ${dockName(g.toDock)}` : `🎣 ${g.title ?? ''} · ${g.area ?? ''}`} · {clock(g.startsAt)}
            </Note>
            {g.shipName ? <Note>🚢 {g.shipName}</Note> : null}
            {g.vanPickupAt ? (
              <Note>
                🚐 {t('otwVan').replace('{t}', `${clock(g.vanPickupAt)}–${islandClock(vanLeavesAt(new Date(g.vanPickupAt)), i18n.language)}`).replace('{b}', g.vanReturnAt ? clock(g.vanReturnAt) : '—')}
              </Note>
            ) : null}
            {plan && !plan.arrived ? (
              <Note>
                📍 {plan.km < 1 ? `${Math.round(plan.km * 1000)} m` : `${plan.km.toFixed(1)} km`}
                {plan.best ? ` · ~${plan.best.minutes} min (${t(`otwBy_${plan.best.mode}`)})` : ''}
                {ago != null ? ` · ${t('otwAgo').replace('{m}', String(ago))}` : ''}
              </Note>
            ) : null}
            <View style={styles.actions}>
              {g.guestWhatsapp ? (
                <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`https://wa.me/${g.guestWhatsapp!.replace(/\D/g, '')}`)} style={[styles.chip, { backgroundColor: c.ink }]}>
                  <Ionicons name="logo-whatsapp" size={14} color={c.onInk} />
                  <Text style={[type.label, { color: c.onInk }]}>WhatsApp</Text>
                </Pressable>
              ) : null}
              {g.lat != null && g.lon != null ? (
                <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lon}`)} style={[styles.chip, { backgroundColor: c.tile }]}>
                  <Ionicons name="map" size={14} color={c.ink} />
                  <Text style={[type.label, { color: c.ink }]}>{t('gtMap')}</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
});
