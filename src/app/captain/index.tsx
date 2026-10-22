import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS } from '../../../supabase/functions/_shared/geo.ts';
import { FEATURE_SETTINGS, type SeaArea, type SeaState } from '../../../supabase/functions/_shared/features.ts';
import { GuestsOnTheWay } from '@/components/GuestsOnTheWay';
import { LanguageButton } from '@/components/LanguageButton';
import { Button, Card, Note } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { acceptRide, advanceRide, confirmRide, myBoat, openRides, setOnline } from '@/lib/api';
import { clock, usd } from '@/lib/format';
import { CREW } from '../../../supabase/functions/_shared/crew.ts';
import { demoSetHelm, myHelm, type Helm } from '@/lib/crew';
import { reportSea } from '@/lib/stay';
import { useNow } from '@/lib/useNow';
import { SEA_COLOR } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';
import type { Ride } from '@/types';

/**
 * Captain app. Captains drive three of the seven week-stay features:
 * guaranteed pickup (accept + "On my way"), night rides (lit boats only) and sea reports.
 */
export default function Captain() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [boat, setBoat] = useState<{ id: string; name: string; seats: number } | null>(null);
  const [online, setOn] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [msg, setMsg] = useState('');
  const nowDate = useNow(15_000);
  const [reported, setReported] = useState<Partial<Record<SeaArea, SeaState>>>({});
  const [helm, setHelm] = useState<Helm | null>(null);
  const loadHelm = useCallback(() => {
    myHelm().then(setHelm).catch(() => {});
  }, []);

  const load = useCallback(() => {
    openRides().then(setRides).catch(() => {});
  }, []);
  useEffect(() => {
    myBoat().then(setBoat).catch(() => {});
    loadHelm();
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load, loadHelm]);

  async function toggle() {
    if (!boat) return;
    try {
      if (!online && Platform.OS !== 'web') {
        const { startSharing } = await import('@/lib/captainLocation');
        const r = await startSharing(boat.id, { title: t('onlineNow'), body: t('bgLocNote') });
        if (r !== 'started') return setMsg(t('locDenied'));
      } else if (online && Platform.OS !== 'web') {
        const { stopSharing } = await import('@/lib/captainLocation');
        await stopSharing();
      }
      await setOnline(boat.id, !online);
      setOn(!online);
      setMsg(!online ? t('onlineNow') : t('offlineNow'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function act(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    load();
  }

  async function sea(area: SeaArea, state: SeaState) {
    await act(() => reportSea(area, state));
    setReported((r) => ({ ...r, [area]: state }));
  }

  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;
  const now = nowDate.getTime();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }}>
        <View style={styles.head}>
          <Text style={[type.h1, { color: c.ink }]}>{t('captain_title')}</Text>
          <LanguageButton />
        </View>
        {/* Who is at the helm (crew roster). Live: linked by the office; demo: pick a name. */}
        <Card>
          {helm?.status === 'ok' ? (
            <>
              <Text style={[type.label, { color: c.muted }]}>{t('helmH')}</Text>
              <View style={styles.helmRow}>
                <Text style={[type.h2, { color: c.ink, flex: 1 }]}>{helm.crew.name}</Text>
                {helm.crew.certified ? (
                  <Text style={[type.label, { color: '#16A34A' }]}>✓ {t('certified')}</Text>
                ) : (
                  <Text style={[type.label, { color: c.sos }]}>{t('licencePending')}</Text>
                )}
              </View>
              {!helm.crew.certified && <Note>{t('helmUnverified')}</Note>}
              {DEMO_MODE && <Button small variant="tile" label={t('helmChange')} onPress={() => { demoSetHelm(null); loadHelm(); }} />}
            </>
          ) : helm?.status === 'pick' ? (
            <>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{t('helmPick')}</Text>
              <View style={styles.helmWrap}>
                {CREW.filter((m) => m.roles.includes('taxi')).map((m) => (
                  <Pressable key={m.id} accessibilityRole="button" onPress={() => { demoSetHelm(m.id); loadHelm(); }} style={[styles.helmChip, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]}>
                    <Text style={[type.label, { color: c.ink }]}>{m.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : helm?.status === 'unlinked' ? (
            <Note>{t('helmUnlinked')}</Note>
          ) : null}
        </Card>

        <Card>
          <Text style={[type.bodyStrong, { color: c.ink }]}>{boat?.name ?? '—'}</Text>
          <Button variant={online ? 'ink' : 'brand'} label={online ? t('goOffline') : t('goOnline')} onPress={toggle} />
          {msg ? <Note>{msg}</Note> : <Note>{t('bgLocNote')}</Note>}
        </Card>

        <GuestsOnTheWay />

        <Text style={[type.h2, { color: c.ink }]}>{t('seaTitle')}</Text>
        {(['west', 'north', 'south'] as const).map((area) => (
          <View key={area} style={styles.seaRow}>
            <Text style={[type.bodyStrong, { color: c.ink, width: 70 }]}>{t(`area_${area}`)}</Text>
            {(['calm', 'choppy', 'rough'] as const).map((s) => {
              const on = reported[area] === s;
              return (
                <Pressable key={s} accessibilityRole="button" onPress={() => sea(area, s)} style={[styles.seaBtn, { backgroundColor: on ? SEA_COLOR[s] : c.tile }]}>
                  <Text style={[type.label, { color: on ? '#fff' : c.ink }]}>{t(`sea_${s}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
        <Note>{t('seaUnknownMsg')}</Note>

        <Text style={[type.h2, { color: c.ink }]}>{t('incoming')}</Text>
        {rides.length === 0 && <Note>{t('noRequests')}</Note>}
        {rides.map((r) => {
          const pickup = r.pickupAt ? new Date(r.pickupAt) : new Date(r.createdAt);
          const confirmWindow = pickup.getTime() - now <= FEATURE_SETTINGS.guarantee.confirmMinutesBefore * 60_000;
          return (
            <Card key={r.id}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>
                {dockName(r.from)} → {dockName(r.to)}
              </Text>
              <Note>
                {clock(pickup, i18n.language)} · {r.riders} {t('u_rider').toLowerCase()} · {r.coveredByPass ? t('passCovered') : usd(r.fareUsd)}
                {r.hasKids ? ` · ${t('jackets')}` : ''}
                {r.needsTowels ? ` · ${t('towels')}` : ''}
              </Note>
              {r.needsLitBoat && <Text style={[type.small, { color: c.flame, fontWeight: '700' }]}>🌙 {t('needsLights')}</Text>}
              {r.status === 'paid' && <Button small label={t('accept')} onPress={() => act(() => acceptRide(r.id))} />}
              {r.status === 'accepted' && !r.captainConfirmed && (
                <>
                  <Button small label={t('onMyWay')} onPress={() => act(() => confirmRide(r.id))} />
                  <Note>{confirmWindow ? t('confirmNow') : t('confirmBy').replace('{m}', String(FEATURE_SETTINGS.guarantee.confirmMinutesBefore))}</Note>
                </>
              )}
              {r.status === 'accepted' && r.captainConfirmed && <Button small label={t('pickedUp')} onPress={() => act(() => advanceRide(r.id, 'onboard'))} />}
              {r.status === 'onboard' && <Button small variant="ink" label={t('complete')} onPress={() => act(() => advanceRide(r.id, 'completed'))} />}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seaRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  helmRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  helmWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  helmChip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  seaBtn: { flex: 1, alignItems: 'center', borderRadius: radius.pill, paddingVertical: 9 },
});
