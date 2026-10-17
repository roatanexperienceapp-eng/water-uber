import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { MenuRow, SubScreen } from '@/components/AccountKit';
import { LanguageButton } from '@/components/LanguageButton';
import { ShipButton } from '@/components/ShipButton';
import { Note } from '@/components/ui';
import { LANGUAGES } from '@/i18n';
import { updateProfile, useProfile } from '@/lib/account';
import { space, type, useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [p] = useProfile();
  return <SettingsBody key={p ? 'loaded' : 'loading'} initialTrips={p?.notifyTrips ?? true} initialOffers={p?.notifyOffers ?? false} lang={i18n.language} c={c} t={t} />;
}

function SettingsBody({ initialTrips, initialOffers, lang, c, t }: { initialTrips: boolean; initialOffers: boolean; lang: string; c: ReturnType<typeof useTheme>; t: (k: string) => string }) {
  const [trips, setTrips] = useState(initialTrips);
  const [offers, setOffers] = useState(initialOffers);

  const toggle = (k: 'notifyTrips' | 'notifyOffers', v: boolean) => {
    (k === 'notifyTrips' ? setTrips : setOffers)(v);
    void updateProfile({ [k]: v }).catch(() => (k === 'notifyTrips' ? setTrips : setOffers)(!v));
  };

  return (
    <SubScreen title={t('settingsH')}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]}>{t('language')}</Text>
          <Note>{LANGUAGES.find((l) => l.code === lang)?.label}</Note>
        </View>
        <LanguageButton />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]}>{t('myShipSetting')}</Text>
          <Note>{t('myShipSettingSub')}</Note>
        </View>
        <ShipButton />
      </View>

      <Text style={[type.h2, { color: c.ink, marginTop: space(2) }]}>{t('notificationsH')}</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]}>{t('notifyTrips')}</Text>
          <Note>{t('notifyTripsSub')}</Note>
        </View>
        <Switch value={trips} onValueChange={(v) => toggle('notifyTrips', v)} trackColor={{ true: c.flame }} accessibilityLabel={t('notifyTrips')} />
      </View>
      {!trips && <Text style={[type.small, { color: c.sos }]}>{t('notifyTripsOffWarn')}</Text>}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]}>{t('notifyOffers')}</Text>
          <Note>{t('notifyOffersSub')}</Note>
        </View>
        <Switch value={offers} onValueChange={(v) => toggle('notifyOffers', v)} trackColor={{ true: c.flame }} accessibilityLabel={t('notifyOffers')} />
      </View>
      <Note>{t('notifyNote')}</Note>

      <View style={{ marginTop: space(2) }}>
        <MenuRow icon="bookmark-outline" title={t('savedPlacesH')} onPress={() => router.push('/me/places')} />
        <MenuRow icon="person-circle-outline" title={t('manageAccount')} onPress={() => router.push('/me/profile')} />
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { fontSize: 17, fontWeight: '600' },
});
