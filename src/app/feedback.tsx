import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Button, Note } from '@/components/ui';
import { ago } from '@/lib/ago';
import { myFeedback, sendFeedback, type Feedback, type FeedbackKind } from '@/lib/feedback';
import { radius, space, type, useTheme } from '@/theme';

const KINDS: { kind: FeedbackKind; icon: string }[] = [
  { kind: 'love', icon: '💛' },
  { kind: 'idea', icon: '💡' },
  { kind: 'confusing', icon: '🤔' },
  { kind: 'bug', icon: '🐞' },
];

/** Private feedback to the team: a star rating plus what's great, confusing or broken. */
export default function FeedbackScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [rating, setRating] = useState<number | null>(null);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState<Feedback[]>([]);

  useEffect(() => {
    myFeedback().then(setMine).catch(() => {});
  }, [sent]);

  async function send() {
    setBusy(true);
    setErr('');
    try {
      await sendFeedback({ rating, kind, body });
      setSent(true);
      setBody('');
      setRating(null);
    } catch (e) {
      setErr((e as Error).message === 'empty' ? t('fbEmpty') : t('cErr_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubScreen title={t('fbH')}>
      <Note>{t('fbSub')}</Note>
      {sent ? (
        <View style={[styles.thanks, { backgroundColor: '#E8F7EE' }]}>
          <Text style={[type.bodyStrong, { color: '#14532D' }]}>🙏 {t('fbThanks')}</Text>
          <Pressable onPress={() => setSent(false)}>
            <Text style={[type.small, { color: '#14532D', textDecorationLine: 'underline' }]}>{t('fbAnother')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: space(3) }}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n}`} onPress={() => setRating(rating === n ? null : n)} hitSlop={6}>
                <Ionicons name={rating && n <= rating ? 'star' : 'star-outline'} size={32} color={rating && n <= rating ? '#F5A524' : c.muted} />
              </Pressable>
            ))}
          </View>
          <View style={styles.kinds}>
            {KINDS.map((k) => {
              const on = k.kind === kind;
              return (
                <Pressable key={k.kind} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setKind(k.kind)} style={[styles.kind, { backgroundColor: on ? c.ink : c.tile }]}>
                  <Text style={[type.label, { fontSize: 13, color: on ? c.onInk : c.ink }]}>{k.icon} {t(`fb_${k.kind}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder={t(`fbPh_${kind}`)} placeholderTextColor={c.muted} style={[type.body, styles.box, { color: c.ink, backgroundColor: c.tile }]} accessibilityLabel={t('fbH')} />
          {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
          <Button label={t('fbSend')} onPress={send} loading={busy} />
        </View>
      )}
      {mine.length > 0 && (
        <View style={{ gap: space(2) }}>
          <Text style={[type.label, { color: c.muted }]}>{t('fbMine')}</Text>
          {mine.slice(0, 5).map((f) => (
            <View key={f.id} style={[styles.past, { borderColor: c.line }]}>
              <Text style={[type.small, { color: c.muted }]}>
                {KINDS.find((k) => k.kind === f.kind)?.icon} {f.rating ? '★'.repeat(f.rating) : ''} · {ago(f.createdAt, i18n.language)}
              </Text>
              {f.body ? <Text style={[type.small, { color: c.ink }]} numberOfLines={3}>{f.body}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: space(2), justifyContent: 'center' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  kind: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  box: { minHeight: 110, borderRadius: radius.md, padding: space(3), textAlignVertical: 'top' },
  thanks: { borderRadius: radius.lg, padding: space(4), gap: space(2) },
  past: { borderWidth: 1, borderRadius: radius.md, padding: space(3), gap: 4 },
});
