import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type } from '@/theme';

/** Full-screen photos a guest swipes through, such as a book's covers and details. */
export function PhotoGallery({ photos, title, visible, onClose }: { photos: ImageSourcePropType[]; title: string; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} onShow={() => setIndex(0)} supportedOrientations={['portrait']}>
      <View style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <Text style={[type.bodyStrong, styles.title]} numberOfLines={1}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={12} onPress={onClose} style={styles.close}>
            <Text style={[type.label, { color: '#fff' }]}>{t('close')}</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
        >
          {photos.map((src, i) => (
            <View key={i} style={{ width, height: height - insets.top - insets.bottom - 110, justifyContent: 'center' }}>
              <Image
                source={src}
                style={{ width: width - space(6), height: '100%', alignSelf: 'center' }}
                resizeMode="contain"
                accessibilityLabel={`${title} · ${i + 1} / ${photos.length}`}
              />
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotOn : null]} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0B0F' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  title: { flex: 1, color: '#fff' },
  close: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.16)' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: space(4) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { width: 18, backgroundColor: '#fff' },
});
