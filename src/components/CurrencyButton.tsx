import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CURRENCIES, lempiras, money, myCurrency, setMyCurrency, useFx, type CurrencyCode } from '@/lib/fx';
import { radius, space, type, useTheme } from '@/theme';

/** Pill under the language button: today's lempira rate for the guest's currency; opens a converter + all 7 rates. */
export function CurrencyButton() {
  const { t } = useTranslation();
  const c = useTheme();
  const { rates, loading, failed, refresh } = useFx();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<CurrencyCode>(myCurrency);
  const [amount, setAmount] = useState('100');
  const [toHnl, setToHnl] = useState(true); // true: my currency → L, false: L → my currency
  const cur = CURRENCIES.find((x) => x.code === mine)!;
  const rate = rates.hnlPer[mine];
  const n = Number(amount.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
  const result = n > 0 ? (toHnl ? lempiras(n * rate) : money(n / rate, cur.symbol)) : '—';
  const old = rates.source === 'built-in' || failed;

  function show() {
    setOpen(true);
    if (failed || rates.source === 'built-in') refresh();
  }
  function pick(code: CurrencyCode) {
    setMine(code);
    setMyCurrency(code);
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('fxTitle')} onPress={show} style={[styles.pill, { backgroundColor: c.tile }]}>
        <Text style={[type.label, { fontSize: 13, color: c.ink }]}>
          {cur.flag} {lempiras(rate)}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.scrim}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('close')} onPress={() => setOpen(false)} />
            <View style={[styles.sheet, { backgroundColor: c.bg }]}>
              <ScrollView contentContainerStyle={{ gap: space(3) }} keyboardShouldPersistTaps="handled">
                <View style={styles.titleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.h2, { color: c.ink }]}>{t('fxTitle')}</Text>
                    <Text style={[type.small, { color: c.muted }]}>{t('fxSub')}</Text>
                  </View>
                  {loading && <ActivityIndicator color={c.flame} />}
                </View>

                {/* Converter first, so the keyboard never hides the answer */}
                <View style={[styles.conv, { borderColor: c.line }]}>
                  <View style={styles.convRow}>
                    <Text style={[type.h2, { color: c.ink }]}>{toHnl ? cur.symbol : 'L'}</Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      selectTextOnFocus
                      style={[type.h2, styles.input, { color: c.ink, backgroundColor: c.tile }]}
                      accessibilityLabel={t('fxConvert')}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel={t('fxSwap')} onPress={() => setToHnl((v) => !v)} style={[styles.swap, { backgroundColor: c.ink }]}>
                      <Text style={[type.label, { color: c.onInk }]}>⇄</Text>
                    </Pressable>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[type.h2, { color: c.flame, flex: 1, textAlign: 'right' }]}>{result}</Text>
                  </View>
                  <Text style={[type.small, { color: c.muted }]}>
                    1 {mine} = {lempiras(rate)} · L 100 = {money(100 / rate, cur.symbol)}
                  </Text>
                </View>

                {CURRENCIES.map((x) => {
                  const on = x.code === mine;
                  return (
                    <Pressable
                      key={x.code}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => pick(x.code)}
                      style={[styles.row, { backgroundColor: on ? c.tile : 'transparent' }]}
                    >
                      <Text style={{ fontSize: 22 }}>{x.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: c.ink }]}>{t(`cur_${x.code}`)}</Text>
                        <Text style={[type.small, { color: c.muted }]}>
                          {x.code} · L 100 = {money(100 / rates.hnlPer[x.code], x.symbol)}
                        </Text>
                      </View>
                      <Text style={[type.bodyStrong, { color: c.ink }]}>1 = {lempiras(rates.hnlPer[x.code])}</Text>
                    </Pressable>
                  );
                })}

                <Text style={[type.small, { color: old ? c.sos : c.muted }]}>
                  {(old ? t('fxOffline') : t('fxNote')).replace('{d}', rates.publishedAt.slice(0, 10))}
                </Text>
                {old && !loading && (
                  <Pressable accessibilityRole="button" onPress={refresh}>
                    <Text style={[type.label, { color: c.ink, textDecorationLine: 'underline' }]}>{t('fxRetry')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => Linking.openURL(rates.source === 'currency-api' ? 'https://github.com/fawazahmed0/exchange-api' : 'https://www.exchangerate-api.com')}>
                  <Text style={[type.small, { color: c.muted, textDecorationLine: 'underline' }]}>
                    {rates.source === 'currency-api' ? 'Rates by currency-api' : 'Rates by Exchange Rate API'}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-end' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(8) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.sm },
  conv: { borderWidth: 1, borderRadius: radius.lg, padding: space(3), gap: space(2) },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  input: { width: 104, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  swap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
