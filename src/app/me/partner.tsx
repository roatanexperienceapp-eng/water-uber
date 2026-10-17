import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Button, Card, Note } from '@/components/ui';
import { applyAsPartner, PHONE_RE } from '@/lib/account';
import { radius, space, type, useTheme } from '@/theme';

/** "Drive with us" (captains) and "List your business" (tour operators, shops, restaurants). */
export default function PartnerScreen() {
  const { kind: k } = useLocalSearchParams<{ kind?: string }>();
  const kind: 'captain' | 'business' = k === 'business' ? 'business' : 'captain';
  const { t } = useTranslation();
  const c = useTheme();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [biz, setBiz] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const input = [styles.input, { backgroundColor: c.tile, color: c.ink }];
  const valid = name.trim().length >= 2 && PHONE_RE.test(whatsapp.trim()) && (kind === 'captain' || biz.trim().length > 1);
  const points = kind === 'captain' ? ['drivePt1', 'drivePt2', 'drivePt3', 'drivePt4'] : ['bizPt1', 'bizPt2', 'bizPt3', 'bizPt4'];

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      await applyAsPartner({ kind, name, whatsapp, businessName: biz, details });
      setDone(true);
    } catch {
      setErr(t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubScreen title={kind === 'captain' ? t('driveH') : t('listBizH')}>
      <Card>
        {points.map((p) => (
          <Text key={p} style={[type.body, { color: c.ink }]}>
            ✓ {t(p)}
          </Text>
        ))}
      </Card>
      {done ? (
        <Card>
          <Text style={[type.h2, { color: c.ink }]}>{t('applyThanks')}</Text>
          <Note>{t('applyThanksSub')}</Note>
        </Card>
      ) : (
        <>
          <TextInput style={input} value={name} onChangeText={setName} maxLength={80} placeholder={t('yourNamePh')} placeholderTextColor={c.muted} autoComplete="name" />
          <TextInput style={input} value={whatsapp} onChangeText={setWhatsapp} placeholder={t('whatsappPh')} placeholderTextColor={c.muted} keyboardType="phone-pad" />
          <TextInput style={input} value={biz} onChangeText={setBiz} maxLength={120} placeholder={kind === 'captain' ? t('boatNamePh') : t('bizNamePh')} placeholderTextColor={c.muted} />
          <TextInput style={[input, styles.area]} value={details} onChangeText={setDetails} maxLength={1000} multiline placeholder={kind === 'captain' ? t('boatDetailsPh') : t('bizDetailsPh')} placeholderTextColor={c.muted} />
          <Button label={t('applyBtn')} loading={busy} disabled={!valid} onPress={submit} />
          {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
          <Note>{t('applyNote')}</Note>
        </>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16 },
  area: { minHeight: 100, textAlignVertical: 'top' },
});
