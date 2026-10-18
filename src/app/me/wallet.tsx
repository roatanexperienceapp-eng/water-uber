import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Card, Note } from '@/components/ui';
import { myReceipts, type Receipt } from '@/lib/account';
import { usd } from '@/lib/format';
import { passName } from '@/lib/passName';
import { currentPass, myCredits, type GuestPass, type RideCredit } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

const KIND_ICON: Record<Receipt['kind'], keyof typeof Ionicons.glyphMap> = { ride: 'boat-outline', booking: 'compass-outline', pass: 'ticket-outline', donation: 'heart-outline' };

/** Wallet: ride pass, credits, and every payment (receipts). Cards live with the processor, never in the app. */
export default function WalletScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [pass, setPass] = useState<GuestPass | null>(null);
  const [credits, setCredits] = useState<RideCredit[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  useFocusEffect(
    useCallback(() => {
      currentPass().then(setPass).catch(() => {});
      myCredits().then(setCredits).catch(() => {});
      myReceipts().then(setReceipts).catch(() => {});
    }, []),
  );
  const creditTotal = credits.filter((x) => !x.used).reduce((s, x) => s + x.amountUsd, 0);

  return (
    <SubScreen title={t('walletH')}>
      <View style={styles.row2}>
        <View style={[styles.box, { backgroundColor: c.tile }]}>
          <Text style={[type.label, { color: c.muted }]}>{t('credits')}</Text>
          <Text style={[type.h1, { color: c.ink }]}>{usd(creditTotal)}</Text>
          <Note>{t('creditsSub')}</Note>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/pass')} style={[styles.box, { backgroundColor: pass ? c.ink : c.tile }]}>
          <Text style={[type.label, { color: pass ? c.flame : c.muted }]}>{t('passActive')}</Text>
          <Text style={[type.h2, { color: pass ? c.onInk : c.ink }]}>{pass ? passName(t, pass.passId) : t('noPass')}</Text>
          <Text style={[type.small, { color: pass ? c.onInk : c.muted }]}>
            {pass ? t('passExpires').replace('{d}', shortDate(pass.expiresAt, i18n.language)) : `${t('passSeeOptions')} ›`}
          </Text>
        </Pressable>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={20} color={c.ink} />
          <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('payMethodsH')}</Text>
        </View>
        <Note>{t('payMethodsSub')}</Note>
      </Card>

      <Text style={[type.h2, { color: c.ink }]}>{t('receiptsH')}</Text>
      {receipts.length === 0 ? (
        <Note>{t('noReceipts')}</Note>
      ) : (
        receipts.map((r) => (
          <View key={r.id} style={[styles.receipt, { borderBottomColor: c.line }]}>
            <Ionicons name={KIND_ICON[r.kind]} size={22} color={c.ink} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: c.ink }]}>{t(`rk_${r.kind}`)}</Text>
              <Note>{shortDate(new Date(r.at), i18n.language)} · #{r.id.slice(0, 8).toUpperCase()}</Note>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[type.bodyStrong, { color: c.ink, textDecorationLine: r.status === 'refunded' ? 'line-through' : 'none' }]}>{usd(r.amountUsd)}</Text>
              <Text style={[type.label, { color: r.status === 'succeeded' ? '#16A34A' : r.status === 'refunded' ? c.flame : c.muted }]}>{t(`ps_${r.status}`)}</Text>
            </View>
          </View>
        ))
      )}
      <Note>{t('receiptEmailNote')}</Note>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: space(3) },
  box: { flex: 1, borderRadius: radius.lg, padding: space(4), gap: 4 },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderBottomWidth: 1 },
});
