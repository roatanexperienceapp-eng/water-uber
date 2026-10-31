import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { askAssistant, isDemo, type ChatTurn } from '@/lib/api';
import { radius, space, type, useTheme } from '@/theme';

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [turns, setTurns] = useState<ChatTurn[]>([{ role: 'assistant', content: t('hi') }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const chips = t('chips', { returnObjects: true }) as string[];

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setText('');
    setBusy(true);
    try {
      const answer = isDemo ? t('offline') : await askAssistant(next.slice(1), i18n.language);
      setTurns([...next, { role: 'assistant', content: answer }]);
    } catch {
      setTurns([...next, { role: 'assistant', content: t('assistantErr') }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: c.flame }]} />
        <Text style={[type.h2, { color: c.ink, flex: 1 }]}>{t('chatH')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.round, { backgroundColor: c.tile }]}>
          <Ionicons name="close" size={20} color={c.ink} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space(4), gap: space(3) }}>
          {turns.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: c.ink } : { alignSelf: 'flex-start', backgroundColor: c.tile }]}>
              <Text style={[type.body, { color: m.role === 'user' ? c.onInk : c.ink }]}>{m.content}</Text>
            </View>
          ))}
          {turns.length === 1 &&
            chips.map((q) => (
              <Pressable key={q} onPress={() => send(q)} style={[styles.chip, { borderColor: c.line }]}>
                <Text style={[type.label, { color: c.ink, fontSize: 14 }]}>{q}</Text>
              </Pressable>
            ))}
        </ScrollView>
        <View style={[styles.bar, { borderTopColor: c.line }]}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={() => send(text)} placeholder={t('ask')} placeholderTextColor={c.muted} style={[styles.input, { backgroundColor: c.tile, color: c.ink }]} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('send')} onPress={() => send(text)} style={[styles.round, { backgroundColor: c.flame }]}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) },
  dot: { width: 12, height: 12, borderRadius: 6 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: space(4), paddingVertical: space(3) },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderTopWidth: 1 },
  input: { flex: 1, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16 },
});
