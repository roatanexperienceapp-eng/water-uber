import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShareQR } from '@/components/ShareQR';
import { PORTALS } from '@/data/catalogue';
import { listingFit, useMyShip } from '@/lib/cruise';
import { phone as fmtPhone } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';
import type { Listing } from '@/types';

/** One business in a list. Info listings get Call + Directions; others get Book / Request. */
export function ListingRow({ listing: l, likely, showPortal }: { listing: Listing; likely?: boolean; showPortal?: boolean }) {
  const { t } = useTranslation();
  const c = useTheme();
  const portal = PORTALS.find((p) => p.key === l.portal);
  const info = l.booking === 'info';
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name}, ${l.area}, Roatán, Honduras`)}`;
  const tag = l.ours ? t('ours') : l.tag ? t(l.tag) : likely ? t('likelySells') : '';
  const ship = useMyShip();
  const fit = listingFit(ship, l);

  return (
    <View style={[styles.row, { borderBottomColor: c.line, opacity: fit === 'no' ? 0.55 : 1 }]}>
      <View style={styles.top}>
        <View style={[styles.thumb, { backgroundColor: c.tile }]}>
          <Text style={{ fontSize: 24 }}>{portal?.icon ?? '📍'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {tag ? <Text style={[type.label, { color: c.flame }]}>{tag}</Text> : null}
          <Text style={[type.bodyStrong, { color: c.ink }]}>{l.name}</Text>
          <Text style={[type.small, { color: c.muted }]}>
            {[showPortal ? portal?.names.en : null, l.area, l.rating ? `${l.rating}★ · ${l.reviews} reviews` : null, l.phone ? fmtPhone(l.phone) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {l.description ? <Text style={[type.small, { color: c.muted }]}>{l.description}</Text> : null}
          {fit ? (
            <Text style={[type.label, { color: fit === 'fits' ? '#16A34A' : fit === 'no' ? c.sos : c.muted }]}>
              {fit === 'fits' ? `✓ ${t('fitsPort')}` : fit === 'no' ? `✕ ${t('missesPort')}` : t('fitUnknownShort')}
              {fit === 'fits' && l.portPickup ? ` · ${t('portPickup')}` : ''}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.foot}>
        <Text style={[l.priceText ? type.bodyStrong : type.small, { color: l.priceText ? c.ink : c.muted }]}>
          {info ? '' : l.priceText ?? t('askPrice')}
        </Text>
        <View style={styles.actions}>
          {info && l.phone ? (
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${l.phone}`)} style={[styles.btn, { backgroundColor: c.tile }]}>
              <Text style={[type.label, { color: c.ink, fontSize: 14 }]}>📞 {t('call')}</Text>
            </Pressable>
          ) : null}
          {info ? (
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(maps)} style={[styles.btn, { backgroundColor: c.ink }]}>
              <Text style={[type.label, { color: c.onInk, fontSize: 14 }]}>{t('directions')}</Text>
            </Pressable>
          ) : null}
          {!info ? <ShareQR id={l.id} name={l.name} /> : null}
          {info ? null : (
            <Pressable
              accessibilityRole="button"
              disabled={fit === 'no'}
              onPress={() => router.push({ pathname: '/checkout', params: { kind: 'listing', id: l.id } })}
              style={[styles.btn, { backgroundColor: c.ink }]}
            >
              <Text style={[type.label, { color: c.onInk, fontSize: 14 }]}>{l.booking === 'instant' ? t('bookBtn') : t('quoteBtn')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space(4), borderBottomWidth: 1, gap: space(3) },
  top: { flexDirection: 'row', gap: space(3) },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  actions: { flexDirection: 'row', gap: space(2) },
  btn: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
});
