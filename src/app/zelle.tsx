import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Button, Card, Note } from '@/components/ui';
import { usd } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Zelle instructions. The pass/booking already exists and is held; it is confirmed when the team sees
 * the transfer in the bank. "I've sent it" goes to the confirmation screen, which waits for that.
 */
export default function ZelleScreen() {
  const p = useLocalSearchParams<{ kind: string; id: string; amount: string; to: string; code: string; bundle?: string }>();
  const { t } = useTranslation();
  const c = useTheme();
  const [copied, setCopied] = useState('');
  const amount = Number(p.amount) || 0;

  async function copy(what: string, value: string) {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(what);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      // Copy is a convenience only; the text is on screen.
    }
  }

  function sent() {
    const params: Record<string, string> = { kind: String(p.kind), id: String(p.id), zelle: '1' };
    if (p.bundle) params.bundle = '1';
    router.replace({ pathname: '/confirmation', params });
  }

  return (
    <SubScreen title={t('zelleH')}>
      <Line k="amt" copied={copied} onCopy={copy} label={t('zelleAmount')} value={usd(amount)} copyValue={amount.toFixed(2)} />
      <Line k="to" copied={copied} onCopy={copy} label={t('zelleTo')} value={String(p.to ?? '')} small />
      <Line k="code" copied={copied} onCopy={copy} label={t('zelleMemo')} value={String(p.code ?? '')} />

      <Card>
        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('zelleHowH')}</Text>
        <Note>1. {t('zelleStep1')}</Note>
        <Note>2. {t('zelleStep2')}</Note>
        <Note>3. {t('zelleStep3')}</Note>
      </Card>

      <Note>{t('zelleHeld')}</Note>
      <Note>{t('zelleUsOnly')}</Note>

      <Button label={t('zelleSent')} onPress={sent} />
      <Button variant="tile" label={t('zelleCard')} onPress={() => router.back()} />
    </SubScreen>
  );
}

function Line({ k, label, value, copyValue, small, copied, onCopy }: { k: string; label: string; value: string; copyValue?: string; small?: boolean; copied: string; onCopy: (k: string, v: string) => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t('copyLbl')} ${label}`} onPress={() => onCopy(k, copyValue ?? value)} style={[styles.line, { backgroundColor: c.tile }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.label, { color: c.muted }]}>{label}</Text>
        <Text selectable numberOfLines={small ? 1 : undefined} adjustsFontSizeToFit={small} style={[small ? type.bodyStrong : type.h2, { color: c.ink }]}>{value}</Text>
      </View>
      <View style={[styles.copy, { backgroundColor: copied === k ? '#16A34A' : c.ink }]}>
        <Ionicons name={copied === k ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
        <Text style={[type.label, { color: '#fff' }]}>{copied === k ? t('copiedLbl') : t('copyLbl')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: 999 },
});
