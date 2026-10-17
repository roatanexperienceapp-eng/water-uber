import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FEATURE_SETTINGS, passBreakEvenRides } from '../../supabase/functions/_shared/features.ts';
import { Card, Note } from '@/components/ui';
import { usd } from '@/lib/format';
import { currentPass, type GuestPass } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

/** Feature 4: week passes and ride packs. Prices come from FEATURE_SETTINGS (owner options). */
export default function PassScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [active, setActive] = useState<GuestPass | null>(null);
  useFocusEffect(
    useCallback(() => {
      currentPass().then(setActive).catch(() => {});
    }, []),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(12) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.round, { backgroundColor: c.tile }]}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[type.h1, { color: c.ink }]}>{t('passTitle')}</Text>
        <Note>{t('passIntro')}</Note>

        {active && (
          <Card style={{ backgroundColor: c.ink }}>
            <Text style={[type.label, { color: c.flame }]}>{t('passActive')}</Text>
            <Text style={[type.h2, { color: c.onInk }]}>{t(`pass_${active.passId}`)}</Text>
            <Text style={[type.small, { color: c.onInk, opacity: 0.8 }]}>
              {t('passExpires').replace('{d}', shortDate(active.expiresAt, i18n.language))} ·{' '}
              {active.ridesLeft === null ? t('passUnlimited') : t('passLeft').replace('{n}', String(active.ridesLeft))}
            </Text>
          </Card>
        )}

        {FEATURE_SETTINGS.passes.map((p, i) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/checkout', params: { kind: 'pass', passId: p.id } })}
            style={[styles.option, { borderColor: i === 0 ? c.flame : c.line }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              {i === 0 && <Text style={[type.label, { color: c.flame }]}>{t('passPopular')}</Text>}
              <Text style={[type.h2, { color: c.ink }]}>{t(`pass_${p.id}`)}</Text>
              <Note>
                {t('passDays').replace('{d}', String(p.days))} · {p.rides ? t('passRides').replace('{n}', String(p.rides)) : t('passUnlimited')}
              </Note>
              <Note>{p.riders === 1 ? t('passOneRider') : t('passRiders').replace('{n}', String(p.riders))}</Note>
              <Text style={[type.small, { color: c.ink, fontWeight: '700' }]}>{t('passBreakEven').replace('{n}', String(passBreakEvenRides(p.id)))}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: space(2) }}>
              <Text style={[type.h1, { color: c.ink }]}>{usd(p.priceUsd)}</Text>
              <View style={[styles.buy, { backgroundColor: c.flame }]}>
                <Text style={[type.label, { color: '#fff', fontSize: 14 }]}>{t('buyPass')}</Text>
              </View>
            </View>
          </Pressable>
        ))}
        <Note>{t('passOnlyZone')}</Note>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', gap: space(3), borderWidth: 2, borderRadius: radius.lg, padding: space(4) },
  buy: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
