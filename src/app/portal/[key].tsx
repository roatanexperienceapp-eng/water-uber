import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingRow } from '@/components/ListingRow';
import { LISTINGS, PORTALS } from '@/data/catalogue';
import { radius, space, type, useTheme } from '@/theme';
import type { LangCode, Listing } from '@/types';
import { kmBetween } from '../../../supabase/functions/_shared/geo.ts';
import { HOME_CENTER } from '@/config';

export default function PortalScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const portal = PORTALS.find((p) => p.key === key);
  const info = portal?.kind === 'info';
  const dist = (l: Listing) => (l.coords ? kmBetween(l.coords, [HOME_CENTER.longitude, HOME_CENTER.latitude]) : 999);
  // Info portals (pharmacies, hospitals): nearest to West End first. Others: your own listings first.
  const items = LISTINGS.filter((l) => l.portal === key).sort((a, b) => (info ? dist(a) - dist(b) : Number(!!b.ours) - Number(!!a.ours)));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => <ListingRow listing={item} />}
        contentContainerStyle={{ paddingHorizontal: space(4), paddingBottom: space(10) }}
        ListHeaderComponent={
          <View style={{ gap: space(2), paddingTop: space(2), paddingBottom: space(2) }}>
            <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/explore'))} style={[styles.back, { backgroundColor: c.tile }]}>
              <Ionicons name="chevron-back" size={18} color={c.ink} />
              <Text style={[type.label, { color: c.ink, fontSize: 15 }]}>{t('backLbl')}</Text>
            </Pressable>
            <Text style={[type.h1, { color: c.ink }]}>
              {portal?.icon} {portal ? (portal.names[i18n.language as LangCode] ?? portal.names.en) : ''}
            </Text>
            <Text style={[type.small, { color: c.muted }]}>
              {items.length} {t('options')}
              {info ? ` · ${t('infoNote')}` : ''}
            </Text>
            {key === 'med' ? (
              <Pressable accessibilityRole="button" onPress={() => import('react-native').then(({ Linking }) => Linking.openURL('tel:911'))} style={[styles.sos]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: '#1a1a1a' }]}>{t('sosH')}</Text>
                  <Text style={[type.small, { color: '#5a3b37' }]}>{t('sosS')}</Text>
                </View>
                <View style={[styles.sosBtn, { backgroundColor: c.sos }]}>
                  <Text style={[type.bodyStrong, { color: '#fff' }]}>📞 911</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  sos: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: '#FDECEA', borderRadius: radius.md, padding: space(4), marginTop: space(2) },
  sosBtn: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
});
