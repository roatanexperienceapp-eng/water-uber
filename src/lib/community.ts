import { hasBlockedWord, RESERVED_NAME, type ReportReason } from '../../supabase/functions/_shared/community.ts';
import { readJSON, writeJSON } from '@/lib/localStore';
import type { PickedMedia } from '@/lib/media';
import { currentUser, ensureSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * Community: travel discussion ("discuss") and marine sightings ("sighting").
 * Live mode: the database enforces rules, filtering, reports, blocks and limits (see the community migration).
 * Demo mode: everything stays on this phone, with the same checks so the screens behave the same.
 */
export type Channel = 'discuss' | 'sighting';

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  channel: Channel;
  parentId: string | null;
  body: string;
  mediaUrl: string | null;
  mediaKind: 'image' | 'video' | null;
  linkUrl: string | null;
  spot: string | null;
  species: string | null;
  createdAt: string;
  mine: boolean;
  hidden: boolean;
  replies: number;
}

export interface Me {
  id: string;
  name: string | null;
  acceptedRules: boolean;
}

export interface NewPost {
  channel: Channel;
  body: string;
  media?: PickedMedia | null;
  linkUrl?: string;
  spot?: string;
  species?: string;
  parentId?: string;
}

/** Error codes the screens translate. */
export type CommunityError = 'accept_rules_first' | 'pick_a_name_first' | 'blocked_words' | 'too_many_posts' | 'reserved_name' | 'bad_link' | 'empty' | 'upload_failed' | 'failed';

type Row = Record<string, unknown>;
const DEMO_POSTS = 'demo.community.posts';
const DEMO_ME = 'demo.community.me';
const DEMO_BLOCKS = 'demo.community.blocks';
const DEMO_UID = 'demo-me';

// ---------- me ----------
export async function getMe(): Promise<Me> {
  if (!supabase) return readJSON<Me>(DEMO_ME, { id: DEMO_UID, name: null, acceptedRules: false });
  const s = await currentUser();
  const { data } = await supabase.from('profiles').select('community_name, community_terms_at').eq('id', s.user.id).maybeSingle();
  return { id: s.user.id, name: (data?.community_name as string) ?? null, acceptedRules: !!data?.community_terms_at };
}

export async function joinCommunity(name: string): Promise<void> {
  const n = name.trim();
  if (n.length < 2 || n.length > 30) throw new Error('pick_a_name_first');
  if (RESERVED_NAME.test(n) || hasBlockedWord(n)) throw new Error('reserved_name');
  if (!supabase) return writeJSON(DEMO_ME, { id: DEMO_UID, name: n, acceptedRules: true });
  const s = await currentUser();
  const { error } = await supabase.from('profiles').update({ community_name: n, community_terms_at: new Date().toISOString() }).eq('id', s.user.id);
  if (error) throw new Error('failed');
}

// ---------- reading ----------
function toPost(r: Row, me: string, replies: number): Post {
  const path = r.media_path as string | null;
  return {
    id: String(r.id),
    authorId: String(r.author_id),
    authorName: String(r.author_name),
    channel: r.channel as Channel,
    parentId: (r.parent_id as string) ?? null,
    body: String(r.body ?? ''),
    mediaUrl: path ? supabase!.storage.from('community').getPublicUrl(path).data.publicUrl : null,
    mediaKind: (r.media_kind as 'image' | 'video') ?? null,
    linkUrl: (r.link_url as string) ?? null,
    spot: (r.spot as string) ?? null,
    species: (r.species as string) ?? null,
    createdAt: String(r.created_at),
    mine: r.author_id === me,
    hidden: !!r.hidden,
    replies,
  };
}

export async function listPosts(channel: Channel): Promise<Post[]> {
  if (!supabase) {
    const blocks = readJSON<string[]>(DEMO_BLOCKS, []);
    const all = demoAll();
    return all
      .filter((p) => p.channel === channel && !p.parentId && !blocks.includes(p.authorId))
      .map((p) => ({ ...p, replies: all.filter((x) => x.parentId === p.id).length }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const s = await currentUser();
  const { data, error } = await supabase.from('community_posts').select('*').eq('channel', channel).is('parent_id', null).order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  const ids = (data ?? []).map((r: Row) => r.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: reps } = await supabase.from('community_posts').select('parent_id').in('parent_id', ids);
    for (const r of reps ?? []) counts.set(String(r.parent_id), (counts.get(String(r.parent_id)) ?? 0) + 1);
  }
  return (data ?? []).map((r: Row) => toPost(r, s.user.id, counts.get(String(r.id)) ?? 0));
}

export async function listReplies(postId: string): Promise<Post[]> {
  if (!supabase) {
    const blocks = readJSON<string[]>(DEMO_BLOCKS, []);
    return demoAll().filter((p) => p.parentId === postId && !blocks.includes(p.authorId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const s = await currentUser();
  const { data, error } = await supabase.from('community_posts').select('*').eq('parent_id', postId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((r: Row) => toPost(r, s.user.id, 0));
}

// ---------- writing ----------
export function cleanLink(raw?: string): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`;
  return /^https:\/\/[^\s/]+\.[^\s]{2,}$/.test(url) && url.length <= 500 ? url : 'bad';
}

function mapError(msg: string): CommunityError {
  for (const code of ['accept_rules_first', 'pick_a_name_first', 'blocked_words', 'too_many_posts', 'reserved_name'] as const) if (msg.includes(code)) return code;
  return 'failed';
}

export async function createPost(p: NewPost): Promise<void> {
  const link = cleanLink(p.linkUrl);
  if (link === 'bad') throw new Error('bad_link');
  if (!p.body.trim() && !p.media && !link) throw new Error('empty');
  const text = [p.body, p.spot, p.species].filter(Boolean).join(' ');
  if (hasBlockedWord(text)) throw new Error('blocked_words');

  if (!supabase) {
    const me = readJSON<Me>(DEMO_ME, { id: DEMO_UID, name: null, acceptedRules: false });
    if (!me.acceptedRules) throw new Error('accept_rules_first');
    const mine = demoAll().filter((x) => x.mine && Date.parse(x.createdAt) > Date.now() - 86_400_000).length;
    if (mine >= 20) throw new Error('too_many_posts');
    const post: Post = {
      id: `d-${Math.random().toString(36).slice(2, 10)}`, authorId: DEMO_UID, authorName: me.name ?? 'Guest', channel: p.parentId ? 'discuss' : p.channel,
      parentId: p.parentId ?? null, body: p.body.trim(), mediaUrl: p.media?.uri ?? null, mediaKind: p.media?.kind ?? null, linkUrl: link,
      spot: p.spot?.trim() || null, species: p.species?.trim() || null, createdAt: new Date().toISOString(), mine: true, hidden: false, replies: 0,
    };
    writeJSON(DEMO_POSTS, [post, ...readJSON<Post[]>(DEMO_POSTS, [])]);
    return;
  }

  const s = await currentUser();
  let mediaPath: string | null = null;
  if (p.media) {
    const ext = p.media.kind === 'video' ? (p.media.mime.includes('quicktime') ? 'mov' : 'mp4') : 'jpg';
    mediaPath = `${s.user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    try {
      const bytes = await (await fetch(p.media.uri)).arrayBuffer();
      const { error } = await supabase.storage.from('community').upload(mediaPath, bytes, { contentType: p.media.mime, upsert: false });
      if (error) throw error;
    } catch {
      throw new Error('upload_failed');
    }
  }
  const { error } = await supabase.from('community_posts').insert({
    author_id: s.user.id, author_name: '-', channel: p.parentId ? 'discuss' : p.channel, parent_id: p.parentId ?? null,
    body: p.body.trim(), media_path: mediaPath, media_kind: p.media?.kind ?? null, link_url: link,
    spot: p.spot?.trim() || null, species: p.species?.trim() || null,
  });
  if (error) {
    if (mediaPath) await supabase.storage.from('community').remove([mediaPath]);
    throw new Error(mapError(error.message));
  }
}

export async function deletePost(id: string): Promise<void> {
  if (!supabase) return writeJSON(DEMO_POSTS, readJSON<Post[]>(DEMO_POSTS, []).filter((p) => p.id !== id && p.parentId !== id));
  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function reportPost(id: string, reason: ReportReason): Promise<void> {
  if (!supabase) return;
  const s = await currentUser();
  const { error } = await supabase.from('community_reports').insert({ post_id: id, reporter_id: s.user.id, reason });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;
}

export async function blockAuthor(authorId: string): Promise<void> {
  if (!supabase) return writeJSON(DEMO_BLOCKS, [...new Set([...readJSON<string[]>(DEMO_BLOCKS, []), authorId])]);
  const s = await currentUser();
  const { error } = await supabase.from('community_blocks').insert({ blocker_id: s.user.id, blocked_id: authorId });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;
}

// ---------- demo content ----------
function demoAll(): Post[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const base = (x: Partial<Post> & { id: string; authorName: string; body: string; channel: Channel; createdAt: string }): Post => ({
    authorId: `demo-${x.authorName}`, parentId: null, mediaUrl: null, mediaKind: null, linkUrl: null, spot: null, species: null, mine: false, hidden: false, replies: 0, ...x,
  });
  const seed: Post[] = [
    base({ id: 'dc1', authorName: 'Megan (Ohio)', channel: 'discuss', body: 'Cruise in Thursday, 2 ships. Is West Bay still nice by 11 am or should we go to Half Moon Bay instead? (Demo post)', createdAt: ago(3) }),
    base({ id: 'dc1r', authorName: 'Luis', channel: 'discuss', parentId: 'dc1', body: 'Go before 10 or after 2. Half Moon Bay is calmer with kids. (Demo reply)', createdAt: ago(2) }),
    base({ id: 'dc2', authorName: 'Sophie & Tom', channel: 'discuss', body: 'Best place for a baleada near West End? (Demo post)', createdAt: ago(26) }),
    base({ id: 'ds1', authorName: 'Jake', channel: 'sighting', body: 'Hawksbill turtle cruising past us! (Demo sighting)', spot: 'Spooky Channel', species: 'Hawksbill turtle', createdAt: ago(5) }),
    base({ id: 'ds2', authorName: 'Ana', channel: 'sighting', body: 'Three eagle rays at the drop-off. (Demo sighting)', spot: 'Blue Channel', species: 'Spotted eagle ray', createdAt: ago(30) }),
  ];
  return [...readJSON<Post[]>(DEMO_POSTS, []), ...seed];
}
