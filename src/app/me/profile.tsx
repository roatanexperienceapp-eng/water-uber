import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Button, Card, Note } from '@/components/ui';
import { DEMO_MODE } from '@/config';
import { deleteAccount, PHONE_RE, updateProfile, useProfile, type Profile } from '@/lib/account';
import { sendLoginCode, signOut, verifyLoginCode } from '@/lib/api';
import { radius, space, type, useTheme } from '@/theme';

/** Manage account: email sign-in, name, emergency contact, sign out, delete account. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const [p, reload] = useProfile();
  // Build the form once the profile has loaded, so its fields start with the saved values.
  return p ? <ProfileForm key={p.email ?? 'guest'} p={p} reload={reload} /> : <SubScreen title={t('manageAccount')}>{null}</SubScreen>;
}

function ProfileForm({ p, reload }: { p: Profile; reload: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [name, setName] = useState(p.fullName);
  const [eName, setEName] = useState(p.emergencyName);
  const [ePhone, setEPhone] = useState(p.emergencyPhone);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const input = [styles.input, { backgroundColor: c.tile, color: c.ink }];
  const phoneOk = !ePhone || PHONE_RE.test(ePhone.trim());

  async function save() {
    if (!phoneOk) return;
    setBusy(true);
    setMsg('');
    try {
      await updateProfile({ fullName: name, emergencyName: eName, emergencyPhone: ePhone });
      setMsg(t('saved'));
      reload();
    } catch {
      setMsg(t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function signInStep() {
    setBusy(true);
    setMsg('');
    try {
      if (sent) {
        await verifyLoginCode(email.trim(), code.trim());
        setSent(false);
        reload();
      } else {
        await sendLoginCode(email.trim());
        setSent(true);
      }
    } catch {
      setMsg(t('signInFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      await deleteAccount();
      router.replace('/');
    } catch (e) {
      setMsg(e instanceof Error && e.message === 'has_upcoming' ? t('deleteHasUpcoming') : t('deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (Platform.OS === 'web') {
      if (window.confirm(t('deleteConfirm'))) void doDelete();
      return;
    }
    Alert.alert(t('deleteH'), t('deleteConfirm'), [
      { text: t('cancelBtn'), style: 'cancel' },
      { text: t('deleteBtn'), style: 'destructive', onPress: () => void doDelete() },
    ]);
  }

  return (
    <SubScreen title={t('manageAccount')}>
      {/* Email sign-in keeps trips and tickets safe if the phone is lost or replaced. */}
      <Card>
        <Text style={[type.bodyStrong, { color: c.ink }]}>{t('email')}</Text>
        {p.email ? (
          <>
            <Text style={[type.body, { color: c.ink }]}>{p.email}</Text>
            <Button small variant="tile" label={t('signOut')} onPress={() => signOut().then(reload)} />
          </>
        ) : DEMO_MODE ? (
          <Note>{t('demoMode')}</Note>
        ) : (
          <>
            <Note>{t('addEmailWhy')}</Note>
            <TextInput style={input} value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            {sent && <TextInput style={input} value={code} onChangeText={setCode} placeholder={t('code')} placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />}
            <Button label={sent ? t('verify') : t('sendCode')} loading={busy} disabled={!email.includes('@')} onPress={signInStep} />
          </>
        )}
      </Card>

      <Text style={[type.bodyStrong, { color: c.ink }]}>{t('yourName')}</Text>
      <TextInput style={input} value={name} onChangeText={setName} maxLength={80} placeholder={t('yourNamePh')} placeholderTextColor={c.muted} autoComplete="name" />

      <Text style={[type.bodyStrong, { color: c.ink }]}>{t('emergencyH')}</Text>
      <Note>{t('emergencyWhy')}</Note>
      <TextInput style={input} value={eName} onChangeText={setEName} maxLength={80} placeholder={t('emergencyName')} placeholderTextColor={c.muted} />
      <TextInput style={input} value={ePhone} onChangeText={setEPhone} placeholder={t('emergencyPhone')} placeholderTextColor={c.muted} keyboardType="phone-pad" autoComplete="tel" />
      {!phoneOk && <Text style={[type.small, { color: c.sos }]}>{t('badPhone')}</Text>}

      <Button label={t('saveBtn')} loading={busy} disabled={!phoneOk} onPress={save} />
      {msg ? <Text style={[type.bodyStrong, { color: c.ink, textAlign: 'center' }]}>{msg}</Text> : null}

      <Card style={{ marginTop: space(6) }}>
        <Text style={[type.bodyStrong, { color: c.sos }]}>{t('deleteH')}</Text>
        <Note>{t('deleteWhat')}</Note>
        <Button variant="sos" label={t('deleteBtn')} loading={busy} onPress={confirmDelete} />
      </Card>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16 },
});
