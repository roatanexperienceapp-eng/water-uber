import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FEATURE_SETTINGS } from '../../../supabase/functions/_shared/features.ts';
import { MenuRow, SubScreen } from '@/components/AccountKit';
import { setFlag } from '@/lib/account';
import { hourLabel } from '@/lib/stayUi';
import { radius, space, type, useTheme } from '@/theme';

/** Safety center: emergency numbers, how we keep rides safe, and a fast way to report a problem. */
export default function SafetyScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  useEffect(() => setFlag('readSafety'), []);

  const rules: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
    { icon: 'moon-outline', title: t('nightSafety'), body: `${t('nightMsg')} ${t('closedMsg').replace('{h}', hourLabel(FEATURE_SETTINGS.night.lastBoatHour, i18n.language))}` },
    { icon: 'happy-outline', title: t('ruleKidsH'), body: t('ruleKids') },
    { icon: 'water-outline', title: t('seaTitle'), body: t('ruleSea') },
    { icon: 'shield-checkmark-outline', title: t('guaranteeH'), body: t('guaranteeMsg').replace('{c}', String(FEATURE_SETTINGS.guarantee.missedPickupCreditUsd)) },
    { icon: 'share-social-outline', title: t('shareRide'), body: t('ruleShare') },
    { icon: 'people-outline', title: t('ruleCaptainsH'), body: t('ruleCaptains') },
  ];

  return (
    <SubScreen title={t('safetyH')}>
      <Pressable accessibilityRole="button" onPress={() => Linking.openURL('tel:911')} style={[styles.sos, { backgroundColor: c.sos }]}>
        <Ionicons name="call" size={22} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: '#fff' }]}>{t('call911')}</Text>
          <Text style={[type.small, { color: '#fff', opacity: 0.9 }]}>{t('call911Sub')}</Text>
        </View>
      </Pressable>
      <MenuRow icon="medkit-outline" title={t('nearestHospital')} sub={t('nearestHospitalSub')} onPress={() => router.push('/portal/med')} />
      <MenuRow icon="alert-circle-outline" title={t('reportSafety')} sub={t('reportSafetySub')} danger onPress={() => router.push({ pathname: '/me/help', params: { topic: 'safety' } })} />

      <Text style={[type.h2, { color: c.ink }]}>{t('howWeKeepSafe')}</Text>
      {rules.map((r) => (
        <View key={r.title} style={[styles.rule, { backgroundColor: c.tile }]}>
          <Ionicons name={r.icon} size={22} color={c.flame} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{r.title}</Text>
            <Text style={[type.small, { color: c.muted }]}>{r.body}</Text>
          </View>
        </View>
      ))}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  sos: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(4) },
  rule: { flexDirection: 'row', gap: space(3), borderRadius: radius.md, padding: space(4) },
});
