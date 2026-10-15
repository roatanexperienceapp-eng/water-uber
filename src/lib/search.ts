import type { LangCode, Listing, Portal } from '@/types';

/**
 * Island search. Finds businesses by name/area/description, and maps product or need words
 * ("sunscreen", "ron", "sloth", "doctor") to the portals that usually carry them.
 * We do NOT know live stock, so product matches are labelled "likely sells" in the UI.
 */

/** Lowercase, strip accents and punctuation: "Farmacia Simán" -> "farmacia siman". */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Product / need words -> portal keys. Covers English and Spanish plus the common words
 * guests type in other languages. Add words here as you see real searches.
 */
const TOPICS: { words: string[]; portals: string[]; product?: boolean }[] = [
  { words: ['sunscreen', 'sunblock', 'reef safe', 'bloqueador', 'protector solar', 'aloe', 'sunburn', 'quemadura'], portals: ['rx', 'merch'], product: true },
  { words: ['medicine', 'medicina', 'medicamento', 'pills', 'aspirin', 'ibuprofen', 'tylenol', 'advil', 'pain', 'dolor', 'allergy', 'alergia', 'seasick', 'mareo', 'dramamine', 'bandage', 'curita', 'first aid', 'insect repellent', 'repelente', 'bug spray', 'pharmacy', 'farmacia', 'drugstore', 'pharmacie', 'apotheke', 'farmacie', '药店'], portals: ['rx'], product: true },
  { words: ['doctor', 'medico', 'hospital', 'clinic', 'clinica', 'emergency', 'emergencia', 'urgent', 'ambulance', 'ambulancia', 'injury', 'herida', 'hyperbaric', 'hiperbarica', 'decompression', 'arzt', 'medecin', 'medico', '医院', '医生'], portals: ['med'] },
  { words: ['souvenir', 'souvenirs', 'gift', 'regalo', 'recuerdo', 't shirt', 'tshirt', 'camiseta', 'shirt', 'hat', 'sombrero', 'art', 'arte', 'painting', 'cuadro', 'jewelry', 'joyeria', 'necklace', 'collar', 'bracelet', 'pulsera', 'cameo', 'cigar', 'puro', 'book', 'libro', 'shop', 'tienda', 'store', 'shopping', 'mall', 'cadeau', 'geschenk', 'regalo', '纪念品'], portals: ['merch'], product: true },
  { words: ['rum', 'ron', 'rhum', 'chocolate', 'cacao', 'rum cake', 'pastel de ron', 'vanilla', 'vainilla', 'coffee beans'], portals: ['merch'], product: true },
  { words: ['food', 'comida', 'eat', 'comer', 'restaurant', 'restaurante', 'lunch', 'almuerzo', 'dinner', 'cena', 'breakfast', 'desayuno', 'brunch', 'pizza', 'seafood', 'mariscos', 'fish tacos', 'tacos', 'burger', 'hamburguesa', 'steak', 'thai', 'italian', 'italiana', 'chicken', 'pollo', 'baleada', 'bar', 'drinks', 'bebidas', 'cocktail', 'beer', 'cerveza', 'coffee', 'cafe', 'sunset', 'atardecer', 'essen', 'manger', 'mangiare', '餐厅', '吃'], portals: ['food'] },
  { words: ['hotel', 'resort', 'room', 'habitacion', 'stay', 'hospedaje', 'lodging', 'guesthouse', 'all inclusive', 'todo incluido', 'unterkunft', '酒店'], portals: ['hotel'] },
  { words: ['car', 'carro', 'auto', 'coche', 'rental car', 'rent a car', 'alquiler', 'renta', 'jeep', 'suv', 'scooter', 'moto', 'motorcycle', 'motorbike', 'golf cart', 'voiture', 'mietwagen', '租车'], portals: ['car'] },
  { words: ['fishing', 'fish', 'pesca', 'pescar', 'wahoo', 'tuna', 'atun', 'marlin', 'mahi', 'dorado', 'snapper', 'pargo', 'barracuda', 'deep sea', 'sportfishing', 'charter', 'angeln', 'peche', '钓鱼'], portals: ['fish'] },
  { words: ['snorkel', 'snorkeling', 'esnorquel', 'reef', 'arrecife', 'turtle', 'tortuga', 'dolphin', 'delfin', 'glass bottom', 'schnorcheln', '浮潜'], portals: ['snork'] },
  { words: ['dive', 'diving', 'scuba', 'buceo', 'bucear', 'padi', 'ssi', 'certification', 'certificacion', 'open water', 'wreck', 'naufragio', 'el aguila', 'tauchen', 'plongee', '潜水'], portals: ['dive'] },
  { words: ['jet ski', 'jetski', 'waverunner', 'moto acuatica', 'jet car'], portals: ['jet'] },
  { words: ['parasail', 'parasailing', 'paracaidas', 'parachute'], portals: ['para'] },
  { words: ['zipline', 'zip line', 'zip', 'canopy', 'tirolesa', 'tyrolienne'], portals: ['zip'] },
  { words: ['monkey', 'mono', 'sloth', 'perezoso', 'iguana', 'macaw', 'guacamaya', 'parrot', 'loro', 'animal', 'animals', 'animales', 'park', 'parque', 'garden', 'jardin', 'museum', 'museo', 'nature', 'naturaleza', 'butterfly', 'mariposa', 'affe', 'singe', '猴子', '树懒'], portals: ['park'] },
  { words: ['tour', 'island tour', 'tour de la isla', 'sightseeing', 'driver', 'chofer', 'guide', 'guia', 'atv', 'cuatrimoto', 'horseback', 'caballo', 'punta gorda', 'oak ridge', 'east end'], portals: ['land'] },
];

/** Words meaning "water taxi" — the search screen sends these to the Ride tab instead of listings. */
export const RIDE_WORDS = ['water taxi', 'taxi acuatico', 'boat ride', 'taxi', 'west bay', 'west end', 'ferry', 'lancha', 'bote', 'boat', 'wassertaxi', 'taxi nautique', '水上出租车'];

export interface SearchHit {
  listing: Listing;
  score: number;
  /** true when the listing matched only because its category usually sells the product. */
  likely: boolean;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Portals the query points to (e.g. "sunscreen" -> pharmacies, island merch). */
  portals: string[];
  /** True when the query is about a product rather than a business or activity. */
  isProduct: boolean;
  /** True when the query looks like a water taxi request. */
  isRide: boolean;
}

function topicMatches(q: string) {
  const portals = new Set<string>();
  let product = false;
  for (const t of TOPICS) {
    if (t.words.some((w) => containsWord(q, normalize(w)))) {
      t.portals.forEach((p) => portals.add(p));
      if (t.product) product = true;
    }
  }
  return { portals: [...portals], product };
}

/** Whole-word (or prefix of a word, for typing-as-you-go) match. CJK text is matched as a substring. */
function containsWord(text: string, word: string): boolean {
  if (!word) return false;
  if (/[一-鿿]/.test(word)) return text.includes(word);
  return ` ${text} `.includes(` ${word} `) || (word.length >= 4 && ` ${text}`.includes(` ${word}`));
}

export function searchListings(query: string, listings: Listing[], portals: Portal[], lang: LangCode = 'en'): SearchResult {
  const q = normalize(query);
  if (q.length < 2) return { hits: [], portals: [], isProduct: false, isRide: false };
  const tokens = q.split(' ').filter((t) => t.length >= 2);
  const topic = topicMatches(q);
  const isRide = RIDE_WORDS.some((w) => containsWord(q, normalize(w))) && topic.portals.length === 0;

  // A portal's own name also counts ("pharmacies", "farmacias", "hotels").
  for (const p of portals) {
    const names = [p.names.en, p.names[lang] ?? ''].map(normalize);
    if (names.some((n) => n && (n.includes(q) || (q.length >= 4 && n.split(' ').some((w) => w.startsWith(q)))))) {
      if (!topic.portals.includes(p.key)) topic.portals.push(p.key);
    }
  }

  const hits: SearchHit[] = [];
  for (const l of listings) {
    const name = normalize(l.name);
    const area = normalize(l.area);
    const desc = normalize(l.description);
    let score = 0;
    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 60;
    else if (name.includes(q)) score += 45;
    for (const t of tokens) {
      if (containsWord(name, t)) score += 14;
      else if (name.includes(t) && t.length >= 3) score += 8;
      if (containsWord(area, t)) score += 6;
      if (t.length >= 4 && containsWord(desc, t)) score += 4;
    }
    let likely = false;
    const pi = topic.portals.indexOf(l.portal);
    if (pi >= 0) {
      if (score === 0) likely = topic.product;
      // Earlier portals in a topic are the better match ("sunscreen": pharmacies before gift shops).
      score += 10 + Math.max(0, 6 - pi) * 3;
    }
    if (score > 0) {
      if (l.ours) score += 3; // your own business first among equals
      if (l.rating) score += l.rating / 5;
      hits.push({ listing: l, score, likely });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.listing.name.localeCompare(b.listing.name));
  return { hits: hits.slice(0, 40), portals: topic.portals, isProduct: topic.product, isRide };
}
