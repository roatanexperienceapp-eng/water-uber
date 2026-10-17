import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS } from '../../../supabase/functions/_shared/geo.ts';
import { guaranteeState } from '../../../supabase/functions/_shared/features.ts';
import { Card, Note } from '@/components/ui';
import { cancelRide, listMyBookings, listMyRides } from '@/lib/api';
import { clock, usd } from '@/lib/format';
import { currentPass, myCredits, myRepeatRides, setRepeatActive, type GuestPass, type RepeatRide, type RideCredit } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';
import type { Booking, Ride } from '@/types';

const STATUS_KEY: Record<string, string> = {
  awaiting_payment: 'statusRequested',
  requested: 'statusRequested',
  quoted: 'statusQuoted',
  paid: 'statusPaid',
  accepted: 'statusAccepted',
  onboard: 'statusAccepted',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
};

export default function Trips() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [repeats, setRepeats] = useState<RepeatRide[]>([]);
  const [pass, setPass] = useState<GuestPass | null>(null);
  const [credits, setCredits] = useState<RideCredit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, b, rp, p, cr] = await Promise.all([
      listMyRides().catch(() => []),
      listMyBookings().catch(() => []),
      myRepeatRides().catch(() => []),
      currentPass().catch(() => null),
      myCredits().catch(() => []),
    ]);
    setRides(r);
    setBookings(b);
    setRepeats(rp);
    setPass(p);
    setCredits(cr);
    setLoading(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;
  const creditTotal = credits.filter((x) => !x.used).reduce((s, x) => s + x.amountUsd, 0);
  const empty = !rides.length && !bookings.length && !repeats.length && !pass;
  const now = new Date();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text style={[type.h1, { color: c.ink }]}>{t('trips_title')}</Text>

        {pass ? (
          <Pressable onPress={() => router.push('/pass')}>
            <Card style={{ backgroundColor: c.ink }}>
              <Text style={[type.label, { color: c.flame }]}>{t('passActive')}</Text>
              <Text style={[type.h2, { color: c.onInk }]}>{t(`pass_${pass.passId}`)}</Text>
              <Text style={[type.small, { color: c.onInk, opacity: 0.8 }]}>
                {t('passExpires').replace('{d}', shortDate(pass.expiresAt, i18n.language))} ·{' '}
                {pass.ridesLeft === null ? t('passUnlimited') : t('passLeft').replace('{n}', String(pass.ridesLeft))}
              </Text>
            </Card>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/pass')} style={[styles.promo, { backgroundColor: c.tile }]}>
            <Ionicons name="ticket-outline" size={20} color={c.flame} />
            <Text style={[type.small, { color: c.ink, flex: 1 }]}>{t('passIntro')}</Text>
            <Text style={[type.label, { color: c.flame, fontSize: 14 }]}>{t('passSeeOptions')} ›</Text>
          </Pressable>
        )}

        {creditTotal > 0 && (
          <Card>
            <Text style={[type.bodyStrong, { color: c.ink }]}>
              {t('credits')}: {usd(creditTotal)}
            </Text>
            <Note>{t('g_missed')}</Note>
          </Card>
        )}

        {empty && <Note>{t('trips_empty')}</Note>}

        {repeats.length > 0 && <Text style={[type.h2, { color: c.ink }]}>{t('repeatList')}</Text>}
        {repeats.map((r) => (
          <View key={r.id} style={[styles.item, { borderBottomColor: c.line }]}>
            <Ionicons name="repeat" size={20} color={r.active ? c.flame : c.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>
                {dockName(r.from)} → {dockName(r.to)}
              </Text>
              <Note>
                {r.weekdays.length ? r.weekdays.map((d) => t(`wd${d}`)).join(' ') : t('everyDay')} · {clock(new Date(`2026-01-01T${r.time.slice(0, 5)}:00`), i18n.language)} ·{' '}
                {t('perRide').replace('{p}', r.coveredByPass ? t('included') : usd(r.farePerRide))}
              </Note>
              <Note>
                {r.startDate} → {r.endDate}
              </Note>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await setRepeatActive(r.id, !r.active).catch(() => {});
                void load();
              }}
              style={[styles.small, { backgroundColor: c.tile }]}
            >
              <Text style={[type.label, { color: c.ink }]}>{r.active ? t('pause') : t('resume')}</Text>
            </Pressable>
          </View>
        ))}

        {rides.length > 0 && <Text style={[type.h2, { color: c.ink }]}>{t('rides_h')}</Text>}
        {rides.map((r) => {
          const pickup = r.pickupAt ? new Date(r.pickupAt) : new Date(r.createdAt);
          const live = !['completed', 'cancelled'].includes(r.status);
          const g = live && r.timing === 'scheduled' ? guaranteeState({ pickupAt: pickup, now, captainConfirmed: !!r.captainConfirmed, boarded: r.status === 'onboard' }) : null;
          return (
            <Pressable key={r.id} onPress={() => router.push({ pathname: '/confirmation', params: { kind: 'ride', id: r.id } })} style={[styles.item, { borderBottomColor: c.line }]}>
              <Ionicons name={r.needsLitBoat ? 'moon' : 'boat'} size={20} color={live ? c.flame : c.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>
                  {dockName(r.from)} → {dockName(r.to)}
                </Text>
                <Note>
                  {shortDate(pickup, i18n.language)} {clock(pickup, i18n.language)} · {r.coveredByPass ? t('passCovered') : usd(r.fareUsd)}
                </Note>
                <Text style={[type.small, { color: g === 'missed' || g === 'reassign' ? c.sos : c.ink, fontWeight: '600' }]}>
                  {g ? t(g === 'awaiting_confirm' ? 'g_scheduled' : `g_${g}`) : t(STATUS_KEY[r.status] ?? 'statusPaid')}
                </Text>
              </View>
              {live && r.status !== 'onboard' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    await cancelRide(r.id).catch(() => {});
                    void load();
                  }}
                  style={[styles.small, { backgroundColor: c.tile }]}
                >
                  <Text style={[type.label, { color: c.ink }]}>{t('cancel')}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {bookings.length > 0 && <Text style={[type.h2, { color: c.ink }]}>{t('bookings_h')}</Text>}
        {bookings.map((b) => {
          const linked = rides.filter((r) => r.bookingId === b.id).length;
          return (
            <Pressable key={b.id} onPress={() => router.push({ pathname: '/confirmation', params: { kind: 'booking', id: b.id, taxi: linked ? '1' : '0', paid: b.status === 'paid' ? '1' : '0' } })} style={[styles.item, { borderBottomColor: c.line }]}>
              <Ionicons name="compass" size={20} color={c.flame} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{b.listingName}</Text>
                <Note>
                  {b.date} {b.time} · {b.totalUsd != null ? usd(b.totalUsd) : t('byOperator')}
                  {linked ? ` · ${t('withTaxi')}` : ''}
                </Note>
                <Text style={[type.small, { color: c.ink, fontWeight: '600' }]}>{t(STATUS_KEY[b.status] ?? 'statusPaid')}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderBottomWidth: 1 },
  small: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(3) },
});
