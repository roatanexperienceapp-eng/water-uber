import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS } from '../../supabase/functions/_shared/geo.ts';
import { FEATURE_SETTINGS, guaranteeState } from '../../supabase/functions/_shared/features.ts';
import { Button, Card, Note } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { bookingContact, getRide, rideContact } from '@/lib/api';
import { clock, usd } from '@/lib/format';
import { myPasses, shareRideLink, type GuestPass } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { space, type, useTheme } from '@/theme';
import type { Ride } from '@/types';

export default function Confirmation() {
  const { kind, id, taxi, paid } = useLocalSearchParams<{ kind: 'ride' | 'booking' | 'pass'; id: string; taxi?: string; paid?: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [ride, setRide] = useState<Ride | undefined>();
  const [pass, setPass] = useState<GuestPass | undefined>();
  const [contact, setContact] = useState<{ name: string; whatsapp: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (kind === 'ride') {
      getRide(id).then(setRide).catch(() => {});
      rideContact(id).then(setContact).catch(() => {});
    } else if (kind === 'booking') {
      bookingContact(id).then(setContact).catch(() => {});
    } else {
      myPasses().then((ps) => setPass(ps.find((p) => p.id === id))).catch(() => {});
    }
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [kind, id]);

  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;
  const title = kind === 'ride' ? t('reserved') : kind === 'pass' ? t('passActive') : paid === '1' || contact ? t('confirmed') : t('requestSent');
  const pickup = ride?.pickupAt ? new Date(ride.pickupAt) : null;
  const g =
    ride && pickup && ride.timing === 'scheduled'
      ? guaranteeState({ pickupAt: pickup, now, captainConfirmed: !!ride.captainConfirmed, boarded: ride.status === 'onboard' || ride.status === 'completed' })
      : null;
  const gKey = g === 'awaiting_confirm' ? 'g_scheduled' : g ? `g_${g}` : '';

  async function share() {
    if (!ride) return;
    const url = await shareRideLink(ride.id);
    await Share.share({ message: `${t('shareMsg')} ${url}` });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(5), gap: space(4) }}>
        <View style={[styles.check, { backgroundColor: c.flame }]}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </View>
        <Text style={[type.h1, { color: c.ink, textAlign: 'center' }]}>{title}</Text>

        {ride && (
          <Card>
            <Text style={[type.label, { color: c.muted }]}>
              {t('rideTitle')} · #{ride.id.slice(0, 8)}
            </Text>
            <Text style={[type.h2, { color: c.ink }]}>
              {dockName(ride.from)} → {dockName(ride.to)}
            </Text>
            <Note>
              {pickup ? `${shortDate(pickup, i18n.language)} ${clock(pickup, i18n.language)} · ` : ''}
              {ride.riders} {t('u_rider').toLowerCase()} · {ride.coveredByPass ? t('passCovered') : `${t('paid')} ${usd(ride.fareUsd)}`}
            </Note>
            {ride.needsTowels ? <Note>{t('towels')}</Note> : null}
            {ride.hasKids ? <Note>{t('jackets')}</Note> : null}
          </Card>
        )}

        {g && (
          <Status
            icon="shield-checkmark"
            title={t('guaranteeH')}
            body={`${t(gKey)}${g === 'missed' ? ` (${usd(FEATURE_SETTINGS.guarantee.missedPickupCreditUsd)})` : ''}`}
            tone={g === 'missed' || g === 'reassign' ? 'warn' : 'ok'}
          />
        )}
        {ride && ride.timing === 'now' && (
          <Status
            icon="boat"
            title={ride.status === 'accepted' || ride.status === 'onboard' ? t('statusAccepted') : t('finding')}
            body={ride.status === 'accepted' || ride.status === 'onboard' ? t('captainLine') : t('findingSub')}
            tone="ok"
          />
        )}
        {ride?.needsLitBoat && <Status icon="moon" title={t('nightSafety')} body={t('nightMsg')} tone="ok" />}

        {pass && (
          <Card>
            <Text style={[type.h2, { color: c.ink }]}>{t(`pass_${pass.passId}`)}</Text>
            <Note>{t('passExpires').replace('{d}', shortDate(pass.expiresAt, i18n.language))}</Note>
            <Note>{pass.ridesLeft === null ? t('passUnlimited') : t('passLeft').replace('{n}', String(pass.ridesLeft))}</Note>
            <Note>{t('passOnlyZone')}</Note>
          </Card>
        )}

        {kind === 'booking' && taxi === '1' && <Status icon="boat" title={t('addTaxi')} body={t('guaranteeH')} tone="ok" />}

        {kind !== 'pass' && (
          <Card>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{t('waH')}</Text>
            {contact?.whatsapp ? (
              <>
                <Note>{contact.name}</Note>
                <Button variant="ink" label={t('waBtn')} onPress={() => Linking.openURL(`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`)} />
              </>
            ) : (
              <Note>{contact?.name ? `${contact.name} · ` : ''}{DEMO_MODE ? t('waDemo') : t('reqSentSub')}</Note>
            )}
          </Card>
        )}

        {ride && <Button variant="tile" label={t('shareRide')} trailing="↗" onPress={share} />}
        {ride && <Note center>{t('shareMsg')}</Note>}

        <Button label={t('goToTrips')} onPress={() => leaveTo('/trips')} />
        <Button variant="tile" label={t('doneBtn')} onPress={() => leaveTo('/')} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Close checkout/confirmation and land on a tab, without stacking a second copy of the tabs. */
function leaveTo(path: '/' | '/trips') {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(path);
}

function Status({ icon, title, body, tone }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; tone: 'ok' | 'warn' }) {
  const c = useTheme();
  return (
    <View style={[styles.status, { backgroundColor: c.tile }]}>
      <Ionicons name={icon} size={20} color={tone === 'warn' ? c.sos : c.flame} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: c.ink }]}>{title}</Text>
        <Note>{body}</Note>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  check: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginTop: space(4) },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: 14, padding: space(3) },
});
