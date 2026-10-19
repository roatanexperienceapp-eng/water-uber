import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS } from '../../../supabase/functions/_shared/geo.ts';
import { guaranteeState } from '../../../supabase/functions/_shared/features.ts';
import { useNetInfo } from '@react-native-community/netinfo';
import { Card, Note } from '@/components/ui';
import { pay } from '@/lib/payments';
import { savedTickets, type SavedTicket } from '@/lib/tickets';
import { islandClock, islandDay, roatanInstant } from '@/lib/cruise';
import { cancelRide, listMyBookings, listMyRides } from '@/lib/api';
import { clock, usd } from '@/lib/format';
import { currentPass, myCredits, myRepeatRides, setRepeatActive, type GuestPass, type RepeatRide, type RideCredit } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { passName } from '@/lib/passName';
import { radius, space, type, useTheme } from '@/theme';
import type { Booking, Ride } from '@/types';

const STATUS_KEY: Record<string, string> = {
  awaiting_payment: 'statusAwaitingPay',
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
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const net = useNetInfo();
  const offline = net.isConnected === false;

  const load = useCallback(async () => {
    setLoading(true);
    setTickets(savedTickets()); // from the phone: shows even with no signal
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
  async function payItem(target: { rideId: string } | { bookingId: string }, kind: 'ride' | 'booking', id: string) {
    setPayingId(id);
    try {
      await pay(target, `/confirmation?kind=${kind}&id=${encodeURIComponent(id)}`);
    } catch {
      // The confirmation screen and the next refresh show the real status.
    } finally {
      setPayingId(null);
      void load();
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;
  const creditTotal = credits.filter((x) => !x.used).reduce((s, x) => s + x.amountUsd, 0);
  const empty = !rides.length && !bookings.length && !repeats.length && !pass && !tickets.length;
  const now = new Date();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text style={[type.h1, { color: c.ink }]}>{t('trips_title')}</Text>

        {/* Three small portals: travel talk, marine life, feedback */}
        <View style={styles.portals}>
          {([
            { path: '/community', icon: 'chatbubbles', bg: '#1D4ED8', label: t('tileTalk'), sub: t('tileTalkSub') },
            { path: '/marine', icon: 'fish', bg: '#0E7490', label: t('tileMarine'), sub: t('tileMarineSub') },
            { path: '/feedback', icon: 'star', bg: '#B45309', label: t('tileFeedback'), sub: t('tileFeedbackSub') },
          ] as const).map((x) => (
            <Pressable key={x.path} accessibilityRole="button" accessibilityLabel={x.label} onPress={() => router.push(x.path)} style={({ pressed }) => [styles.portal, { backgroundColor: c.tile, opacity: pressed ? 0.7 : 1 }]}>
              <View style={[styles.portalIcon, { backgroundColor: x.bg }]}>
                <Ionicons name={x.icon} size={18} color="#fff" />
              </View>
              <Text style={[type.label, { color: c.ink, fontSize: 13 }]} numberOfLines={1}>{x.label}</Text>
              <Text style={[type.small, { color: c.muted, fontSize: 11, lineHeight: 14 }]} numberOfLines={2}>{x.sub}</Text>
            </Pressable>
          ))}
        </View>

        {offline && (
          <View style={[styles.promo, { backgroundColor: '#FFF4E5' }]}>
            <Ionicons name="cloud-offline" size={20} color="#B45309" />
            <Text style={[type.small, { color: '#5a3b0a', flex: 1 }]}>{t('offlineNote')}</Text>
          </View>
        )}

        {tickets.length > 0 && (
          <View style={{ gap: space(2) }}>
            <Text style={[type.h2, { color: c.ink }]}>
              {t('ticketsH')} <Text style={[type.label, { color: '#16A34A' }]}>✓ {t('worksOffline')}</Text>
            </Text>
            {tickets.map((tk) => (
              <Pressable key={tk.bookingId} onPress={() => router.push(`/ticket/${tk.bookingId}`)} style={[styles.ticket, { backgroundColor: c.ink }]}>
                <Ionicons name="qr-code" size={28} color={c.onInk} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.onInk }]}>{tk.title}</Text>
                  <Text style={[type.small, { color: c.onInk, opacity: 0.8 }]}>
                    {islandDay(roatanInstant(tk.date, tk.time), i18n.language)} · {islandClock(roatanInstant(tk.date, tk.time), i18n.language)} · {tk.ticketCode}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.onInk} />
              </Pressable>
            ))}
          </View>
        )}

        {pass ? (
          <Pressable onPress={() => router.push('/pass')}>
            <Card style={{ backgroundColor: c.ink }}>
              <Text style={[type.label, { color: c.flame }]}>{t('passActive')}</Text>
              <Text style={[type.h2, { color: c.onInk }]}>{passName(t, pass.passId)}</Text>
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
              {r.status === 'awaiting_payment' && !r.bookingId ? (
                <Pressable accessibilityRole="button" disabled={payingId === r.id} onPress={() => payItem({ rideId: r.id }, 'ride', r.id)} style={[styles.small, { backgroundColor: c.flame }]}>
                  <Text style={[type.label, { color: '#fff' }]}>{t('payBtn')} {usd(r.fareUsd)}</Text>
                </Pressable>
              ) : null}
              {r.status === 'awaiting_payment' && r.bookingId ? <Text style={[type.label, { color: c.muted }]}>{t('payWithTour')}</Text> : null}
              {live && r.status !== 'onboard' && !(r.status === 'awaiting_payment' && r.bookingId) ? (
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
            <Pressable key={b.id} onPress={() => router.push({ pathname: '/confirmation', params: { kind: 'booking', id: b.id } })} style={[styles.item, { borderBottomColor: c.line }]}>
              <Ionicons name="compass" size={20} color={c.flame} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{b.listingName}</Text>
                <Note>
                  {b.date} {b.time} · {b.totalUsd != null ? usd(b.totalUsd) : t('byOperator')}
                  {linked ? ` · ${t('withTaxi')}` : ''}
                </Note>
                <Text style={[type.small, { color: c.ink, fontWeight: '600' }]}>{b.isSplit && b.status === 'awaiting_payment' ? t('splitHeld') : t(STATUS_KEY[b.status] ?? 'statusPaid')}</Text>
              </View>
              {(b.status === 'quoted' || b.status === 'awaiting_payment') && b.totalUsd != null && !b.isSplit ? (
                <Pressable accessibilityRole="button" disabled={payingId === b.id} onPress={() => payItem({ bookingId: b.id }, 'booking', b.id)} style={[styles.small, { backgroundColor: c.flame }]}>
                  <Text style={[type.label, { color: '#fff' }]}>{t('payBtn')}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  portals: { flexDirection: 'row', gap: space(2) },
  portal: { flex: 1, borderRadius: radius.lg, padding: space(3), gap: 4, minHeight: 104 },
  portalIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderBottomWidth: 1 },
  small: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(4) },
  promo: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(3) },
});
