import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { MenuRow, Tile } from '@/components/AccountKit';
import { LanguageButton } from '@/components/LanguageButton';
import { DEMO_MODE } from '@/config';
import { getProfile, hasFlag, type Profile } from '@/lib/account';
import { canSendInbox, useUnreadCount } from '@/lib/inbox';
import { useMyShip } from '@/lib/cruise';
import { savedPlaces } from '@/lib/stay';
import { radius, space, type, useTheme } from '@/theme';

/** Safety checkup: five things that make a guest's trips safer. Progress shows as a ring. */
function checkup(p: Profile | null, places: number) {
  return [
    { key: 'ckEmail', done: !!p?.email, go: '/me/profile' },
    { key: 'ckEmergency', done: !!p?.emergencyPhone, go: '/me/profile' },
    { key: 'ckPlace', done: places > 0, go: '/me/places' },
    { key: 'ckSafety', done: hasFlag('readSafety'), go: '/me/safety' },
    { key: 'ckAlerts', done: !!p?.notifyTrips, go: '/me/settings' },
  ] as const;
}

function Ring({ done, total }: { done: number; total: number }) {
  const c = useTheme();
  const r = 30;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={76} height={76} style={StyleSheet.absoluteFill}>
        <Circle cx={38} cy={38} r={r} stroke={c.tile2} strokeWidth={7} fill="none" />
        <Circle cx={38} cy={38} r={r} stroke={c.flame} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={`${(len * done) / total} ${len}`} transform="rotate(-90 38 38)" />
      </Svg>
      <Text style={{ fontSize: 22, fontWeight: '800', color: c.flame }}>
        {done}
        <Text style={{ fontSize: 15, fontWeight: '600' }}>/{total}</Text>
      </Text>
    </View>
  );
}

export default function Account() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [places, setPlaces] = useState(0);
  const [staff, setStaff] = useState(false);
  const unread = useUnreadCount(i18n.language);
  const ship = useMyShip();

  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile).catch(() => {});
      savedPlaces().then((p) => setPlaces(p.length)).catch(() => {});
      canSendInbox().then(setStaff).catch(() => {});
    }, []),
  );

  const items = checkup(profile, places);
  const done = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done);
  const name = profile?.fullName || (profile?.email ? profile.email.split('@')[0] : t('guestName'));
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(12) }}>
        <View style={styles.langRow}>
          <LanguageButton />
        </View>

        {/* Header: name, status chip, avatar */}
        <Pressable accessibilityRole="button" onPress={() => router.push('/me/profile')} style={styles.head}>
          <View style={{ flex: 1, gap: space(2) }}>
            <Text style={[styles.name, { color: c.ink }]} numberOfLines={2}>
              {name}
            </Text>
            <View style={styles.chips}>
              <View style={[styles.chip, { backgroundColor: c.tile }]}>
                <Text style={[type.label, { color: c.ink, fontSize: 14 }]}>{profile?.email ? t('emailVerified') : t('notSignedIn')}</Text>
              </View>
              {ship && (
                <View style={[styles.chip, { backgroundColor: c.tile }]}>
                  <Text style={[type.label, { color: c.ink, fontSize: 14 }]}>🚢 {t('cruiseGuest')}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.avatar, { backgroundColor: c.muted }]}>
            {profile?.fullName ? (
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{profile.fullName.trim()[0]?.toUpperCase()}</Text>
            ) : (
              <Ionicons name="person-outline" size={34} color="#fff" />
            )}
          </View>
        </Pressable>

        {/* Four tiles */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <Tile icon="help-buoy-outline" label={t('helpH')} onPress={() => router.push('/me/help')} />
            <Tile icon="wallet-outline" label={t('walletH')} onPress={() => router.push('/me/wallet')} />
          </View>
          <View style={styles.gridRow}>
            <Tile icon="shield-outline" label={t('safetyH')} onPress={() => router.push('/me/safety')} />
            <Tile icon="mail-outline" label={t('inboxH')} badge={unread} onPress={() => router.push('/inbox')} />
          </View>
        </View>

        {/* Safety checkup */}
        <Pressable accessibilityRole="button" onPress={() => next && router.push(next.go)} style={[styles.checkup, { backgroundColor: c.tile }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>{t('checkupH')}</Text>
            <Text style={[type.body, { color: c.muted }]}>{next ? t(next.key) : t('checkupDone')}</Text>
          </View>
          <Ring done={done} total={items.length} />
        </Pressable>

        {/* Menu */}
        <View style={{ marginTop: space(2) }}>
          <MenuRow icon="person-circle-outline" title={t('manageAccount')} sub={t('manageAccountSub')} onPress={() => router.push('/me/profile')} />
          <MenuRow icon="settings-outline" title={t('settingsH')} onPress={() => router.push('/me/settings')} />
          <MenuRow icon="bookmark-outline" title={t('savedPlacesH')} sub={t('savedPlacesSub')} onPress={() => router.push('/me/places')} />
          <MenuRow icon="people-outline" title={t('captainsH')} sub={t('captainsMenuSub')} onPress={() => router.push('/captains')} />
          <MenuRow icon="ticket-outline" title={t('passTitle')} sub={t('passesSub')} onPress={() => router.push('/pass')} />
          <MenuRow icon="pricetag-outline" title={t('inboxOffers')} sub={t('offersSub')} onPress={() => router.push('/inbox')} />
          <MenuRow icon="boat-outline" title={t('driveH')} sub={t('driveSub')} onPress={() => router.push({ pathname: '/me/partner', params: { kind: 'captain' } })} />
          <MenuRow icon="storefront-outline" title={t('listBizH')} sub={t('listBizSub')} badge={t('newBadge')} onPress={() => router.push({ pathname: '/me/partner', params: { kind: 'business' } })} />
          <MenuRow icon="heart-outline" title={t('giveCardH')} sub={t('giveMenuSub')} onPress={() => router.push('/give')} />
          {staff && <MenuRow icon="megaphone-outline" title={t('composeH')} sub={t('staffOnly')} onPress={() => router.push('/inbox-compose')} />}
          <MenuRow icon="information-circle-outline" title={t('legalH')} onPress={() => router.push('/me/legal')} />
        </View>

        <Text style={[type.small, { color: c.muted, marginTop: space(4) }]}>
          v{version}
          {DEMO_MODE ? ` · ${t('demoShort')}` : ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  langRow: { alignItems: 'flex-end' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2), marginBottom: space(5) },
  name: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  chips: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  chip: { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  grid: { gap: space(3) },
  gridRow: { flexDirection: 'row', gap: space(3) },
  checkup: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.lg, padding: space(5), marginTop: space(4) },
  cardTitle: { fontSize: 20, fontWeight: '600' },
});
