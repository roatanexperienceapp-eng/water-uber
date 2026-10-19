import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MenuRow, SubScreen } from '@/components/AccountKit';
import { Button, Card, Note } from '@/components/ui';
import { sendSupportRequest, type SupportTopic } from '@/lib/account';
import { BUSINESS } from '../../../supabase/functions/_shared/business.ts';
import { radius, space, type, useTheme } from '@/theme';

const TOPICS: SupportTopic[] = ['ride', 'tour', 'payment', 'lost', 'safety', 'other'];

/** Help: Isla for quick answers; a message to the team (reply lands in the Inbox); 911 for emergencies. */
export default function HelpScreen() {
  const { topic: initial } = useLocalSearchParams<{ topic?: SupportTopic }>();
  const { t } = useTranslation();
  const c = useTheme();
  const [topic, setTopic] = useState<SupportTopic>(TOPICS.includes(initial as SupportTopic) ? (initial as SupportTopic) : 'ride');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true);
    setErr('');
    try {
      await sendSupportRequest(topic, message);
      setSent(true);
      setMessage('');
    } catch {
      setErr(t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubScreen title={t('helpH')}>
      <Pressable accessibilityRole="button" onPress={() => Linking.openURL('tel:911')} style={[styles.sos, { backgroundColor: '#FDECEA' }]}>
        <Text style={[type.bodyStrong, { color: '#1a1a1a', flex: 1 }]}>{t('emergency911')}</Text>
        <View style={[styles.call, { backgroundColor: c.sos }]}>
          <Text style={[type.bodyStrong, { color: '#fff' }]}>📞 911</Text>
        </View>
      </Pressable>

      <MenuRow icon="sparkles-outline" title={t('ask')} sub={t('askIslaSub')} onPress={() => router.push('/assistant')} />
      <MenuRow icon="receipt-outline" title={t('helpTrip')} sub={t('helpTripSub')} onPress={() => router.navigate('/trips')} />

      <Text style={[type.h2, { color: c.ink }]}>{t('contactDirectH')}</Text>
      <MenuRow icon="call-outline" title={t('callUs')} sub={BUSINESS.phoneDisplay} onPress={() => Linking.openURL(`tel:${BUSINESS.phoneE164}`)} />
      {BUSINESS.whatsapp && (
        <MenuRow icon="logo-whatsapp" title="WhatsApp" sub={BUSINESS.phoneDisplay} onPress={() => Linking.openURL(`https://wa.me/${BUSINESS.phoneE164.replace(/\D/g, '')}`)} />
      )}
      <MenuRow icon="mail-outline" title={t('emailUs')} sub={BUSINESS.email} onPress={() => Linking.openURL(`mailto:${BUSINESS.email}`)} />

      <Text style={[type.h2, { color: c.ink }]}>{t('contactTeam')}</Text>
      {sent ? (
        <Card>
          <Text style={[type.bodyStrong, { color: c.ink }]}>{t('helpSent')}</Text>
          <Note>{t('helpSentSub')}</Note>
          <Button small variant="tile" label={t('inboxH')} onPress={() => router.push('/inbox')} />
        </Card>
      ) : (
        <>
          <View style={styles.wrap}>
            {TOPICS.map((k) => (
              <Pressable key={k} onPress={() => setTopic(k)} style={[styles.chip, { backgroundColor: topic === k ? (k === 'safety' ? c.sos : c.ink) : c.tile }]}>
                <Text style={[type.label, { fontSize: 14, color: topic === k ? '#fff' : c.ink }]}>{t(`topic_${k}`)}</Text>
              </Pressable>
            ))}
          </View>
          {topic === 'safety' && <Note>{t('safetyTopicNote')}</Note>}
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            placeholder={t('helpPh')}
            placeholderTextColor={c.muted}
            style={[styles.area, { backgroundColor: c.tile, color: c.ink }]}
          />
          <Button label={t('sendBtn')} loading={busy} disabled={message.trim().length < 5} onPress={send} />
          {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
          <Note>{t('helpReplyNote')}</Note>
        </>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  sos: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.md, padding: space(4) },
  call: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  area: { minHeight: 120, borderRadius: radius.md, padding: space(4), fontSize: 16, textAlignVertical: 'top' },
});
