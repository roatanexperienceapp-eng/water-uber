import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingRow } from '@/components/ListingRow';
import { AllAboardBar } from '@/components/AllAboardBar';
import { CrowdMeter } from '@/components/CrowdMeter';
import { LanguageButton } from '@/components/LanguageButton';
import { ShipButton } from '@/components/ShipButton';
import { LISTINGS, PORTALS } from '@/data/catalogue';
import { searchListings } from '@/lib/search';
import { radius, space, type, useTheme } from '@/theme';
import type { LangCode } from '@/types';

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const lang = i18n.language as LangCode;
  const [q, setQ] = useState('');
  const result = useMemo(() => searchListings(q, LISTINGS, PORTALS, lang), [q, lang]);
  const searching = q.trim().length >= 2;
  const portalName = (key: string) => {
    const p = PORTALS.find((x) => x.key === key);
    return p ? (p.names[lang] ?? p.names.en) : key;
  };

  const header = (
    <View style={{ gap: space(4), paddingBottom: space(2) }}>
      <View style={styles.titleRow}>
        <Text style={[type.h1, { color: c.ink, flexShrink: 1 }]}>{t('exploreH')}</Text>
        <View style={styles.headBtns}>
          <ShipButton />
          <LanguageButton />
        </View>
      </View>
      <AllAboardBar />
      <View style={[styles.search, { backgroundColor: c.tile }]}>
        <Ionicons name="search" size={20} color={c.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('searchPh')}
          placeholderTextColor={c.muted}
          style={[type.body, styles.input, { color: c.ink }]}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="never"
          accessibilityLabel={t('searchPh')}
        />
        {q ? (
          <Pressable accessibilityLabel={t('clear')} onPress={() => setQ('')} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={c.muted} />
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <View style={{ gap: space(3) }}>
          {result.isRide ? (
            <Pressable onPress={() => router.navigate('/')} style={[styles.notice, { backgroundColor: c.tile }]}>
              <Text style={{ fontSize: 22 }}>🚤</Text>
              <Text style={[type.bodyStrong, { color: c.ink, flex: 1 }]}>{t('goRide')}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          ) : null}
          {result.portals.length ? (
            <View style={styles.chips}>
              {result.portals.map((k) => (
                <Pressable key={k} onPress={() => router.push(`/portal/${k}`)} style={[styles.chip, { backgroundColor: c.tile }]}>
                  <Text style={[type.label, { color: c.ink, fontSize: 14 }]}>
                    {PORTALS.find((p) => p.key === k)?.icon} {portalName(k)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {result.isProduct ? <Text style={[type.small, { color: c.muted }]}>{t('callAhead')}</Text> : null}
          <Text style={[type.h2, { color: c.ink }]}>{t('results')}</Text>
        </View>
      ) : (
        <View style={{ gap: space(4) }}>
          <CrowdMeter />
          <View style={styles.promo}>
            <Image source={require('../../../assets/images/promo.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.promoShade} />
            <View style={styles.promoText}>
              <Text style={[type.h2, { color: '#fff' }]}>{t('promoH')}</Text>
              <Text style={[type.small, { color: '#fff' }]}>{t('promoS')}</Text>
            </View>
          </View>
          <View style={styles.grid}>
            {PORTALS.map((p) => (
              <Pressable key={p.key} accessibilityRole="button" onPress={() => router.push(`/portal/${p.key}`)} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: c.tile }]}>
                  <Text style={styles.tileEmoji}>{p.icon}</Text>
                </View>
                <Text style={[styles.tileLabel, { color: c.ink }]} numberOfLines={2}>
                  {p.names[lang] ?? p.names.en}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('giveCardH')} onPress={() => router.push('/give')} style={[styles.give, { backgroundColor: c.tile }]}>
            <Image source={require('../../../assets/images/giveback.jpg')} style={styles.giveImg} resizeMode="cover" />
            <View style={styles.giveBar}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{t('giveCardH')}</Text>
                <Text style={[type.small, { color: c.muted }]}>{t('giveCardS')}</Text>
              </View>
              <View style={[styles.giveBtn, { backgroundColor: c.flame }]}>
                <Text style={[type.label, { color: '#fff', fontSize: 14 }]}>{t('giveDonateShort')}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <FlatList
        data={searching ? result.hits : []}
        keyExtractor={(h) => h.listing.id}
        renderItem={({ item }) => <ListingRow listing={item.listing} likely={item.likely} showPortal />}
        ListHeaderComponent={header}
        ListEmptyComponent={searching ? <Text style={[type.body, { color: c.muted, paddingVertical: space(6) }]}>{t('noResults')}</Text> : null}
        contentContainerStyle={{ paddingHorizontal: space(4), paddingTop: space(2), paddingBottom: space(10) }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  headBtns: { flexDirection: 'row', gap: space(2) },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.pill, paddingHorizontal: space(4), minHeight: 50 },
  input: { flex: 1, paddingVertical: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  promo: { height: 150, borderRadius: radius.lg, overflow: 'hidden' },
  promoShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  promoText: { position: 'absolute', left: space(4), bottom: space(4), right: '35%', gap: 2 },
  // Round tiles, three per row: big light circle, large icon, label underneath.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(5) },
  tile: { width: '33.333%', alignItems: 'center', gap: space(2), paddingHorizontal: space(2) },
  tileIcon: { width: '92%', aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 48, lineHeight: 58 },
  tileLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center', letterSpacing: -0.2 },
  give: { borderRadius: radius.lg, overflow: 'hidden' },
  giveImg: { width: '100%', aspectRatio: 1000 / 656 },
  giveBar: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) },
  giveBtn: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
});
