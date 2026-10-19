// Beach clubs and beach day passes on Roatán — data for the future cruise "Beach day" suggestion portal.
// Researched 19 Oct 2026 from public listings (sources in docs/BEACH_CLUBS.md). Prices are "from" prices
// seen on resellers' sites and CHANGE OFTEN: confirm with each venue (and agree a partner rate) before showing them.
export interface BeachClub {
  id: string;
  name: string;
  area: string;
  kind: 'day-pass' | 'private-island' | 'all-inclusive' | 'public-beach' | 'port-beach';
  /** Lowest price seen, USD per adult; null = not published. */
  fromUsd: number | null;
  notes: string;
  /** false = location or details not confirmed by a second source. */
  confirmed: boolean;
}

export const BEACH_CLUBS: BeachClub[] = [
  // ---- West Bay ----
  { id: 'tabyana', name: 'Tabyana Beach', area: 'West Bay', kind: 'day-pass', fromUsd: null, notes: 'Beach club section of West Bay sold mostly as cruise packages (chair, showers, often lunch). Reef close to shore.', confirmed: true },
  { id: 'san-simon', name: 'The Beach Club San Simon', area: 'West Bay', kind: 'day-pass', fromUsd: 55, notes: 'Day pass with beach chair; food and drinks extra. Also a brunch restaurant.', confirmed: true },
  { id: 'infinity-bay', name: 'Infinity Bay Resort day pass', area: 'West Bay', kind: 'day-pass', fromUsd: 88, notes: 'Bronze to all-inclusive passes (about $88–110).', confirmed: true },
  { id: 'paradise-beach', name: 'Paradise Beach Hotel / Beach Club', area: 'West Bay', kind: 'day-pass', fromUsd: 45, notes: 'Day pass from about $45 (hotel) to $65 (beach club package).', confirmed: true },
  { id: 'henry-morgan', name: 'Henry Morgan Beach Resort', area: 'West Bay', kind: 'day-pass', fromUsd: 23, notes: '"Beach Bliss" day pass; cheapest seen about $23, packages about $65.', confirmed: true },
  { id: 'caribe-tesoro', name: 'Caribe Tesoro Resort day pass', area: 'West Bay', kind: 'day-pass', fromUsd: 55, notes: 'Resort day pass.', confirmed: true },
  { id: 'mayan-princess', name: 'Mayan Princess beach club', area: 'West Bay', kind: 'day-pass', fromUsd: null, notes: 'Sold with eco-park combos.', confirmed: true },
  { id: 'kimpton-grand', name: 'Kimpton Grand Roatan (pool chairs / cabanas)', area: 'West Bay', kind: 'day-pass', fromUsd: 60, notes: 'Pool chairs from about $60, cabanas from about $155. Upscale.', confirmed: true },
  { id: 'ibagari', name: 'Ibagari Boutique Hotel day pass', area: 'West Bay', kind: 'day-pass', fromUsd: 100, notes: 'Includes a drink.', confirmed: true },
  { id: 'gumbalimba', name: 'Gumbalimba Park', area: 'West Bay', kind: 'day-pass', fromUsd: null, notes: 'Animal park with beach/pool swim; often combined with Tabyana.', confirmed: true },
  // ---- West End / Sandy Bay ----
  { id: 'half-moon-bay', name: 'Half Moon Bay beach', area: 'West End', kind: 'public-beach', fromUsd: 0, notes: 'Free public beach, reef close to shore, chair rentals.', confirmed: true },
  { id: 'sol-y-mar', name: 'Sol y Mar Beach Club', area: 'Sandy Bay', kind: 'all-inclusive', fromUsd: null, notes: 'All-inclusive: buffet lunch, unlimited drinks, palapas.', confirmed: true },
  // ---- Cruise ports / south shore ----
  { id: 'mahogany-bay', name: 'Mahogany Bay Beach (Isla Tropicale)', area: 'Dixon Cove', kind: 'port-beach', fromUsd: 0, notes: 'Only for passengers whose ship docks at Isla Tropicale. Chairs included; extras paid.', confirmed: true },
  { id: 'maya-key', name: 'Maya Key private island', area: 'Off the south shore (5-min boat)', kind: 'private-island', fromUsd: 35, notes: 'Run by Anthony\'s Key Resort. Adults from $35, kids from $20. Pool, beach, wildlife center; transport to the dock not included.', confirmed: true },
  // ---- French Harbour / First Bight / French Cay ----
  { id: 'pristine-bay', name: 'Pristine Bay Resort beach club', area: 'First Bight', kind: 'day-pass', fromUsd: 85, notes: 'Day pass from about $85; "ultimate" pass about $150.', confirmed: true },
  { id: 'las-palmas', name: 'Las Palmas Beach Resort', area: 'French Harbour', kind: 'day-pass', fromUsd: null, notes: 'Used as the beach stop on several cruise tours.', confirmed: true },
  { id: 'fantasy-island', name: 'Fantasy Island all-inclusive', area: 'French Cay', kind: 'all-inclusive', fromUsd: 70, notes: '21-acre island resort, three beaches, pool, unlimited food and drinks.', confirmed: true },
  { id: 'little-french-key', name: 'Little French Key', area: 'French Cay (boat from French Harbour)', kind: 'private-island', fromUsd: null, notes: 'Private island with animal sanctuary; lunch + 2 drinks in cruise packages.', confirmed: true },
  { id: 'bradys-cay', name: "Brady's Cay", area: 'French Cay', kind: 'private-island', fromUsd: 65, notes: 'Beach + lunch + water activities, often with a monkey/sloth park ($65–105).', confirmed: true },
  { id: 'parrot-tree', name: 'Parrot Tree Beach Resort', area: 'Second Bight', kind: 'day-pass', fromUsd: null, notes: 'Was a cruise beach excursion (2014 source). Confirm it still sells day passes.', confirmed: false },
  // ---- East End ----
  { id: 'turquoise-bay', name: 'Turquoise Bay beach break', area: 'Turquoise Bay (east of Punta Gorda)', kind: 'all-inclusive', fromUsd: null, notes: 'Reserved section of a long private beach; lunch and drinks included.', confirmed: true },
  { id: 'paya-bay', name: 'Paya Bay Resort beaches', area: 'Paya Bay', kind: 'day-pass', fromUsd: null, notes: 'Big Beach and Bliss Beach. Bliss Beach is clothing-optional: say so clearly to families.', confirmed: true },
  { id: 'camp-bay', name: 'Camp Bay Beach', area: 'Camp Bay', kind: 'public-beach', fromUsd: 0, notes: 'Quiet beach ~1.5 h from West End; La Sirena for food. Too far for most cruise days.', confirmed: true },
  // ---- Location not confirmed ----
  { id: 'pirates-bay', name: 'Roatan Pirates Bay', area: 'Not confirmed', kind: 'day-pass', fromUsd: null, notes: 'Listed as a beach club on Tripadvisor; location not found.', confirmed: false },
  { id: 'wilsons-blue-lagoon', name: "Wilson's Blue Lagoon", area: 'Not confirmed', kind: 'day-pass', fromUsd: null, notes: 'Listed as a beach club on Tripadvisor; location not found.', confirmed: false },
  { id: 'arca', name: 'Arca Boutique Hotel day pass', area: 'Not confirmed', kind: 'day-pass', fromUsd: 65, notes: 'Day pass from about $65; area not stated.', confirmed: false },
];
