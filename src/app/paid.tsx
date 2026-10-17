import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Note } from '@/components/ui';
import { waitForPayment } from '@/lib/payments';
import { space, type, useTheme } from '@/theme';

/**
 * Where the processor's checkout page sends the guest back to.
 * - Opened inside the app's checkout browser (?app=…): hand straight back to the app.
 * - On the website: ask OUR server whether the payment went through (never trust this URL), then continue.
 */
export default function Paid() {
  const { payment, back, cancelled, app } = useLocalSearchParams<{ payment?: string; back?: string; cancelled?: string; app?: string }>();
  const { t } = useTranslation();
  const c = useTheme();
  const [state, setState] = useState<'checking' | 'paid' | 'pending' | 'failed' | 'cancelled'>(cancelled ? 'cancelled' : 'checking');
  const next = typeof back === 'string' && back.startsWith('/') && !back.startsWith('//') ? back : '/trips';

  useEffect(() => {
    if (Platform.OS === 'web' && app && /^(islandride|islandride-captain|exp|exps):\/\//.test(app)) {
      window.location.replace(`${app}${app.includes('?') ? '&' : '?'}payment=${payment ?? ''}`);
      return;
    }
    if (cancelled || !payment) return;
    waitForPayment(payment).then(setState);
  }, [payment, cancelled, app]);

  useEffect(() => {
    if (state === 'paid') {
      const id = setTimeout(() => router.replace(next as never), 900);
      return () => clearTimeout(id);
    }
  }, [state, next]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.wrap}>
        {state === 'checking' && <ActivityIndicator size="large" color={c.flame} />}
        <Text style={[type.h1, { color: c.ink, textAlign: 'center' }]}>
          {{ checking: t('confirmingPay'), paid: t('paidOk'), pending: t('confirmingPay'), failed: t('payFailed'), cancelled: t('payCancelled') }[state]}
        </Text>
        {state === 'pending' && <Note center>{t('payPendingNote')}</Note>}
        {state !== 'checking' && <Button label={t('continueBtn')} onPress={() => router.replace(next as never)} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, justifyContent: 'center', padding: space(6), gap: space(4) } });
