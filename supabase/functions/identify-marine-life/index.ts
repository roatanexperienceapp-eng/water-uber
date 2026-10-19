// POST /functions/v1/identify-marine-life  { image: base64 JPEG/PNG, mediaType: 'image/jpeg', language: 'en' }
// Uses the same Anthropic key and daily limit as Isla. The photo is not stored.
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';
import { MARINE_PROMPT, parseMarineAnswer } from '../_shared/marine.ts';

const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', zh: 'Simplified Chinese',
};
const DAILY_LIMIT = Number(Deno.env.get('ASSISTANT_DAILY_LIMIT') ?? '40');
const MODEL = Deno.env.get('VISION_MODEL') ?? Deno.env.get('ASSISTANT_MODEL') ?? 'claude-haiku-5-5';
const MAX_BASE64 = 2_800_000; // ≈ 2 MB image; the app shrinks photos before sending

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return fail(501, 'scanner_not_configured', 'Set the ANTHROPIC_API_KEY secret');

    const b = await readBody<{ image?: string; mediaType?: string; language?: string }>(req);
    const mediaType = b?.mediaType === 'image/png' ? 'image/png' : 'image/jpeg';
    if (!b?.image || typeof b.image !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.image.slice(0, 200))) return fail(400, 'no_image', 'Send a base64 photo');
    if (b.image.length > MAX_BASE64) return fail(413, 'image_too_big', 'Photo too large');

    const { data: allowed, error } = await ctx.supabaseAdmin.rpc('bump_assistant_usage', { p_user: ctx.userClaims!.id, p_limit: DAILY_LIMIT });
    if (error) return fail(500, 'rate_limit_error', error.message);
    if (!allowed) return fail(429, 'daily_limit', 'Daily limit reached');

    const language = LANG_NAMES[b.language ?? 'en'] ?? 'English';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: MARINE_PROMPT(language),
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: b.image } }, { type: 'text', text: 'Identify the marine life in this photo.' }] }],
      }),
    });
    if (!res.ok) return fail(502, 'upstream_error', `Scanner service returned ${res.status}`);
    const out = await res.json();
    const text = (out.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n');
    return json(parseMarineAnswer(text));
  }),
};
