import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS } from '../../../supabase/functions/_shared/geo.ts';
import { FEATURE_SETTINGS } from '../../../supabase/functions/_shared/features.ts';
import { LanguageButton } from '@/components/LanguageButton';
import { Button, Card, Note } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { currentUserEmail, sendLoginCode, signOut, verifyLoginCode } from '@/lib/api';
import { deletePlace, savedPlaces, type SavedPlace } from '@/lib/stay';
import { hourLabel, PLACE_ICONS } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

export default function Account() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    savedPlaces().then(setPlaces).catch(() => {});
    currentUserEmail().then(setMe).catch(() => {});
  }, []);
  useFocusEffect(load);

  const dockName = (d: string) => DOCKS.find((x) => x.id === d)?.name ?? d;
  const input = [styles.input, { backgroundColor: c.tile, color: c.ink }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }}>
        <View style={styles.head}>
          <Text style={[type.h1, { color: c.ink }]}>{t('accountH')}</Text>
          <LanguageButton />
        </View>

        {DEMO_MODE ? (
          <Card>
            <Note>{t('demoMode')}</Note>
          </Card>
        ) : me ? (
          <Card>
            <Note>{t('signedInAs')}</Note>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{me}</Text>
            <Button small variant="tile" label={t('signOut')} onPress={() => signOut().then(load)} />
          </Card>
        ) : (
          <Card>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{t('signIn')}</Text>
            <Note>{t('signInSub')}</Note>
            <TextInput style={input} value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="email-address" />
            {sent && <TextInput style={input} value={code} onChangeText={setCode} placeholder={t('code')} placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={6} />}
            <Button
              label={sent ? t('verify') : t('sendCode')}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  if (sent) {
                    await verifyLoginCode(email.trim(), code.trim());
                    load();
                  } else {
                    await sendLoginCode(email.trim());
                    setSent(true);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Card>
        )}

        <Text style={[type.h2, { color: c.ink }]}>{t('savedPlacesH')}</Text>
        {places.length === 0 ? (
          <Note>{t('noPlaces')}</Note>
        ) : (
          places.map((p) => (
            <View key={p.id} style={[styles.row, { borderBottomColor: c.line }]}>
              <Ionicons name={PLACE_ICONS[p.icon]} size={20} color={c.flame} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{p.label}</Text>
                <Note>{dockName(p.dockId)}</Note>
              </View>
              <Pressable accessibilityRole="button" onPress={() => deletePlace(p.id).then(load)} style={[styles.small, { backgroundColor: c.tile }]}>
                <Text style={[type.label, { color: c.ink }]}>{t('delete')}</Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={[type.h2, { color: c.ink }]}>{t('nightSafety')}</Text>
        <Card>
          <Note>{t('nightMsg')}</Note>
          <Note>{t('closedMsg').replace('{h}', hourLabel(FEATURE_SETTINGS.night.lastBoatHour, i18n.language))}</Note>
        </Card>

        <Text style={[type.h2, { color: c.ink }]}>{t('guaranteeH')}</Text>
        <Card>
          <Note>{t('guaranteeMsg').replace('{c}', String(FEATURE_SETTINGS.guarantee.missedPickupCreditUsd))}</Note>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderBottomWidth: 1 },
  small: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
});
