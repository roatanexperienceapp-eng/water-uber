import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageButton } from '@/components/LanguageButton';
import { Button, Card, Note } from '@/components/ui';
import { BRAND_NAME } from '@/config';
import { splitStatus, type SplitStatus } from '@/lib/api';
import { countdown, islandClock, islandDay, roatanInstant } from '@/lib/cruise';
import { usd } from '@/lib/format';
import { pay } from '@/lib/payments';
import { space, type, useTheme } from '@/theme';

/**
 * The page a friend opens from the organizer's link — on the web, no app needed. Shows the trip and
 * lets them pay one share. No names, emails or phone numbers of the group are shown.
 */
export default function SplitPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [s, setS] = useState<SplitStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => splitStatus(token).then(setS).catch(() => setS(null)), [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function payShare() {
    setBusy(true);
    setMsg('');
    try {
      const { outcome } = await pay({ splitToken: token, shares: 'one' }, `/split/${token}`);
      setMsg(outcome === 'paid' ? t('paidOk') : outcome === 'cancelled' ? t('payCancelled') : outcome === 'failed' ? t('payFailed') : '');
      await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setMsg(code === 'no_shares_left' ? t('splitFull') : code === 'split_closed' ? t('splitClosed') : t('payFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(5), gap: space(4), maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[type.h2, { color: c.ink }]}>{BRAND_NAME}</Text>
          <LanguageButton />
        </View>
        {s === undefined ? null : !s ? (
          <Note>{t('splitNotFound')}</Note>
        ) : (
          <>
            <Text style={[type.h1, { color: c.ink }]}>{t('splitInvite')}</Text>
            <Card>
              <Text style={[type.h2, { color: c.ink }]}>{s.listingName}</Text>
              <Note>
                {islandDay(roatanInstant(s.date, s.time), i18n.language)} · {islandClock(roatanInstant(s.date, s.time), i18n.language)} · {s.quantity} {t('u_person').toLowerCase()}
              </Note>
              <Text style={[type.bodyStrong, { color: c.ink }]}>
                {t('splitProgress').replace('{n}', String(s.paidShares)).replace('{t}', String(s.shares))}
              </Text>
              {s.status === 'open' && (
                <Note>
                  {t('splitDeadline').replace('{t}', islandClock(new Date(s.deadlineAt), i18n.language))}
                  {countdown(new Date(s.deadlineAt)) ? ` · ${countdown(new Date(s.deadlineAt))!.text}` : ''}
                </Note>
              )}
            </Card>
            {s.status === 'open' && s.paidShares < s.shares ? (
              <Button label={t('splitPayMine')} trailing={usd(s.shareCents / 100)} loading={busy} onPress={payShare} />
            ) : (
              <Note>{s.status === 'complete' || s.paidShares >= s.shares ? t('splitDone') : t('splitExpired')}</Note>
            )}
            {msg ? <Text style={[type.bodyStrong, { color: c.ink, textAlign: 'center' }]}>{msg}</Text> : null}
            <Note center>{t('splitPrivacy')}</Note>
            <Note center>{t('securePay')}</Note>
            <Button variant="tile" label={t('getApp')} onPress={() => router.replace('/')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
