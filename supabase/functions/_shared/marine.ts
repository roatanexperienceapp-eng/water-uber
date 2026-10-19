// Marine life scanner: validates the AI's answer and adds safety notes that do NOT depend on the AI.
// Shared by the identify-marine-life function and the app.

export type MarineGroup = 'fish' | 'turtle' | 'ray' | 'shark' | 'eel' | 'coral' | 'invertebrate' | 'mammal' | 'other';
export type Confidence = 'high' | 'medium' | 'low';

export interface MarineId {
  found: boolean;
  commonName: string;
  scientificName: string;
  group: MarineGroup;
  confidence: Confidence;
  /** Up to 3 short facts in the guest's language. */
  facts: string[];
  /** Safety / respect notes from our own table, always shown when they apply. */
  safety: SafetyNote[];
}

export type SafetyNote = 'venomous_spines' | 'do_not_touch_coral' | 'protected_do_not_touch' | 'do_not_feed' | 'can_bite' | 'shuffle_feet' | 'stings';

const GROUPS: MarineGroup[] = ['fish', 'turtle', 'ray', 'shark', 'eel', 'coral', 'invertebrate', 'mammal', 'other'];

/** Our own rules, matched on the names the AI returns. Wildlife-safe advice never depends on the model. */
const RULES: { match: RegExp; notes: SafetyNote[] }[] = [
  { match: /lionfish|pterois|scorpionfish|stonefish|scorpaen/i, notes: ['venomous_spines'] },
  { match: /fire coral|millepora/i, notes: ['stings', 'do_not_touch_coral'] },
  { match: /jelly|man o.? war|physalia|cassiopea/i, notes: ['stings'] },
  { match: /sea urchin|diadema/i, notes: ['venomous_spines'] },
  { match: /stingray|southern ray|hypanus|dasyat|eagle ray|aetobatus/i, notes: ['shuffle_feet', 'protected_do_not_touch'] },
  { match: /turtle|chelonia|eretmochelys|caretta/i, notes: ['protected_do_not_touch', 'do_not_feed'] },
  { match: /moray|eel|gymnothorax/i, notes: ['can_bite', 'do_not_feed'] },
  { match: /barracuda|sphyraena/i, notes: ['can_bite', 'do_not_feed'] },
  { match: /shark|ginglymostoma|carcharhin/i, notes: ['protected_do_not_touch', 'do_not_feed'] },
  { match: /dolphin|tursiops|manatee|trichechus/i, notes: ['protected_do_not_touch', 'do_not_feed'] },
  { match: /coral|acropora|orbicella|sea fan|gorgonia|sponge/i, notes: ['do_not_touch_coral'] },
];

export function safetyFor(...names: string[]): SafetyNote[] {
  const text = names.join(' ');
  const out = new Set<SafetyNote>();
  for (const r of RULES) if (r.match.test(text)) r.notes.forEach((n) => out.add(n));
  return [...out];
}

/** Parses and checks the model's JSON. Anything malformed becomes "not found" rather than a made-up answer. */
export function parseMarineAnswer(raw: string): MarineId {
  const none: MarineId = { found: false, commonName: '', scientificName: '', group: 'other', confidence: 'low', facts: [], safety: [] };
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return none;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(m[0]);
  } catch {
    return none;
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const commonName = str(j.commonName, 60);
  if (j.found !== true || !commonName) return none;
  const scientificName = str(j.scientificName, 80);
  const group = GROUPS.includes(j.group as MarineGroup) ? (j.group as MarineGroup) : 'other';
  const confidence: Confidence = j.confidence === 'high' || j.confidence === 'medium' ? j.confidence : 'low';
  const facts = Array.isArray(j.facts) ? j.facts.map((f) => str(f, 160)).filter(Boolean).slice(0, 3) : [];
  return { found: true, commonName, scientificName, group, confidence, facts, safety: safetyFor(commonName, scientificName) };
}

export const MARINE_PROMPT = (language: string) =>
  `You identify marine life in photos taken by tourists snorkeling or diving in Roatán, Honduras (Mesoamerican Barrier Reef, Caribbean).
Reply with ONLY one JSON object, no other text:
{"found": true|false, "commonName": "...", "scientificName": "...", "group": "fish|turtle|ray|shark|eel|coral|invertebrate|mammal|other", "confidence": "high|medium|low", "facts": ["...", "..."]}
Rules:
- If there is no marine animal or coral clearly visible, or the photo is too blurry/dark, return {"found": false}.
- Name the single most prominent animal. Prefer species found on Caribbean reefs. If unsure of the species, give the family (e.g. "Parrotfish") and confidence "low".
- commonName and facts in ${language}; scientificName in Latin.
- facts: up to 3 short, true, friendly facts (max 20 words each). No medical or safety advice (the app adds its own).
- Never identify people.`;
