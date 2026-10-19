// POST /functions/v1/assistant  { turns: [{role, content}], language: 'en' }
// "Isla", the in-app assistant. The Anthropic API key lives only here (secret ANTHROPIC_API_KEY).
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json, readBody } from '../_shared/http.ts';
import { BUNDLE_SETTINGS } from '../_shared/bundle.ts';
import { FEATURE_SETTINGS } from '../_shared/features.ts';
import { TOUR_SETTINGS } from '../_shared/tours.ts';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', zh: 'Simplified Chinese',
};
const DAILY_LIMIT = Number(Deno.env.get('ASSISTANT_DAILY_LIMIT') ?? '40');
const MODEL = Deno.env.get('ASSISTANT_MODEL') ?? 'claude-haiku-5-5';

const FACTS = `Facts about Roatán, Honduras:
- Water taxis run between West End (main dock across from Splash Inn) and West Bay Beach (docks near Infinity Bay, Bananarama and the south end). About 10-15 minutes.
- In this app: $5 per rider inside the West End-West Bay zone (private boat $20 minimum). West Bay to/from Sandy Bay is $15 per rider and West End to/from Sandy Bay is $10 per rider, both with a 3-person minimum. Other routes cost $5 per rider per mile. Scheduled pickups add a $5 reservation fee and use a private boat.
- Cruise ships dock at Isla Tropicale (formerly Mahogany Bay) and Port of Roatán in Coxen Hole. West Bay gets crowded on big cruise days.
- Airport: Juan Manuel Gálvez International (RTB) near Coxen Hole.
- Emergencies: call 911. 24/7 care includes UNIMED Urgent Care (West End), Alert International Rescue (West Bay Mall) and Hospital Cemesa (French Harbour). The only hyperbaric chamber is at Anthony's Key Resort clinic (Sandy Bay).`;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return fail(501, 'assistant_not_configured', 'Set the ANTHROPIC_API_KEY secret');

    const b = await readBody<{ turns: Turn[]; language?: string }>(req);
    const turns = (b?.turns ?? [])
      .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
      .slice(-12)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));
    if (!turns.length || turns[turns.length - 1].role !== 'user') return fail(400, 'bad_turns', 'Last turn must be from the user');

    const { data: allowed, error: rlErr } = await ctx.supabaseAdmin.rpc('bump_assistant_usage', {
      p_user: ctx.userClaims!.id,
      p_limit: DAILY_LIMIT,
    });
    if (rlErr) return fail(500, 'rate_limit_error', rlErr.message);
    if (!allowed) return fail(429, 'daily_limit', 'Daily assistant limit reached');

    const language = LANG_NAMES[b?.language ?? 'en'] ?? 'English';
    const system = `You are Isla, a friendly, brief assistant inside a Roatán water taxi and island guide app. Reply in ${language}, 2-4 short sentences, plain text. Do not invent business names, prices, opening hours or live schedules you were not given; say the app's listings have current details. For medical emergencies, tell the guest to call 911 first.\n\n${FACTS}\n\n${await ourFacts(ctx.supabaseAdmin)}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: turns }),
    });
    if (!res.ok) return fail(502, 'upstream_error', `Assistant service returned ${res.status}`);
    const out = await res.json();
    const text = (out.content ?? [])
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('\n')
      .trim();
    return json({ text });
  }),
};

/** Our own tours, prices and captains, read live so Isla never quotes an old price. */
// deno-lint-ignore no-explicit-any
async function ourFacts(db: any): Promise<string> {
  const [{ data: tours }, { data: crew }] = await Promise.all([
    db.from('listings').select('name, price_text, portal_key').eq('ours', true).eq('active', true).eq('booking', 'instant').not('price_text', 'is', null).order('sort'),
    db.rpc('crew_public'),
  ]);
  const p = FEATURE_SETTINGS.passPricing;
  const d = BUNDLE_SETTINGS.discountPctByTours;
  const lines = [
    `Our own tours (book and pay in the app's Explore tab):`,
    ...((tours ?? []) as { name: string; price_text: string }[]).map((t) => `- ${t.name}: ${t.price_text}`),
    `- Per-boat charters take up to ${TOUR_SETTINGS.seatsPerBoat} people per boat; bigger groups need more boats.`,
    `Week pass: unlimited West End-West Bay water taxi rides, $${p.perPersonPerWeek} per person per week, groups of ${p.minGroup}-${p.maxGroup}; two weeks costs double.`,
    `Packages: a week pass plus one of our tours is ${d[1]}% off everything; pass + a snorkel tour + a fishing tour is ${d[2]}% off. Build one on the Passes page.`,
  ];
  const names = ((crew ?? []) as { display_name: string; certified: boolean }[]);
  if (names.length) {
    lines.push(`Our captains: ${names.map((c) => c.display_name + (c.certified ? ' (certified)' : '')).join(', ')}. Only call a captain certified if marked (certified) here. You cannot pick a specific captain for a ride.`);
  }
  return lines.join('\n');
}
