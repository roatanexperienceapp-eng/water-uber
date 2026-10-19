import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { SubScreen } from '@/components/AccountKit';
import { Composer, JoinGate, PostCard } from '@/components/Community';
import { Note } from '@/components/ui';
import { getMe, listPosts, type Me, type Post } from '@/lib/community';
import { space, useTheme } from '@/theme';

/** Travel talk: guests ask other visitors, share a photo, video or link. */
export default function Community() {
  const { t } = useTranslation();
  const c = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    getMe().then(setMe).catch(() => {});
    listPosts('discuss').then((p) => { setPosts(p); setErr(false); }).catch(() => setErr(true));
  }, []);
  useFocusEffect(load);

  return (
    <SubScreen title={t('commH')}>
      <Note>{t('commSub')}</Note>
      {me && (me.acceptedRules && me.name ? <Composer channel="discuss" onPosted={load} /> : <JoinGate onJoined={load} />)}
      {err && <Note>{t('cErr_offline')}</Note>}
      {posts === null && !err ? <ActivityIndicator color={c.flame} /> : null}
      <View style={{ gap: space(3) }}>
        {posts?.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}
      </View>
      {posts && posts.length === 0 && <Note center>{t('commEmpty')}</Note>}
    </SubScreen>
  );
}
