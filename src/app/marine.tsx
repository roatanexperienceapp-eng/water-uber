import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarineId } from '../../supabase/functions/_shared/marine.ts';
import { SubScreen } from '@/components/AccountKit';
import { Composer, JoinGate, PostCard } from '@/components/Community';
import { MarineGuide } from '@/components/MarineGuide';
import { Note, Segmented } from '@/components/ui';
import { getMe, listPosts, type Me, type Post } from '@/lib/community';
import { identify } from '@/lib/marine';
import { pickMedia, type PickedMedia } from '@/lib/media';
import { radius, space, type, useTheme } from '@/theme';

/** Marine life: scan a fish (AI best guess + our own safety notes) and the sightings wall. */
export default function Marine() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [tab, setTab] = useState<'scan' | 'guide' | 'wall'>('scan');
  const [photo, setPhoto] = useState<PickedMedia | null>(null);
  const [result, setResult] = useState<(MarineId & { demo?: boolean }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [share, setShare] = useState<{ species: string; media: PickedMedia | null; key: number } | null>(null);

  const load = useCallback(() => {
    getMe().then(setMe).catch(() => {});
    listPosts('sighting').then(setPosts).catch(() => setPosts([]));
  }, []);
  useFocusEffect(load);

  async function scan(camera: boolean) {
    setErr('');
    setResult(null);
    const r = await pickMedia({ camera, allowVideo: false, base64: true });
    if (typeof r === 'string') {
      if (r !== 'cancelled') setErr(t(`cErr_${r}`));
      return;
    }
    setPhoto(r);
    setBusy(true);
    try {
      setResult(await identify(r.base64 ?? '', i18n.language));
    } catch (e) {
      setErr(t(`scanErr_${(e as Error).message}`, { defaultValue: t('scanErr_scan_failed') }));
    } finally {
      setBusy(false);
    }
  }

  function shareSighting() {
    setShare({ species: result?.found ? result.commonName.replace(/\s*\(demo result\)$/, '') : '', media: photo, key: Date.now() });
    setTab('wall');
  }

  return (
    <SubScreen title={t('marineH')}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'scan', label: `🔍 ${t('scanTab')}` }, { value: 'guide', label: `📖 ${t('guideTab')}` }, { value: 'wall', label: `🐢 ${t('wallTab')}` }]} />

      {tab === 'guide' ? (
        <MarineGuide onSaw={(name) => { setShare({ species: name, media: null, key: Date.now() }); setTab('wall'); }} />
      ) : tab === 'scan' ? (
        <View style={{ gap: space(3) }}>
          <Note>{t('scanSub')}</Note>
          <View style={styles.row}>
            <BigBtn icon="camera" label={t('scanTake')} onPress={() => scan(true)} />
            <BigBtn icon="images" label={t('scanPick')} onPress={() => scan(false)} />
          </View>
          {photo && <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />}
          {busy && (
            <View style={styles.row}>
              <ActivityIndicator color={c.flame} />
              <Text style={[type.small, { color: c.muted }]}>{t('scanBusy')}</Text>
            </View>
          )}
          {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
          {result && !result.found && <Note>{t('scanNone')}</Note>}
          {result?.found && (
            <View style={[styles.result, { backgroundColor: c.tile }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h2, { color: c.ink }]}>{result.commonName}</Text>
                  {result.scientificName ? <Text style={[type.small, { color: c.muted, fontStyle: 'italic' }]}>{result.scientificName}</Text> : null}
                </View>
                <View style={[styles.conf, { backgroundColor: result.confidence === 'high' ? '#E8F7EE' : result.confidence === 'medium' ? '#FFF4DB' : '#FDECEA' }]}>
                  <Text style={[type.label, { fontSize: 12, color: '#111' }]}>{t(`conf_${result.confidence}`)}</Text>
                </View>
              </View>
              {result.facts.map((f) => (
                <Text key={f} style={[type.small, { color: c.ink }]}>• {f}</Text>
              ))}
              {result.safety.map((s) => (
                <View key={s} style={[styles.safety, { backgroundColor: '#FDECEA' }]}>
                  <Ionicons name="warning" size={16} color="#B42318" />
                  <Text style={[type.small, { color: '#7A271A', flex: 1 }]}>{t(`safety_${s}`)}</Text>
                </View>
              ))}
              <Text style={[type.small, { color: c.muted, fontSize: 12 }]}>{t('scanDisclaimer')}</Text>
              <Pressable accessibilityRole="button" onPress={shareSighting} style={[styles.shareBtn, { backgroundColor: c.ink }]}>
                <Text style={[type.label, { color: c.onInk }]}>🐢 {t('scanShare')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: space(3) }}>
          <Note>{t('wallSub')}</Note>
          {me && (me.acceptedRules && me.name ? (
            <Composer key={share?.key ?? 0} channel="sighting" requirePhoto presetSpecies={share?.species} presetMedia={share?.media ?? null} onPosted={() => { setShare(null); load(); }} />
          ) : (
            <JoinGate onJoined={load} />
          ))}
          {posts === null ? <ActivityIndicator color={c.flame} /> : posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}
          {posts && posts.length === 0 && <Note center>{t('wallEmpty')}</Note>}
        </View>
      )}
    </SubScreen>
  );
}

function BigBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.big, { backgroundColor: c.ink }]}>
      <Ionicons name={icon} size={22} color={c.onInk} />
      <Text style={[type.label, { color: c.onInk }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  big: { flex: 1, alignItems: 'center', gap: 6, borderRadius: radius.lg, paddingVertical: space(4) },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  result: { borderRadius: radius.lg, padding: space(4), gap: space(2) },
  conf: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, padding: 8 },
  shareBtn: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
});
