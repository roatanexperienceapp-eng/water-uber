import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CURRENCIES, lempiras, money, myCurrency, setMyCurrency, useFx, type CurrencyCode } from '@/lib/fx';
import { radius, space, type, useTheme } from '@/theme';

/** Pill under the language button: today's lempira rate for the guest's currency; opens all 7 + a converter. */
export function CurrencyButton() {
  const { t } = useTranslation();
  const c = useTheme();
  const { rates, loading, failed, refresh } = useFx();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<CurrencyCode>(myCurrency);
  const [amount, setAmount] = useState('100');
  const cur = CURRENCIES.find((x) => x.code === mine)!;
  const rate = rates?.hnlPer[mine];
  const n = Number(amount.replace(',', '.'));

  function pick(code: CurrencyCode) {
    setMine(code);
    setMyCurrency(code);
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('fxTitle')} onPress={() => setOpen(true)} style={[styles.pill, { backgroundColor: c.tile }]}>
        <Text style={[type.label, { fontSize: 13, color: c.ink }]}>
          {cur.flag} {rate ? lempiras(rate) : loading ? '…' : 'L —'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.bg }]} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ gap: space(3) }} keyboardShouldPersistTaps="handled">
              <View>
                <Text style={[type.h2, { color: c.ink }]}>{t('fxTitle')}</Text>
                <Text style={[type.small, { color: c.muted }]}>{t('fxSub')}</Text>
              </View>

              {!rates && loading && <ActivityIndicator color={c.flame} />}
              {!rates && failed && (
                <Pressable onPress={refresh}>
                  <Text style={[type.body, { color: c.sos }]}>{t('fxError')}</Text>
                </Pressable>
              )}

              {rates && (
                <>
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
                        <Text style={[type.bodyStrong, { color: c.ink }]}>
                          1 = {lempiras(rates.hnlPer[x.code])}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {/* Converter in the guest's currency */}
                  <View style={[styles.conv, { borderColor: c.line }]}>
                    <Text style={[type.label, { color: c.muted }]}>{t('fxConvert')}</Text>
                    <View style={styles.convRow}>
                      <Text style={[type.h2, { color: c.ink }]}>{cur.symbol}</Text>
                      <TextInput
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        style={[type.h2, styles.input, { color: c.ink, backgroundColor: c.tile }]}
                        accessibilityLabel={t('fxConvert')}
                      />
                      <Text style={[type.h2, { color: c.ink }]}>=</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[type.h2, { color: c.flame, flex: 1, textAlign: 'right' }]}>{n > 0 && rate ? lempiras(n * rate) : 'L —'}</Text>
                    </View>
                  </View>

                  <Text style={[type.small, { color: c.muted }]}>
                    {(failed ? t('fxOffline') : t('fxNote')).replace('{d}', rates.publishedAt.slice(0, 10))}
                  </Text>
                  <Pressable onPress={() => Linking.openURL(rates.source === 'exchangerate-api' ? 'https://www.exchangerate-api.com' : 'https://github.com/fawazahmed0/exchange-api')}>
                    <Text style={[type.small, { color: c.muted, textDecorationLine: 'underline' }]}>
                      {rates.source === 'exchangerate-api' ? 'Rates by Exchange Rate API' : 'Rates by currency-api'}
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-end' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.sm },
  conv: { borderWidth: 1, borderRadius: radius.lg, padding: space(3), gap: space(2) },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  input: { width: 110, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
});
