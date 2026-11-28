import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PhotoGallery } from '@/components/PhotoGallery';
import { ShareQR } from '@/components/ShareQR';
import { LISTING_GALLERIES, LISTING_IMAGES } from '@/data/listingImages';
import { bitingIsFresh } from '@/lib/charter';
import { radius, space, type, useTheme } from '@/theme';
import type { BiteLevel, Listing } from '@/types';

const BITE_COLORS: Record<BiteLevel, { bg: string; fg: string }> = {
  hot: { bg: '#E3F4E8', fg: '#166534' },
  good: { bg: '#E3F4E8', fg: '#166534' },
  slow: { bg: '#FDF1D8', fg: '#8A5A00' },
};
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Fishing charter profile: captain and badges, what's biting, and the trip menu with prices. */
export function CharterCard({ listing: l }: { listing: Listing }) {
  const { t } = useTranslation();
  const c = useTheme();
  const ch = l.charter ?? {};
  const cover = LISTING_IMAGES[l.id];
  const gallery = LISTING_GALLERIES[l.id];
  const [galleryOpen, setGalleryOpen] = useState(false);
  const trips = ch.trips ?? [];
  const biting = bitingIsFresh(ch.bitingUpdated) ? ch.biting ?? [] : [];
  const who = ch.captain ? `Capt. ${ch.captain} · ${l.name}` : l.name;
  const sub = [ch.boat, l.area, l.rating ? `${l.rating}★ · ${l.reviews} reviews` : null].filter(Boolean).join(' · ');
  const book = () => router.push({ pathname: '/checkout', params: { kind: 'listing', id: l.id } });

  return (
    <View style={[styles.card, { borderColor: c.line, backgroundColor: c.bg }]}>
      {cover ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${l.name} · ${gallery?.length ?? 1} ${t('photos')}`} disabled={!gallery} onPress={() => setGalleryOpen(true)}>
          <Image source={cover} style={styles.cover} resizeMode="cover" />
          {gallery ? (
            <View style={styles.count}>
              <Text style={styles.countText}>1/{gallery.length}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: c.tile }]}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{initials(ch.captain ?? l.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {l.ours ? <Text style={[type.label, { color: c.flame }]}>{t('ours')}</Text> : null}
            <Text style={[type.bodyStrong, { color: c.ink }]}>{who}</Text>
            {sub ? <Text style={[type.small, { color: c.muted }]}>{sub}</Text> : null}
          </View>
        </View>

        <View style={styles.chips}>
          {ch.certified ? <Chip bg="#E3F4E8" fg="#166534" text={`✓ ${t('certified')}`} /> : null}
          {l.portPickup ? <Chip bg="#E6F1FB" fg="#0C447C" text={`⚓ ${t('portPickup')}`} /> : null}
          {ch.yearsOnWater ? <Chip bg={c.tile} fg={c.muted} text={t('yrsWater', { n: ch.yearsOnWater })} /> : null}
        </View>

        {biting.length ? (
          <View style={[styles.section, { borderTopColor: c.line }]}>
            <Text style={[type.small, { color: c.muted }]}>🎣 {t('bitingWeek')}</Text>
            <View style={styles.chips}>
              {biting.map((b) => (
                <Chip key={b.fish} bg={BITE_COLORS[b.level].bg} fg={BITE_COLORS[b.level].fg} text={`${b.fish} · ${t(`bite_${b.level}`)}`} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.section, { borderTopColor: c.line }]}>
          {trips.length ? (
            trips.map((tr, i) => (
              <Pressable
                key={tr.name}
                accessibilityRole="button"
                onPress={book}
                style={[styles.trip, i < trips.length - 1 ? { borderBottomWidth: 1, borderBottomColor: c.line } : null]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.ink }]}>{tr.name}</Text>
                  {tr.detail ? <Text style={[type.small, { color: c.muted }]}>{tr.detail}</Text> : null}
                </View>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{tr.priceText}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={[type.small, { color: c.muted }]}>{l.priceText ?? t('tripsAsk')}</Text>
          )}
        </View>

        <View style={styles.foot}>
          <ShareQR id={l.id} name={l.name} />
          <Pressable accessibilityRole="button" onPress={book} style={[styles.btn, { backgroundColor: c.ink }]}>
            <Text style={[type.label, { color: c.onInk, fontSize: 14 }]}>{trips.length ? t('chooseTrip') : t('quoteBtn')}</Text>
          </Pressable>
        </View>
      </View>
      {gallery ? <PhotoGallery photos={gallery} title={l.name} visible={galleryOpen} onClose={() => setGalleryOpen(false)} /> : null}
    </View>
  );
}

function Chip({ bg, fg, text }: { bg: string; fg: string; text: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[type.label, { color: fg, fontSize: 12 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginVertical: space(2) },
  cover: { width: '100%', height: 180 },
  count: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  body: { padding: space(3), gap: space(2) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  section: { borderTopWidth: 1, paddingTop: space(2), gap: 6 },
  trip: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2), gap: space(2) },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space(2) },
  btn: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
});
