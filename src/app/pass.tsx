import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PASS_GROUP_SIZES, passBreakEvenRides, passFor, passSizeFor } from '../../supabase/functions/_shared/features.ts';
import { Button, Card, Note } from '@/components/ui';
import { usd } from '@/lib/format';
import { passName } from '@/lib/passName';
import { currentPass, type GuestPass } from '@/lib/stay';
import { shortDate } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Ride passes: pick your group size and 1 or 2 weeks. Prices come from FEATURE_SETTINGS (owner prices):
 * $35 per person per week; two weeks is double. Unlimited West End ↔ West Bay rides for the whole group.
 */
export default function PassScreen() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [active, setActive] = useState<GuestPass | null>(null);
  const [size, setSize] = useState<number>(passSizeFor(Number(group) || 2));
  const [days, setDays] = useState<7 | 14>(7);
  useFocusEffect(
    useCallback(() => {
      currentPass().then(setActive).catch(() => {});
    }, []),
  );
  const pass = passFor(size, days)!;
  const perPersonWeek = pass.priceUsd / pass.riders / (days / 7);

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
            <Text style={[type.h2, { color: c.onInk }]}>{passName(t, active.passId)}</Text>
            <Text style={[type.small, { color: c.onInk, opacity: 0.8 }]}>
              {t('passExpires').replace('{d}', shortDate(active.expiresAt, i18n.language))} · {t('passUnlimited')}
            </Text>
          </Card>
        )}

        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('passHowMany')}</Text>
        <View style={styles.sizes}>
          {PASS_GROUP_SIZES.map((n) => {
            const on = n === size;
            return (
              <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t('passPeople').replace('{n}', String(n))} onPress={() => setSize(n)} style={[styles.size, { backgroundColor: on ? c.ink : c.tile }]}>
                <Text style={[type.h2, { color: on ? c.onInk : c.ink }]}>{n}</Text>
                <Text style={[type.label, { color: on ? c.onInk : c.muted }]}>{t('peopleShort')}</Text>
              </Pressable>
            );
          })}
        </View>
        <Note>{t('passOddGroup')}</Note>

        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('passHowLong')}</Text>
        <View style={styles.lengths}>
          {([7, 14] as const).map((d) => {
            const on = d === days;
            const opt = passFor(size, d)!;
            return (
              <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setDays(d)} style={[styles.length, { borderColor: on ? c.flame : c.line }]}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{d === 7 ? t('oneWeek') : t('twoWeeks')}</Text>
                <Text style={[type.h1, { color: c.ink }]}>{usd(opt.priceUsd)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <Text style={[type.h2, { color: c.ink }]}>{passName(t, pass.id)}</Text>
          <Note>✓ {t('passUnlimitedGroup').replace('{n}', String(pass.riders))}</Note>
          <Note>✓ {t('passPerPerson').replace('{p}', usd(perPersonWeek))}</Note>
          <Note>✓ {t('passBreakEven').replace('{n}', String(passBreakEvenRides(pass.id)))}</Note>
          <Note>✓ {t('passExtraRule')}</Note>
          <Note>{t('passOnlyZone')}</Note>
        </Card>

        <Button label={t('buyPass')} trailing={usd(pass.priceUsd)} onPress={() => router.push({ pathname: '/checkout', params: { kind: 'pass', passId: pass.id } })} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sizes: { flexDirection: 'row', gap: space(2) },
  size: { flex: 1, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center' },
  lengths: { flexDirection: 'row', gap: space(3) },
  length: { flex: 1, borderWidth: 2, borderRadius: radius.lg, padding: space(4), gap: 4 },
});
