import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Note } from '@/components/ui';
import { DEMO_MODE, WEB_URL } from '@/config';
import { usd } from '@/lib/format';
import { DONATION_MAX, DONATION_MIN, DONATION_PRESETS, givingPublic, startDonation, type GivingPublic } from '@/lib/giving';
import { pay } from '@/lib/payments';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Donation portal for the charity we support (Every Child Roatán).
 * iPhone/Android app: the Donate button opens this same page on our website in the phone's browser, where the
 * payment happens (Apple App Review 3.2.2(iv): non-approved nonprofits may only collect donations outside the app).
 * Website: the guest donates right here.
 */
export default function Give() {
  const { amount: amountParam, thanks } = useLocalSearchParams<{ amount?: string; thanks?: string }>();
  const { t } = useTranslation();
  const c = useTheme();
  const [info, setInfo] = useState<GivingPublic | null>(null);
  const initial = Number(amountParam);
  const [amount, setAmount] = useState<number>(DONATION_PRESETS.includes(initial) ? initial : 25);
  const [other, setOther] = useState(!DONATION_PRESETS.includes(initial) && initial >= DONATION_MIN ? String(initial) : '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(thanks === '1');
  const [how, setHow] = useState(false);

  const load = useCallback(() => givingPublic().then(setInfo).catch(() => {}), []);
  useEffect(() => {
    void load();
  }, [load]);

  const value = other ? Math.round(Number(other.replace(',', '.')) * 100) / 100 : amount;
  const valid = Number.isFinite(value) && value >= DONATION_MIN && value <= DONATION_MAX;
  // The store apps never take the payment themselves; the website does.
  const handOffToWeb = Platform.OS !== 'web' && !DEMO_MODE;
  const charity = info?.charityName ?? 'Every Child Roatán';

  async function donate() {
    if (!valid) return;
    setErr('');
    if (handOffToWeb) {
      await Linking.openURL(`${WEB_URL}/give?amount=${value}`);
      return;
    }
    setBusy(true);
    try {
      const id = await startDonation(value, message);
      const { outcome } = await pay({ donationId: id }, '/give?thanks=1');
      if (outcome === 'paid') {
        setDone(true);
        void load();
      } else if (outcome === 'cancelled') setErr(t('payCancelled'));
      else if (outcome === 'failed') setErr(t('payFailed'));
    } catch {
      setErr(t('payFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12), maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} style={[styles.round, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>

        <Image source={require('../../assets/images/giveback.jpg')} style={styles.hero} resizeMode="cover" accessibilityIgnoresInvertColors />

        <View style={{ gap: space(1) }}>
          <Text style={[type.label, { color: c.flame }]}>{t('giveKicker')}</Text>
          <Text style={[type.h1, { color: c.ink }]}>{charity}</Text>
          <Text style={[type.body, { color: c.muted }]}>{t('giveMission')}</Text>
        </View>

        {/* The pledge */}
        <View style={[styles.pledge, { backgroundColor: c.flame }]}>
          <Text style={styles.pledgeBig}>{info?.pledgePct ?? 10}%</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: '#fff' }]}>{t('givePledge').replace('{p}', String(info?.pledgePct ?? 10))}</Text>
            <Pressable onPress={() => setHow((x) => !x)} hitSlop={6}>
              <Text style={[type.small, { color: '#fff', textDecorationLine: 'underline' }]}>{t('giveHow')}</Text>
            </Pressable>
          </View>
        </View>
        {how && (
          <Card>
            <Note>{t('giveHowBody').replace('{p}', String(info?.pledgePct ?? 10))}</Note>
          </Card>
        )}

        {/* Transparency: money raised by guests and money actually handed over */}
        {info && (info.raisedCents > 0 || info.givenCents > 0) && (
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: c.tile }]}>
              <Text style={[type.h2, { color: c.ink }]}>{usd(info.raisedCents / 100)}</Text>
              <Text style={[type.small, { color: c.muted }]}>{info.donors === 1 ? t('giveRaisedOne') : t('giveRaised').replace('{n}', String(info.donors))}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: c.tile }]}>
              <Text style={[type.h2, { color: c.ink }]}>{usd(info.givenCents / 100)}</Text>
              <Text style={[type.small, { color: c.muted }]}>{t('giveGiven')}</Text>
            </View>
          </View>
        )}

        {done ? (
          <Card style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>💛</Text>
            <Text style={[type.h2, { color: c.ink, textAlign: 'center' }]}>{t('giveThanks')}</Text>
            <Note center>{t('giveThanksSub').replace('{name}', charity)}</Note>
            <Button variant="tile" label={t('giveAgain')} onPress={() => setDone(false)} />
          </Card>
        ) : (
          <>
            <Text style={[type.h2, { color: c.ink }]}>{t('giveChoose')}</Text>
            <View style={styles.amounts}>
              {DONATION_PRESETS.map((v) => {
                const on = !other && amount === v;
                return (
                  <Pressable
                    key={v}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      setAmount(v);
                      setOther('');
                    }}
                    style={[styles.amount, { backgroundColor: on ? c.ink : c.tile }]}
                  >
                    <Text style={[type.h2, { color: on ? c.onInk : c.ink }]}>{usd(v)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={other}
              onChangeText={(x) => setOther(x.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={t('giveOther')}
              placeholderTextColor={c.muted}
              style={[styles.input, { backgroundColor: c.tile, color: c.ink, borderColor: other ? c.ink : 'transparent' }]}
              accessibilityLabel={t('giveOther')}
            />
            {other && !valid ? <Text style={[type.small, { color: c.sos }]}>{t('giveRange').replace('{min}', usd(DONATION_MIN)).replace('{max}', usd(DONATION_MAX))}</Text> : null}
            {!handOffToWeb && (
              <TextInput
                value={message}
                onChangeText={setMessage}
                maxLength={280}
                placeholder={t('giveMessage')}
                placeholderTextColor={c.muted}
                style={[styles.input, { backgroundColor: c.tile, color: c.ink }]}
              />
            )}
            <Button label={handOffToWeb ? t('giveOnWeb') : t('giveDonate')} trailing={valid ? usd(value) : undefined} disabled={!valid} loading={busy} onPress={donate} />
            {err ? <Text style={[type.small, { color: c.sos, textAlign: 'center' }]}>{err}</Text> : null}
            {handOffToWeb && <Note center>{t('giveWebNote')}</Note>}
          </>
        )}

        <Note center>{t('giveFull')}</Note>
        <Note center>{t('giveTax')}</Note>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: 200, borderRadius: radius.lg },
  pledge: { flexDirection: 'row', alignItems: 'center', gap: space(4), borderRadius: radius.lg, padding: space(4) },
  pledgeBig: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1.5 },
  stats: { flexDirection: 'row', gap: space(3) },
  stat: { flex: 1, borderRadius: radius.md, padding: space(3), gap: 2 },
  amounts: { flexDirection: 'row', gap: space(2) },
  amount: { flex: 1, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  input: { borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16, borderWidth: 2 },
});
