import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS, kmBetween, KM_PER_MILE, routeFor } from '../../../supabase/functions/_shared/geo.ts';
import { isFlatZone, needsFamilyBoat, PRICING, quoteFare, type RideMode, type RideTiming } from '../../../supabase/functions/_shared/pricing.ts';
import {
  conditionAdvice, FEATURE_SETTINGS, joinableBoats, nightMode, passCovers, routeCondition,
  type OpenSharedBoat, type SeaReport,
} from '../../../supabase/functions/_shared/features.ts';
import LiveMap from '@/components/LiveMap';
import { LanguageButton } from '@/components/LanguageButton';
import { CurrencyButton } from '@/components/CurrencyButton';
import { DockPicker } from '@/components/DockPicker';
import { ShipButton } from '@/components/ShipButton';
import { Button, Note, Segmented, Stepper } from '@/components/ui';
import { DEMO_MODE, HOME_CENTER } from '@/config';
import { LandHome } from '@/components/land/LandHome';
import { ServiceSwitch } from '@/components/land/ServiceSwitch';
import { useService } from '@/lib/service';
import { DIVE_SITES, type DiveSite } from '@/data/diveSites';
import { subscribeBoats } from '@/lib/api';
import { currentPass, openSharedBoats, savedPlaces, savePlace, seaReports, type GuestPass, type SavedPlace } from '@/lib/stay';
import { hourLabel, PLACE_ICONS, SEA_COLOR, WEEKDAYS } from '@/lib/stayUi';
import { clock, usd } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';
import type { LiveBoat } from '@/types';

const BOAT_MPH = 12;

function nextSlots(count: number): Date[] {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  d.setMinutes(d.getMinutes() + 30);
  return Array.from({ length: count }, (_, i) => new Date(d.getTime() + i * 30 * 60000));
}

/** Ride tab: water taxi or land taxi, picked with the switch at the top. */
export default function RideScreen() {
  const [service] = useService();
  return service === 'land' ? <LandHome /> : <WaterRide />;
}

function WaterRide() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const { height } = useWindowDimensions();

  const [boats, setBoats] = useState<LiveBoat[]>([]);
  const [from, setFrom] = useState('inf');
  const [to, setTo] = useState('we');
  const [mode, setMode] = useState<RideMode>('shared');
  const [timing, setTiming] = useState<RideTiming>('now');
  const [slot, setSlot] = useState(0);
  const [riders, setRiders] = useState(2);
  const [kids, setKids] = useState(false);
  const [towels, setTowels] = useState(false);
  const [range, setRange] = useState(7);
  const [satellite, setSatellite] = useState(true);
  const [center, setCenter] = useState(HOME_CENTER);
  const [picker, setPicker] = useState<null | 'from' | 'to'>(null);
  const [popup, setPopup] = useState<null | { kind: 'boat'; boat: LiveBoat } | { kind: 'dive'; site: DiveSite }>(null);
  const [locNote, setLocNote] = useState<string>(t('ctrWE'));
  // Week-stay features
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [pass, setPass] = useState<GuestPass | null>(null);
  const [reports, setReports] = useState<SeaReport[]>([]);
  const [shared, setShared] = useState<OpenSharedBoat[]>([]);
  const [joinId, setJoinId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatFor, setRepeatFor] = useState(6);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => subscribeBoats(setBoats), []);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  useFocusEffect(
    useCallback(() => {
      savedPlaces().then(setPlaces).catch(() => {});
      currentPass().then(setPass).catch(() => {});
      seaReports().then(setReports).catch(() => {});
    }, []),
  );
  useEffect(() => {
    let alive = true;
    const load = () => openSharedBoats(from, to).then((b) => alive && setShared(b)).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [from, to]);

  const slots = useMemo(() => nextSlots(16), [timing]);
  const route = useMemo(() => routeFor(from, to), [from, to]);
  const quote = useMemo(() => quoteFare({ from, to, riders, mode, timing }), [from, to, riders, mode, timing]);
  const flat = isFlatZone(from, to);

  const pickupMin = useMemo(() => {
    const dock = DOCKS.find((d) => d.id === from)!;
    let best = Infinity;
    for (const b of boats) {
      if (b.kind !== 'taxi' || !b.available) continue;
      best = Math.min(best, kmBetween([b.lon, b.lat], [dock.lon, dock.lat]));
    }
    return best === Infinity ? null : Math.max(1, Math.ceil((best / (BOAT_MPH * KM_PER_MILE)) * 60) + 1);
  }, [boats, from]);

  const start = timing === 'scheduled' ? slots[slot] : new Date(now.getTime() + (pickupMin ?? 5) * 60000);
  const arrive = new Date(start.getTime() + quote.rideMinutes * 60000);
  const inRange = boats.filter((b) => kmBetween([b.lon, b.lat], [center.longitude, center.latitude]) <= range * KM_PER_MILE).length;
  const dockName = (id: string) => DOCKS.find((d) => d.id === id)?.name ?? id;

  const night = nightMode(start);
  const cond = routeCondition(reports, from, to, now);
  const advice = conditionAdvice(cond.state);
  const condAgo = (() => {
    const times = reports.filter((r) => cond.areas.includes(r.area)).map((r) => now.getTime() - r.reportedAt.getTime());
    return times.length ? Math.max(1, Math.round(Math.min(...times) / 60_000)) : null;
  })();
  const cover = passCovers(pass, { from, to, riders, at: start });
  const covered = cover.covered;
  const nightExtra = night === 'night' ? FEATURE_SETTINGS.night.surchargePerRider * riders : 0;
  const price = covered ? cover.fareUsd : quote.total + nightExtra;
  const blocked = night === 'boats_closed' || advice === 'land_taxi';
  const joinable = flat && timing === 'now' && mode === 'shared' ? joinableBoats(shared, { from, to, riders, now }) : [];
  const joined = joinable.find((b) => b.id === joinId) ?? null;
  const minsUntil = (d: Date) => Math.max(1, Math.round((d.getTime() - now.getTime()) / 60_000));

  function goTo(dockId: string) {
    if (dockId === from) setFrom(to);
    setTo(dockId);
  }

  async function saveCurrent(label: string, icon: SavedPlace['icon']) {
    setSaving(false);
    await savePlace({ label, dockId: to, icon }).catch(() => {});
    setPlaces(await savedPlaces().catch(() => places));
  }

  async function nearMe() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setLocNote(t('noLoc'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      if (kmBetween([here.longitude, here.latitude], [HOME_CENTER.longitude, HOME_CENTER.latitude]) < 35) {
        setCenter(here);
        setLocNote(t('ctrYou'));
      } else {
        setCenter(HOME_CENTER);
        setLocNote(t('outside'));
      }
    } catch {
      setLocNote(t('noLoc'));
    }
  }

  function chooseDock(id: string) {
    if (picker === 'from') {
      setFrom(id);
      if (id === to) setTo(id === 'we' ? 'inf' : 'we');
    } else {
      setTo(id);
      if (id === from) setFrom(id === 'we' ? 'inf' : 'we');
    }
    setPicker(null);
  }

  function request() {
    router.push({
      pathname: '/checkout',
      params: {
        kind: 'ride',
        from,
        to,
        riders: String(riders),
        mode,
        timing,
        scheduledFor: timing === 'scheduled' ? slots[slot].toISOString() : '',
        kids: kids ? '1' : '0',
        towels: towels ? '1' : '0',
        repeat: timing === 'scheduled' && repeat ? '1' : '0',
        weekdays: repeatDays.join(','),
        repeatFor: String(repeatFor),
        joinMin: joined ? String(minsUntil(joined.departsAt)) : '',
      },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(10) }} stickyHeaderIndices={[]}>
        <View style={styles.header}>
          <ServiceSwitch />
          <View style={{ alignItems: 'flex-end', gap: space(1) }}>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <ShipButton />
              <LanguageButton />
            </View>
            <CurrencyButton />
          </View>
        </View>
        <Text style={[type.hero, { color: c.ink, paddingHorizontal: space(4), marginBottom: space(3) }]}>{t('greet')}</Text>

        <View style={[styles.mapWrap, { height: Math.round(height * 0.42) }]}>
          <LiveMap
            center={center}
            rangeMiles={range}
            boats={boats}
            docks={DOCKS.map((d) => ({ ...d, selected: d.id === from || d.id === to }))}
            route={route.path}
            diveSites={DIVE_SITES}
            satellite={satellite}
            onBoatPress={(boat) => setPopup({ kind: 'boat', boat })}
            onDivePress={(site) => setPopup({ kind: 'dive', site })}
          />
          <View style={[styles.livePill, { backgroundColor: c.bg }]}>
            <View style={styles.liveDot} />
            <Text style={[type.label, { color: c.ink }]}>
              {t('live')} · {t('inRange').replace('{n}', String(inRange)).replace('{r}', `${range} mi`)}
            </Text>
          </View>
          <View style={styles.mapCtl}>
            <View style={[styles.zoom, { backgroundColor: c.bg }]}>
              {[7, 5, 2].map((r) => (
                <Pressable key={r} onPress={() => setRange(r)} style={[styles.zoomBtn, range === r && { backgroundColor: c.ink }]}>
                  <Text style={[type.label, { fontSize: 11, lineHeight: 14, color: range === r ? c.onInk : c.muted }]}>{r} mi</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={nearMe} style={[styles.ctlBtn, { backgroundColor: c.bg }]}>
              <Ionicons name="locate" size={16} color={c.ink} />
              <Text style={[type.label, { color: c.ink }]}>{t('locate')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Map style" onPress={() => setSatellite((s) => !s)} style={[styles.ctlBtn, { backgroundColor: c.bg }]}>
              <Ionicons name="layers" size={16} color={c.ink} />
            </Pressable>
          </View>
          {popup && (
            <View style={[styles.popup, { backgroundColor: c.bg }]}>
              <Pressable accessibilityLabel="Close" onPress={() => setPopup(null)} style={[styles.close, { backgroundColor: c.tile }]}>
                <Ionicons name="close" size={16} color={c.ink} />
              </Pressable>
              {popup.kind === 'boat' ? (
                <>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>{popup.boat.name}</Text>
                  <Note>
                    {t(`k_${popup.boat.kind}`)} · {popup.boat.available ? t('avail') : t('onTrip')} · {popup.boat.seats} {t('ridersSeats')}
                  </Note>
                  {popup.boat.kind === 'taxi' && popup.boat.available && (
                    <Button
                      small
                      label={t('reqThis')}
                      onPress={() => {
                        if (popup.boat.seats > 8) {
                          setTiming('scheduled');
                          setKids(true);
                        }
                        setPopup(null);
                      }}
                      style={{ marginTop: space(2) }}
                    />
                  )}
                </>
              ) : (
                <>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>{popup.site.name}</Text>
                  <Note>
                    {t('k_dive')} · {t(`dt_${popup.site.kind}`)}
                  </Note>
                  <Button
                    small
                    label={t('findTrip')}
                    onPress={() => {
                      setPopup(null);
                      router.push('/portal/dive');
                    }}
                    style={{ marginTop: space(2) }}
                  />
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.legend}>
          {[
            ['taxi', c.flame],
            ['tour', c.lagoon],
            ['fish', c.fishing],
          ].map(([k, col]) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: col }]} />
              <Text style={[type.small, { color: c.muted }]}>{t(`k_${k}`)}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={styles.legendFlag} />
            <Text style={[type.small, { color: c.muted }]}>{t('k_dive')}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: space(5) }}>
          <Note>
            {locNote} {DEMO_MODE ? t('demoBoats') : ''}
          </Note>
        </View>

        <View style={styles.panel}>
          <View style={[styles.legs, { backgroundColor: c.tile }]}>
            {(['from', 'to'] as const).map((k, i) => (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={t(k === 'from' ? 'from_' : 'to')} onPress={() => setPicker(k)} style={[styles.leg, i === 1 && { borderTopWidth: 1, borderTopColor: c.tile2 }]}>
                <View style={[i === 0 ? styles.dotFrom : styles.dotTo, { backgroundColor: c.ink }]} />
                <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]} numberOfLines={1}>
                  {dockName(k === 'from' ? from : to)}
                </Text>
                <Ionicons name="chevron-down" size={18} color={c.muted} />
              </Pressable>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
            {places.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => goTo(p.dockId)} style={[styles.chip, { backgroundColor: to === p.dockId ? c.ink : c.tile }]}>
                <Ionicons name={PLACE_ICONS[p.icon]} size={15} color={to === p.dockId ? c.onInk : c.ink} />
                <Text style={[type.label, { fontSize: 14, color: to === p.dockId ? c.onInk : c.ink }]}>{p.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setSaving(true)} style={[styles.chip, { borderWidth: 1, borderColor: c.line }]}>
              <Ionicons name="bookmark-outline" size={15} color={c.ink} />
              <Text style={[type.label, { fontSize: 14, color: c.ink }]}>{t('savePlace')}</Text>
            </Pressable>
          </ScrollView>

          <View style={{ gap: 2 }}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>
              {quote.miles.toFixed(1)} mi · {t('rideMin').replace('{m}', String(quote.rideMinutes))} · {t('arrive')} ~{clock(arrive, i18n.language)}
            </Text>
            {timing === 'now' && <Note>{pickupMin ? t('pickup').replace('{m}', String(pickupMin)) : t('noTaxi')}</Note>}
          </View>

          <View style={[styles.banner, { backgroundColor: c.tile }]}>
            <View style={[styles.seaDot, { backgroundColor: SEA_COLOR[cond.state] }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>
                {t('seaTitle')}: {t(`sea_${cond.state}`)}
              </Text>
              <Note>
                {t({ none: 'seaCalmMsg', expect_spray: 'seaChoppyMsg', land_taxi: 'seaRoughMsg' }[advice])}
                {cond.state === 'unknown' ? '' : condAgo ? ` ${t('reportedAgo').replace('{m}', String(condAgo))}` : ''}
              </Note>
            </View>
          </View>

          {night !== 'day' && (
            <View style={[styles.banner, { backgroundColor: night === 'night' ? '#14213D' : '#3A1410' }]}>
              <Ionicons name={night === 'night' ? 'moon' : 'close-circle'} size={20} color="#fff" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.bodyStrong, { color: '#fff' }]}>{t(night === 'night' ? 'nightH' : 'closedH')}</Text>
                <Text style={[type.small, { color: '#E5E7EB' }]}>
                  {night === 'night' ? t('nightMsg') : t('closedMsg').replace('{h}', hourLabel(FEATURE_SETTINGS.night.lastBoatHour, i18n.language))}
                </Text>
              </View>
            </View>
          )}

          {blocked && <Button variant="ink" label={t('landTaxi')} onPress={() => router.push('/assistant')} />}

          {!flat && (
            <View style={[styles.mileNote, { backgroundColor: c.tile }]}>
              <Text style={[type.small, { color: c.ink }]}>
                {quote.rule === 'zone' ? t('zoneNote') : t('mileNote')} {quote.breakdown}
              </Text>
            </View>
          )}

          {flat && timing === 'now' && (
            <View>
              {(['shared', 'private'] as const).map((m) => {
                const on = mode === m;
                return (
                  <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setMode(m)} style={[styles.opt, { borderColor: on ? c.ink : 'transparent' }]}>
                    <Text style={{ fontSize: 30 }}>{m === 'shared' ? '🚤' : '🛥️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyStrong, { color: c.ink }]}>{t(m)}</Text>
                      <Note>{t(`${m}Sub`).replace('{n}', String(FEATURE_SETTINGS.shared.seatsToDepart)).replace('{m}', String(FEATURE_SETTINGS.shared.maxWaitMinutes))}</Note>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {flat && timing === 'now' && mode === 'shared' && (
            <View style={{ gap: space(2) }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{t('sharedH')}</Text>
              {joinable.length === 0 ? (
                <Note>
                  {t('noShared').replace('{n}', String(FEATURE_SETTINGS.shared.seatsToDepart)).replace('{m}', String(FEATURE_SETTINGS.shared.maxWaitMinutes))}
                </Note>
              ) : (
                joinable.map((b) => {
                  const on = b.id === joinId;
                  return (
                    <Pressable key={b.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setJoinId(on ? null : b.id)} style={[styles.opt, { borderColor: on ? c.ink : c.line }]}>
                      <Ionicons name="people" size={22} color={c.flame} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('leavesIn').replace('{m}', String(minsUntil(b.departsAt)))}</Text>
                        <Note>{t('seatsTaken').replace('{n}', String(b.seatsTaken)).replace('{t}', String(b.seatsTotal))}</Note>
                      </View>
                      <Text style={[type.label, { color: on ? c.flame : c.ink, fontSize: 14 }]}>{on ? '✓' : t('joinBoat')}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          <Segmented
            value={timing}
            onChange={(v) => {
              setTiming(v);
              setMode(v === 'scheduled' ? 'private' : 'shared');
            }}
            options={[
              { value: 'now', label: t('now') },
              { value: 'scheduled', label: t('later') },
            ]}
          />

          {timing === 'scheduled' && (
            <View style={{ gap: space(3) }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
                {slots.map((s, i) => (
                  <Pressable key={s.toISOString()} onPress={() => setSlot(i)} style={[styles.slot, { backgroundColor: i === slot ? c.ink : c.tile }]}>
                    <Text style={[type.label, { fontSize: 14, color: i === slot ? c.onInk : c.ink }]}>{clock(s, i18n.language)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.switchRow}>
                <Text style={[type.body, { color: c.ink, flex: 1 }]}>{t('wet')}</Text>
                <Switch value={towels} onValueChange={setTowels} trackColor={{ true: c.flame }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={[type.body, { color: c.ink, flex: 1 }]}>{t('kids')}</Text>
                <Switch value={kids} onValueChange={setKids} trackColor={{ true: c.flame }} />
              </View>
              <Note>{needsFamilyBoat(riders, kids) ? `${t('cap2')} · ${t('jackets')}` : t('cap1')}</Note>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.ink }]}>{t('repeatToggle')}</Text>
                  <Note>{t('repeatHint')}</Note>
                </View>
                <Switch value={repeat} onValueChange={setRepeat} trackColor={{ true: c.flame }} />
              </View>
              {repeat && (
                <View style={{ gap: space(3) }}>
                  <View style={styles.days}>
                    <Pressable onPress={() => setRepeatDays([])} style={[styles.day, { backgroundColor: repeatDays.length === 0 ? c.ink : c.tile, paddingHorizontal: 12 }]}>
                      <Text style={[type.label, { color: repeatDays.length === 0 ? c.onInk : c.ink }]}>{t('everyDay')}</Text>
                    </Pressable>
                    {WEEKDAYS.map((d) => {
                      const on = repeatDays.includes(d);
                      return (
                        <Pressable key={d} onPress={() => setRepeatDays(on ? repeatDays.filter((x) => x !== d) : [...repeatDays, d].sort())} style={[styles.day, { backgroundColor: on ? c.ink : c.tile }]}>
                          <Text style={[type.label, { color: on ? c.onInk : c.ink }]}>{t(`wd${d}`)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Stepper label={t('repeatUntil')} value={repeatFor} min={1} max={14} onChange={setRepeatFor} />
                </View>
              )}

              <View style={[styles.banner, { backgroundColor: c.tile }]}>
                <Ionicons name="shield-checkmark" size={20} color={c.flame} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>{t('guaranteeH')}</Text>
                  <Note>{t('guaranteeMsg').replace('{c}', String(FEATURE_SETTINGS.guarantee.missedPickupCreditUsd))}</Note>
                </View>
              </View>
            </View>
          )}

          <Stepper label={t('riders')} value={riders} min={1} max={PRICING.maxRiders} onChange={setRiders} />

          {covered ? (
            <View style={[styles.banner, { backgroundColor: c.tile }]}>
              <Ionicons name="ticket" size={20} color={c.flame} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{t('passCovered')}</Text>
                {cover.extraRiders > 0 && <Note>{t('passExtra').replace('{n}', String(cover.extraRiders)).replace('{p}', usd(cover.fareUsd))}</Note>}
              </View>
            </View>
          ) : flat && !pass ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pass', params: { group: String(riders) } })} style={[styles.banner, { backgroundColor: c.tile }]}>
              <Ionicons name="ticket-outline" size={20} color={c.flame} />
              <Text style={[type.small, { color: c.ink, flex: 1 }]}>{t('passPromo').replace('{p}', String(FEATURE_SETTINGS.passes[0].priceUsd / FEATURE_SETTINGS.passes[0].riders))}</Text>
              <Text style={[type.label, { color: c.flame, fontSize: 14 }]}>{t('passSeeOptions')} ›</Text>
            </Pressable>
          ) : null}

          <Button
            label={joined ? t('joinedBoat').replace('{m}', String(minsUntil(joined.departsAt))) : timing === 'scheduled' ? t('reserve') : t('request')}
            trailing={usd(price)}
            disabled={blocked}
            onPress={request}
          />
          <Note center>{timing === 'scheduled' && flat ? t('feeNote') : t('note')}</Note>
        </View>
      </ScrollView>

      <Pressable accessibilityRole="button" onPress={() => router.push('/assistant')} style={[styles.fab, { backgroundColor: c.ink }]}>
        <View style={[styles.fabDot, { backgroundColor: c.flame }]} />
        <Text style={[type.bodyStrong, { color: c.onInk }]}>{t('ask')}</Text>
      </Pressable>

      <DockPicker visible={picker !== null} selected={picker === 'from' ? from : to} onPick={chooseDock} onClose={() => setPicker(null)} />

      <Modal visible={saving} transparent animationType="fade" onRequestClose={() => setSaving(false)}>
        <Pressable style={styles.scrim} onPress={() => setSaving(false)}>
          <View style={[styles.sheet, { backgroundColor: c.bg }]}>
            <Text style={[type.h2, { color: c.ink }]}>{t('savePlace')}</Text>
            <Note>{dockName(to)}</Note>
            {(['home', 'dive', 'food', 'star'] as const).map((icon) => {
              const label = t({ home: 'placeHome', dive: 'placeDive', food: 'placeFood', star: 'placeStar' }[icon]);
              return (
                <Pressable key={icon} onPress={() => saveCurrent(label, icon)} style={styles.sheetItem}>
                  <Ionicons name={PLACE_ICONS[icon]} size={18} color={c.ink} />
                  <Text style={[type.body, { color: c.ink }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingTop: space(2), paddingBottom: space(3) },
  mapWrap: { marginHorizontal: space(4), borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#11618A' },
  livePill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  mapCtl: { position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', gap: 6 },
  zoom: { flexDirection: 'row', borderRadius: radius.pill, padding: 2 },
  zoomBtn: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  ctlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  popup: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: radius.md, padding: space(3), gap: 2 },
  close: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4), paddingHorizontal: space(5), paddingTop: space(3), paddingBottom: space(1) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendFlag: { width: 13, height: 9, backgroundColor: '#D62828', borderRadius: 1 },
  panel: { padding: space(4), gap: space(4) },
  legs: { borderRadius: radius.md },
  leg: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(4) },
  dotFrom: { width: 9, height: 9, borderRadius: 5 },
  dotTo: { width: 9, height: 9 },
  mileNote: { borderRadius: radius.sm, padding: space(3) },
  opt: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md, borderWidth: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(3) },
  seaDot: { width: 12, height: 12, borderRadius: 6 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { minWidth: 40, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  slot: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  fab: { position: 'absolute', right: space(4), bottom: space(4), flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 13, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabDot: { width: 10, height: 10, borderRadius: 5 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(10), gap: 2 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 14, paddingHorizontal: 12, borderRadius: radius.sm },
});
