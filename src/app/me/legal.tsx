import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Text } from 'react-native';
import { FEATURE_SETTINGS } from '../../../supabase/functions/_shared/features.ts';
import { CRUISE_SETTINGS } from '../../../supabase/functions/_shared/cruise.ts';
import { MenuRow, SubScreen } from '@/components/AccountKit';
import { Card, Note } from '@/components/ui';
import { WEB_URL } from '@/config';
import { BUSINESS } from '../../../supabase/functions/_shared/business.ts';
import { type, useTheme } from '@/theme';

/** Legal: the full documents live on the website (also required for the App Store listing). */
export default function LegalScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  const open = (path: string) => Linking.openURL(`${WEB_URL}${path}`);
  return (
    <SubScreen title={t('legalH')}>
      <MenuRow icon="document-text-outline" title={t('termsH')} onPress={() => open('/terms')} />
      <MenuRow icon="lock-closed-outline" title={t('privacyH')} onPress={() => open('/privacy')} />
      <MenuRow icon="mail-outline" title={t('legalContact')} sub={BUSINESS.email} onPress={() => Linking.openURL(`mailto:${BUSINESS.email}`)} />
      <MenuRow icon="heart-outline" title={t('giveCardH')} sub={t('giveMenuSub')} onPress={() => router.push('/give')} />

      <Text style={[type.h2, { color: c.ink }]}>{t('refundsH')}</Text>
      <Card>
        <Note>• {t('refund1')}</Note>
        <Note>• {t('refund2').replace('{m}', String(CRUISE_SETTINGS.splitPayBeforeMinutes))}</Note>
        <Note>• {t('refund3').replace('{c}', String(FEATURE_SETTINGS.guarantee.missedPickupCreditUsd))}</Note>
        <Note>• {t('refund4')}</Note>
        <Note>• {t('refund5')}</Note>
      </Card>
    </SubScreen>
  );
}
