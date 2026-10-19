import Ionicons from '@expo/vector-icons/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COMMON_SPECIES, LIMITS, REPORT_REASONS, SIGHTING_SPOTS, type ReportReason } from '../../supabase/functions/_shared/community.ts';
import { Button, Note } from '@/components/ui';
import { ago } from '@/lib/ago';
import { blockAuthor, createPost, deletePost, joinCommunity, listReplies, reportPost, type Channel, type Post } from '@/lib/community';
import { pickMedia, type PickedMedia } from '@/lib/media';
import { radius, space, type, useTheme } from '@/theme';

// ---------------------------------------------------------------- Join (name + rules) ----
export function JoinGate({ onJoined }: { onJoined: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function join() {
    setBusy(true);
    setErr('');
    try {
      await joinCommunity(name);
      onJoined();
    } catch (e) {
      setErr(t(`cErr_${(e as Error).message}`, { defaultValue: t('cErr_failed') }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[styles.gate, { backgroundColor: c.tile }]}>
      <Text style={[type.bodyStrong, { color: c.ink }]}>{t('cRulesH')}</Text>
      {['cRule1', 'cRule2', 'cRule3', 'cRule4'].map((k) => (
        <Text key={k} style={[type.small, { color: c.ink }]}>• {t(k)}</Text>
      ))}
      <TextInput value={name} onChangeText={setName} placeholder={t('cNamePh')} placeholderTextColor={c.muted} maxLength={30} style={[type.body, styles.input, { color: c.ink, backgroundColor: c.bg }]} accessibilityLabel={t('cNamePh')} />
      {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
      <Button small label={t('cAgree')} onPress={join} loading={busy} disabled={name.trim().length < 2} />
    </View>
  );
}

// ---------------------------------------------------------------- Composer ----
export function Composer(p: { channel: Channel; parentId?: string; requirePhoto?: boolean; presetSpecies?: string; presetMedia?: PickedMedia | null; onPosted: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<PickedMedia | null>(p.presetMedia ?? null);
  const [link, setLink] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [spot, setSpot] = useState('');
  const [species, setSpecies] = useState(p.presetSpecies ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sighting = p.channel === 'sighting' && !p.parentId;

  async function pick(camera: boolean) {
    setErr('');
    const r = await pickMedia({ camera, allowVideo: !p.parentId });
    if (typeof r === 'string') {
      if (r !== 'cancelled') setErr(t(`cErr_${r}`));
      return;
    }
    setMedia(r);
  }

  async function send() {
    setErr('');
    if (p.requirePhoto && !media) return setErr(t('cErr_needPhoto'));
    if (sighting && !spot.trim()) return setErr(t('cErr_needSpot'));
    setBusy(true);
    try {
      await createPost({ channel: p.channel, body, media, linkUrl: showLink ? link : '', spot: sighting ? spot : undefined, species: sighting ? species : undefined, parentId: p.parentId });
      setBody(''); setMedia(null); setLink(''); setShowLink(false); setSpot(''); setSpecies(p.presetSpecies ?? '');
      p.onPosted();
    } catch (e) {
      setErr(t(`cErr_${(e as Error).message}`, { defaultValue: t('cErr_failed') }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.composer, { borderColor: c.line }]}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={p.parentId ? t('cReplyPh') : sighting ? t('cSightPh') : t('cAskPh')}
        placeholderTextColor={c.muted}
        multiline
        maxLength={LIMITS.body}
        style={[type.body, styles.textArea, { color: c.ink, minHeight: p.compact ? 40 : 64 }]}
        accessibilityLabel={t('cAskPh')}
      />
      {media && (
        <View style={styles.preview}>
          {media.kind === 'image' ? <Image source={{ uri: media.uri }} style={styles.thumb} /> : <View style={[styles.thumb, styles.videoThumb]}><Ionicons name="videocam" size={22} color="#fff" /></View>}
          <Pressable accessibilityRole="button" accessibilityLabel={t('cRemove')} onPress={() => setMedia(null)} style={[styles.x, { backgroundColor: c.ink }]}>
            <Ionicons name="close" size={14} color={c.onInk} />
          </Pressable>
        </View>
      )}
      {sighting && (
        <>
          <Chips label={`📍 ${t('cWhere')}`} options={SIGHTING_SPOTS} value={spot} onChange={setSpot} />
          <Chips label={`🐢 ${t('cWhat')}`} options={COMMON_SPECIES} value={species} onChange={setSpecies} />
        </>
      )}
      {showLink && (
        <TextInput value={link} onChangeText={setLink} placeholder="https://" placeholderTextColor={c.muted} autoCapitalize="none" keyboardType="url" style={[type.small, styles.input, { color: c.ink, backgroundColor: c.tile }]} accessibilityLabel={t('cAddLink')} />
      )}
      {err ? <Text style={[type.small, { color: c.sos }]}>{err}</Text> : null}
      <View style={styles.tools}>
        {!p.parentId && (
          <>
            <ToolBtn icon="camera-outline" label={t('cCamera')} onPress={() => pick(true)} />
            <ToolBtn icon="image-outline" label={t('cGallery')} onPress={() => pick(false)} />
            {!sighting && <ToolBtn icon="link-outline" label={t('cAddLink')} onPress={() => setShowLink((v) => !v)} />}
          </>
        )}
        <View style={{ flex: 1 }} />
        <Button small label={p.parentId ? t('fbSend') : t('cPost')} onPress={send} loading={busy} />
      </View>
    </View>
  );
}

function ToolBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.tool, { backgroundColor: c.tile }]}>
      <Ionicons name={icon} size={20} color={c.ink} />
    </Pressable>
  );
}

function Chips({ label, options: base, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  // A value chosen elsewhere (scanner, guide) shows first even if it isn't a standard chip.
  const options = value && !base.includes(value) ? [value, ...base] : base;
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: c.muted, fontSize: 12 }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable key={o} onPress={() => onChange(on ? '' : o)} style={[styles.chip, { backgroundColor: on ? c.ink : c.tile }]}>
              <Text style={[type.label, { fontSize: 12, color: on ? c.onInk : c.ink }]}>{o}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------- Post card ----
export function PostCard({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Post[] | null>(null);
  const [note, setNote] = useState('');

  const loadReplies = useCallback(() => {
    listReplies(post.id).then(setReplies).catch(() => setReplies([]));
  }, [post.id]);

  function toggleThread() {
    if (!open) loadReplies();
    setOpen((v) => !v);
  }

  async function act(fn: () => Promise<void>, done: string) {
    setMenu(false);
    try {
      await fn();
      setNote(t(done));
      onChanged();
    } catch {
      setNote(t('cErr_failed'));
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.line }]}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: post.channel === 'sighting' ? '#0E7490' : c.ink }]}>
          <Text style={[type.label, { color: '#fff' }]}>{post.authorName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]} numberOfLines={1}>{post.authorName}</Text>
          <Text style={[type.small, { color: c.muted, fontSize: 12 }]}>{ago(post.createdAt, i18n.language)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cMore')} onPress={() => setMenu(true)} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
        </Pressable>
      </View>

      {(post.spot || post.species) && (
        <View style={styles.tags}>
          {post.species ? <Tag text={`🐢 ${post.species}`} /> : null}
          {post.spot ? <Tag text={`📍 ${post.spot}`} /> : null}
        </View>
      )}
      {post.body ? <Text style={[type.body, { color: c.ink, fontSize: 15 }]}>{post.body}</Text> : null}
      {post.mediaUrl && post.mediaKind === 'image' && <Image source={{ uri: post.mediaUrl }} style={styles.media} resizeMode="cover" accessibilityIgnoresInvertColors />}
      {post.mediaUrl && post.mediaKind === 'video' && <VideoBox uri={post.mediaUrl} />}
      {post.linkUrl && (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(post.linkUrl!)} style={[styles.link, { backgroundColor: c.tile }]}>
          <Ionicons name="link" size={16} color={c.ink} />
          <Text style={[type.small, { color: c.ink, flex: 1 }]} numberOfLines={1}>{post.linkUrl.replace(/^https:\/\//, '')}</Text>
        </Pressable>
      )}
      {post.hidden && post.mine && <Note>{t('cHiddenMine')}</Note>}
      {note ? <Text style={[type.small, { color: c.muted }]}>{note}</Text> : null}

      {!post.parentId && post.channel === 'discuss' && (
        <Pressable accessibilityRole="button" onPress={toggleThread} style={styles.replyBtn}>
          <Ionicons name="chatbubble-outline" size={16} color={c.muted} />
          <Text style={[type.small, { color: c.muted }]}>{post.replies === 1 ? t('cReplyOne') : post.replies ? t('cReplies').replace('{n}', String(post.replies)) : t('cReply')}</Text>
        </Pressable>
      )}
      {open && (
        <View style={[styles.thread, { borderLeftColor: c.line }]}>
          {replies === null ? <ActivityIndicator color={c.flame} /> : replies.map((r) => <PostCard key={r.id} post={r} onChanged={loadReplies} />)}
          <Composer channel="discuss" parentId={post.id} compact onPosted={() => { loadReplies(); onChanged(); }} />
        </View>
      )}

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.scrim} onPress={() => setMenu(false)}>
          <View style={[styles.sheet, { backgroundColor: c.bg }]}>
            {post.mine ? (
              <MenuItem icon="trash-outline" label={t('cDelete')} danger onPress={() => act(() => deletePost(post.id), 'cDeleted')} />
            ) : (
              <>
                <Text style={[type.label, { color: c.muted, paddingHorizontal: 12 }]}>{t('cReportH')}</Text>
                {REPORT_REASONS.map((r: ReportReason) => (
                  <MenuItem key={r} icon="flag-outline" label={t(`cReason_${r}`)} onPress={() => act(() => reportPost(post.id, r), 'cReported')} />
                ))}
                <MenuItem icon="ban-outline" label={t('cBlock').replace('{name}', post.authorName)} danger onPress={() => act(() => blockAuthor(post.authorId), 'cBlocked')} />
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Tag({ text }: { text: string }) {
  const c = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: c.tile }]}>
      <Text style={[type.label, { fontSize: 12, color: c.ink }]}>{text}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
      <Ionicons name={icon} size={18} color={danger ? c.sos : c.ink} />
      <Text style={[type.body, { color: danger ? c.sos : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function VideoBox({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.media} nativeControls contentFit="cover" />;
}

const styles = StyleSheet.create({
  gate: { borderRadius: radius.lg, padding: space(4), gap: space(2) },
  input: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  composer: { borderWidth: 1, borderRadius: radius.lg, padding: space(3), gap: space(2) },
  textArea: { textAlignVertical: 'top', paddingVertical: 4 },
  preview: { flexDirection: 'row' },
  thumb: { width: 84, height: 84, borderRadius: radius.sm },
  videoThumb: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  x: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginLeft: -16, marginTop: -6 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  tool: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space(3), gap: space(2) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  media: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: '#0B1F2A' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, padding: 10 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  thread: { borderLeftWidth: 2, paddingLeft: space(3), gap: space(2) },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(4), paddingBottom: space(8), gap: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 13, paddingHorizontal: 12 },
});
