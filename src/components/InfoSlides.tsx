import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { setService } from '@/lib/service';
import { radius, space, type } from '@/theme';

type Slide = {
  key: string;
  bg: string;
  emoji?: string;
  image?: ImageSourcePropType;
  go?: () => void;
};

const goTo = (href: Href) => () => router.push(href);

/** Explore's top banner: a slide show of the things guests should know. Each slide stays 4 seconds. */
const SLIDES: Slide[] = [
  { key: 'crowd', bg: '#0E7490', image: require('../../assets/images/promo.jpg'), go: () => router.navigate('/') },
  { key: 'pass', bg: '#0B4466', emoji: '🎟️', go: goTo('/pass') },
  { key: 'package', bg: '#7C3AED', emoji: '🏝️', go: goTo('/pass') },
  { key: 'land', bg: '#111827', emoji: '🚕', go: () => { setService('land'); router.navigate('/'); } },
  { key: 'shared', bg: '#0369A1', emoji: '🚤', go: () => { setService('water'); router.navigate('/'); } },
  { key: 'ship', bg: '#065F46', emoji: '🚢' },
  { key: 'give', bg: '#B45309', emoji: '💛', go: goTo('/give') },
];
const SLIDE_MS = 4000;

export function InfoSlides() {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const show = useCallback((i: number, animated = true) => {
    if (!width) return;
    scroller.current?.scrollTo({ x: i * width, animated });
    setIndex(i);
  }, [width]);

  // Advance every 4 seconds, unless the guest is swiping, has just swiped, or has reduce-motion on.
  useEffect(() => {
    if (!width || paused || reduceMotion) return;
    const id = setTimeout(() => show((index + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, width, paused, reduceMotion, show]);

  useEffect(() => () => { if (resume.current) clearTimeout(resume.current); }, []);

  const holdThenResume = () => {
    setPaused(true);
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => setPaused(false), 8000);
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width ? (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={holdThenResume}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.key}
              accessibilityRole={s.go ? 'button' : 'text'}
              accessibilityLabel={`${t(`slide_${s.key}_h`)}. ${t(`slide_${s.key}_s`)}`}
              accessibilityHint={`${i + 1} / ${SLIDES.length}`}
              onPress={s.go}
              style={[styles.slide, { width, backgroundColor: s.bg }]}
            >
              {s.image ? (
                <>
                  <Image source={s.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.shade} />
                </>
              ) : (
                <Text style={styles.emoji} importantForAccessibility="no">{s.emoji}</Text>
              )}
              <View style={styles.text}>
                <Text style={[type.h2, styles.h]} numberOfLines={2}>{t(`slide_${s.key}_h`)}</Text>
                <Text style={[type.small, styles.s]} numberOfLines={3}>{t(`slide_${s.key}_s`)}</Text>
                {s.go ? <Text style={[type.label, styles.cta]}>{t(`slide_${s.key}_cta`)} →</Text> : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.dots} pointerEvents="box-none">
        {SLIDES.map((s, i) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1} / ${SLIDES.length}`}
            hitSlop={8}
            onPress={() => { holdThenResume(); show(i); }}
            style={[styles.dot, i === index ? styles.dotOn : null]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 150, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#0E7490' },
  slide: { height: 150, overflow: 'hidden' },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.38)' },
  emoji: { position: 'absolute', right: space(4), top: space(3), fontSize: 64, opacity: 0.95 },
  text: { position: 'absolute', left: space(4), bottom: space(6), right: '30%', gap: 2 },
  h: { color: '#fff' },
  s: { color: '#fff', opacity: 0.92 },
  cta: { color: '#fff', marginTop: 4, fontSize: 13 },
  dots: { position: 'absolute', bottom: space(2), left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotOn: { width: 18, backgroundColor: '#fff' },
});
