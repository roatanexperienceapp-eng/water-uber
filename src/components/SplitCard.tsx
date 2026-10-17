import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Note } from '@/components/ui';
import { WEB_URL } from '@/config';
import { splitStatus, type SplitStatus } from '@/lib/api';
import { countdown, islandClock } from '@/lib/cruise';
import { usd } from '@/lib/format';
import { pay } from '@/lib/payments';
import { radius, type, useTheme } from '@/theme';

export const splitUrl = (token: string) => `${WEB_URL}/split/${token}`;

/**
 * Progress of a group booking. The organizer shares the link (friends pay on the web, no app needed)
 * and can pay the rest. Unpaid at the deadline → the booking is cancelled and everyone is refunded.
 */
export function SplitCard({ token, organizer, onChange }: { token: string; organizer: boolean; onChange?: () => void }) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [s, setS] = useState<SplitStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = useCallback(() => splitStatus(token).then(setS).catch(() => {}), [token]);
  useEffect(() => {
    void load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);
  if (!s) return null;

  const left = countdown(new Date(s.deadlineAt));
  const done = s.status === 'complete';
  const expired = s.status === 'expired';

  async function payRest() {
    setBusy(true);
    setErr('');
    try {
      const { outcome } = await pay({ splitToken: token, shares: 'rest' }, `/split/${token}`);
      if (outcome === 'cancelled') setErr(t('payCancelled'));
      if (outcome === 'failed') setErr(t('payFailed'));
      await load();
      onChange?.();
    } catch {
      setErr(t('payFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={[type.bodyStrong, { color: c.ink }]}>👥 {t('splitH')}</Text>
      <View style={styles.dots}>
        {Array.from({ length: s.shares }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < s.paidShares ? '#16A34A' : c.tile2 }]} />
        ))}
      </View>
      <Text style={[type.small, { color: c.ink, fontWeight: '700' }]}>
        {t('splitProgress').replace('{n}', String(s.paidShares)).replace('{t}', String(s.shares))} · {t('splitEach').replace('{p}', usd(s.shareCents / 100)).replace('{n}', String(s.shares))}
      </Text>
      {done ? (
        <Note>{t('splitDone')}</Note>
      ) : expired ? (
        <Text style={[type.small, { color: c.sos }]}>{t('splitExpired')}</Text>
      ) : (
        <>
          <Note>
            {t('splitDeadline').replace('{t}', islandClock(new Date(s.deadlineAt), i18n.language))}
            {left ? ` · ${left.text}` : ''}
          </Note>
          {organizer && (
            <>
              <Button
                variant="ink"
                label={t('splitShare')}
                trailing="↗"
                onPress={() => Share.share({ message: t('splitShareMsg').replace('{name}', s.listingName).replace('{p}', usd(s.shareCents / 100)).replace('{url}', splitUrl(token)) })}
              />
              <Button
                variant="tile"
                label={t('splitPayRest')}
                trailing={usd(((s.shares - s.paidShares) * s.shareCents) / 100)}
                loading={busy}
                onPress={payRest}
              />
            </>
          )}
        </>
      )}
      {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dot: { width: 22, height: 8, borderRadius: radius.pill },
});
