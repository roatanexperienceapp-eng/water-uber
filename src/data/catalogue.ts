// Seed catalogue for the Explore tab. In production these rows live in Supabase (table `listings`);
// this file seeds the database and lets the app run before the backend is connected.
// booking: 'instant' = partner with a fixed price (pay now) · 'request' = concierge confirms price and
// availability before the guest pays · 'info' = no booking (pharmacies, hospitals).
import type { Listing, Portal } from '@/types';

export const PORTALS: Portal[] = [
 {
  "key": "fish",
  "icon": "🎣",
  "names": {
   "en": "Fishing charters",
   "es": "Pesca",
   "fr": "Pêche",
   "de": "Angeltouren",
   "pt": "Pesca",
   "it": "Pesca",
   "zh": "钓鱼包船"
  },
  "kind": "book"
 },
 {
  "key": "snork",
  "icon": "🤿",
  "names": {
   "en": "Snorkel charters",
   "es": "Snorkel",
   "fr": "Snorkeling",
   "de": "Schnorcheln",
   "pt": "Snorkel",
   "it": "Snorkeling",
   "zh": "浮潜"
  },
  "kind": "book"
 },
 {
  "key": "dive",
  "icon": "🐠",
  "names": {
   "en": "Diving",
   "es": "Buceo",
   "fr": "Plongée",
   "de": "Tauchen",
   "pt": "Mergulho",
   "it": "Immersioni",
   "zh": "潜水"
  },
  "kind": "book"
 },
 {
  "key": "jet",
  "icon": "🚤",
  "names": {
   "en": "Jet ski",
   "es": "Moto acuática",
   "fr": "Jet-ski",
   "de": "Jetski",
   "pt": "Jet ski",
   "it": "Moto d'acqua",
   "zh": "摩托艇"
  },
  "kind": "book"
 },
 {
  "key": "para",
  "icon": "🪂",
  "names": {
   "en": "Parasailing",
   "es": "Parasail",
   "fr": "Parachute ascensionnel",
   "de": "Parasailing",
   "pt": "Parasail",
   "it": "Parasailing",
   "zh": "海上拖伞"
  },
  "kind": "book"
 },
 {
  "key": "car",
  "icon": "🚙",
  "names": {
   "en": "Car rentals",
   "es": "Autos",
   "fr": "Location de voitures",
   "de": "Mietwagen",
   "pt": "Aluguel de carros",
   "it": "Noleggio auto",
   "zh": "租车"
  },
  "kind": "book"
 },
 {
  "key": "land",
  "icon": "🗺️",
  "names": {
   "en": "Land tours",
   "es": "Tours en tierra",
   "fr": "Excursions terrestres",
   "de": "Inseltouren",
   "pt": "Passeios terrestres",
   "it": "Tour dell'isola",
   "zh": "陆地游览"
  },
  "kind": "book"
 },
 {
  "key": "zip",
  "icon": "🌴",
  "names": {
   "en": "Zip lines",
   "es": "Canopy",
   "fr": "Tyroliennes",
   "de": "Ziplines",
   "pt": "Tirolesa",
   "it": "Zipline",
   "zh": "丛林飞索"
  },
  "kind": "book"
 },
 {
  "key": "park",
  "icon": "🦜",
  "names": {
   "en": "Parks",
   "es": "Parques",
   "fr": "Parcs",
   "de": "Parks",
   "pt": "Parques",
   "it": "Parchi",
   "zh": "公园"
  },
  "kind": "book"
 },
 {
  "key": "rx",
  "icon": "💊",
  "names": {
   "en": "Pharmacies",
   "es": "Farmacias",
   "fr": "Pharmacies",
   "de": "Apotheken",
   "pt": "Farmácias",
   "it": "Farmacie",
   "zh": "药店"
  },
  "kind": "info"
 },
 {
  "key": "med",
  "icon": "🏥",
  "names": {
   "en": "Hospitals & clinics",
   "es": "Hospitales y clínicas",
   "fr": "Hôpitaux et cliniques",
   "de": "Kliniken & Ärzte",
   "pt": "Hospitais e clínicas",
   "it": "Ospedali e cliniche",
   "zh": "医院诊所"
  },
  "kind": "info"
 },
 {
  "key": "hotel",
  "icon": "🏨",
  "names": {
   "en": "Hotels",
   "es": "Hoteles",
   "fr": "Hôtels",
   "de": "Hotels",
   "pt": "Hotéis",
   "it": "Hotel",
   "zh": "酒店"
  },
  "kind": "book"
 },
 {
  "key": "food",
  "icon": "🍤",
  "names": {
   "en": "Restaurants",
   "es": "Restaurantes",
   "fr": "Restaurants",
   "de": "Restaurants",
   "pt": "Restaurantes",
   "it": "Ristoranti",
   "zh": "餐厅"
  },
  "kind": "book"
 },
 {
  "key": "merch",
  "icon": "🛍️",
  "names": {
   "en": "Island merch",
   "es": "Tienda",
   "fr": "Souvenirs",
   "de": "Souvenirs",
   "pt": "Lembranças",
   "it": "Souvenir",
   "zh": "纪念品"
  },
  "kind": "book"
 }
];

export const LISTINGS: Listing[] = [
 {
  "id": "fish-bottom-fishing",
  "portal": "fish",
  "name": "Bottom fishing",
  "area": "West End",
  "description": "Reef bottom fishing on our boat with one of our captains.",
  "priceText": "$60 per person",
  "priceUsd": 60.0,
  "unit": "person",
  "ours": true,
  "portPickup": true,
  "booking": "instant"
 },
 {
  "id": "fish-deep-sea-trolling",
  "portal": "fish",
  "name": "Deep sea trolling · half day",
  "area": "West End",
  "description": "Half-day offshore trolling on our boat with one of our captains. Price per boat, up to 6 people.",
  "priceText": "$350 per boat",
  "priceUsd": 350.0,
  "unit": "boat",
  "ours": true,
  "portPickup": true,
  "booking": "instant",
  "durationMinutes": 240
 },
 {
  "id": "fish-ruthless-roatan-charters",
  "portal": "fish",
  "name": "Ruthless Roatan Charters",
  "area": "West End",
  "description": "Private fishing and boat charters.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 395,
  "booking": "request"
 },
 {
  "id": "fish-wahoo-slayer-fishing-charter",
  "portal": "fish",
  "name": "Wahoo Slayer Fishing Charter",
  "area": "West End",
  "description": "Offshore trips for wahoo, tuna and mahi-mahi.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 241,
  "booking": "request"
 },
 {
  "id": "fish-roatan-anglers-charters-tours",
  "portal": "fish",
  "name": "Roatan Anglers Charters & Tours",
  "area": "West End",
  "description": "Half and full-day sportfishing on a 31 ft boat.",
  "priceText": "from $740 per boat",
  "priceUsd": 740.0,
  "priceIsFrom": true,
  "unit": "boat",
  "rating": 4.8,
  "reviews": 110,
  "booking": "request"
 },
 {
  "id": "fish-capt-n-r-charters-and-tours",
  "portal": "fish",
  "name": "Capt'n R Charters and Tours",
  "area": "West End",
  "description": "Fishing charters and private boat tours.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 98,
  "booking": "request"
 },
 {
  "id": "fish-roatan-reef-tours",
  "portal": "fish",
  "name": "Roatan Reef Tours",
  "area": "West End",
  "description": "Fishing trips on 24 ft and 27 ft boats.",
  "priceText": "from $399 per boat",
  "priceUsd": 399.0,
  "priceIsFrom": true,
  "unit": "boat",
  "rating": 5.0,
  "reviews": 98,
  "booking": "request"
 },
 {
  "id": "fish-long-island-tours",
  "portal": "fish",
  "name": "Long Island Tours",
  "area": "West End",
  "description": "Fishing and island boat trips.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 69,
  "booking": "request"
 },
 {
  "id": "fish-roatan-blissful-charters",
  "portal": "fish",
  "name": "Roatan Blissful Charters",
  "area": "West End",
  "description": "Private fishing charters.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 37,
  "booking": "request"
 },
 {
  "id": "fish-hands-on-fishing-roatan",
  "portal": "fish",
  "name": "Hands On Fishing Roatan",
  "area": "West End",
  "description": "Hands-on reef and deep-sea fishing.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 32,
  "booking": "request"
 },
 {
  "id": "fish-bay-islands-fishing-charters",
  "portal": "fish",
  "name": "Bay Islands Fishing Charters",
  "area": "West End",
  "description": "Sportfishing around the Bay Islands.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 23,
  "booking": "request"
 },
 {
  "id": "fish-swordfish-roatan",
  "portal": "fish",
  "name": "Swordfish Roatan",
  "area": "West End",
  "description": "Deep-sea fishing trips.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 10,
  "booking": "request"
 },
 {
  "id": "fish-roatan-reef-explorer-tours",
  "portal": "fish",
  "name": "Roatan Reef Explorer Tours",
  "area": "West End",
  "description": "Fishing on a 26 ft boat.",
  "priceText": "from $400 per boat",
  "priceUsd": 400.0,
  "priceIsFrom": true,
  "unit": "boat",
  "booking": "request"
 },
 {
  "id": "fish-roatan-splash-dash",
  "portal": "fish",
  "name": "Roatan Splash Dash",
  "area": "West End",
  "description": "Fishing on a 27 ft boat.",
  "priceText": "from $450 per boat",
  "priceUsd": 450.0,
  "priceIsFrom": true,
  "unit": "boat",
  "booking": "request"
 },
 {
  "id": "fish-roatan-ocean-charters",
  "portal": "fish",
  "name": "Roatan Ocean Charters",
  "area": "West End",
  "description": "Sportfishing on a 32 ft boat.",
  "priceText": "from $880 per boat",
  "priceUsd": 880.0,
  "priceIsFrom": true,
  "unit": "boat",
  "booking": "request"
 },
 {
  "id": "fish-dos-reyes-fishing-charters",
  "portal": "fish",
  "name": "Dos Reyes Fishing Charters",
  "area": "Sandy Bay",
  "description": "Full-day fishing on a 33 ft boat.",
  "priceText": "from $750 per boat",
  "priceUsd": 750.0,
  "priceIsFrom": true,
  "unit": "boat",
  "booking": "request"
 },
 {
  "id": "fish-elvistours-roatan",
  "portal": "fish",
  "name": "ElvisTours Roatan",
  "area": "West Bay",
  "description": "Fishing on a 33 ft boat from West Bay.",
  "priceText": "from $500 per boat",
  "priceUsd": 500.0,
  "priceIsFrom": true,
  "unit": "boat",
  "booking": "request"
 },
 {
  "id": "fish-roatide-snorkeling-fishing",
  "portal": "fish",
  "name": "RoaTide Snorkeling & Fishing",
  "area": "Roatán",
  "description": "Combined fishing and snorkel trips, 32 ft boat.",
  "priceText": "from $390 per boat",
  "priceUsd": 390.0,
  "priceIsFrom": true,
  "unit": "boat",
  "booking": "request"
 },
 {
  "id": "snork-shipwreck-snorkel-tour",
  "portal": "snork",
  "name": "Shipwreck snorkel tour",
  "area": "West End",
  "description": "Our boat and guide to the wreck.",
  "priceText": "$95 per person",
  "priceUsd": 95.0,
  "unit": "person",
  "ours": true,
  "portPickup": true,
  "booking": "instant"
 },
 {
  "id": "snork-pigeon-key-nurse-sharks",
  "portal": "snork",
  "name": "Pigeon Key nurse shark swim",
  "area": "West End",
  "description": "Swim with nurse sharks at Pigeon Key with our boat and guide.",
  "priceText": "$190 per person",
  "priceUsd": 190.0,
  "unit": "person",
  "ours": true,
  "portPickup": true,
  "booking": "instant"
 },
 {
  "id": "snork-blue-channel",
  "portal": "snork",
  "name": "Blue Channel snorkel",
  "area": "West End",
  "description": "Snorkel the Blue Channel with our boat and guide.",
  "priceText": "$30 per person",
  "priceUsd": 30.0,
  "unit": "person",
  "ours": true,
  "portPickup": true,
  "booking": "instant"
 },
 {
  "id": "snork-dolphin-show",
  "portal": "snork",
  "name": "Dolphin show",
  "area": "West End",
  "description": "See the dolphin show, booked through us.",
  "priceText": "$45 per person",
  "priceUsd": 45.0,
  "unit": "person",
  "ours": true,
  "portPickup": true,
  "booking": "instant"
 },
 {
  "id": "snork-cayos-cochinos",
  "portal": "snork",
  "name": "Cayos Cochinos trip",
  "area": "West End",
  "description": "Full-day boat trip to the Cayos Cochinos islands with our captain and guide.",
  "priceText": "$190 per person",
  "priceUsd": 190.0,
  "unit": "person",
  "ours": true,
  "portPickup": true,
  "booking": "instant",
  "durationMinutes": 480
 },
 {
  "id": "snork-roatan-tour-guide-association",
  "portal": "snork",
  "name": "Roatan Tour Guide Association",
  "area": "West End",
  "description": "Boat snorkel at Blue Channel, Aquarium or Turtle Crossing.",
  "priceText": "from $31.50",
  "priceUsd": 31.5,
  "priceIsFrom": true,
  "unit": "person",
  "rating": 5.0,
  "reviews": 338,
  "booking": "request"
 },
 {
  "id": "snork-roatan-tucan-adventures",
  "portal": "snork",
  "name": "Roatan Tucan Adventures",
  "area": "Roatán",
  "description": "Snorkel tours, parasailing and combos.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 691,
  "booking": "request"
 },
 {
  "id": "snork-roatan-five-stars",
  "portal": "snork",
  "name": "Roatan Five Stars",
  "area": "West Bay",
  "description": "3-stop snorkel adventures from West Bay.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "snork-roatan-reef-tours",
  "portal": "snork",
  "name": "Roatan Reef Tours",
  "area": "West End",
  "description": "Reef snorkel trips by boat.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 98,
  "booking": "request"
 },
 {
  "id": "snork-roatan-getaway-tours",
  "portal": "snork",
  "name": "Roatan Getaway Tours",
  "area": "Roatán",
  "description": "Night snorkel adventures.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "snork-roatan-clear-boat-tour",
  "portal": "snork",
  "name": "Roatan Clear Boat Tour",
  "area": "Roatán",
  "description": "See the reef from a clear-bottom boat.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "snork-roatan-hydrobikes",
  "portal": "snork",
  "name": "Roatan Hydrobikes",
  "area": "Roatán",
  "description": "Hydrobike harbor tour with reef snorkel.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "snork-mono-loco-tiki-catamaran",
  "portal": "snork",
  "name": "Mono Loco Tiki Catamaran",
  "area": "West End",
  "description": "Tiki catamaran snorkel and lunch party.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "snork-roatan-paddlesports",
  "portal": "snork",
  "name": "Roatan PaddleSports",
  "area": "West Bay",
  "description": "Kayak and paddleboard snorkel trips.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "snork-ocean-connections",
  "portal": "snork",
  "name": "Ocean Connections",
  "area": "West End",
  "description": "Snorkel tours and BOSS underwater scooters.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-west-end-divers",
  "portal": "dive",
  "name": "West End Divers",
  "area": "West End",
  "description": "Long-running PADI dive center.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-native-sons-dive-shop",
  "portal": "dive",
  "name": "Native Sons Dive Shop",
  "area": "West End",
  "description": "Locally owned PADI dive shop.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-roatan-divers",
  "portal": "dive",
  "name": "Roatan Divers",
  "area": "West End",
  "description": "PADI 5-Star Instructor Development Center.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-coconut-tree-divers",
  "portal": "dive",
  "name": "Coconut Tree Divers",
  "area": "West End · Half Moon Bay",
  "description": "PADI IDC and TDI technical diving.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-reef-gliders-dive-center",
  "portal": "dive",
  "name": "Reef Gliders Dive Center",
  "area": "West End",
  "description": "Daily boat dives at 9:00, 11:30 and 2:30.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-sun-divers-roatan",
  "portal": "dive",
  "name": "Sun Divers Roatan",
  "area": "West End",
  "description": "PADI courses and fun dives.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-jackson-s-dive-center",
  "portal": "dive",
  "name": "Jackson's Dive Center",
  "area": "West End · Half Moon Bay",
  "description": "SSI courses and daily dives.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-seagrape-plantation-dive-center",
  "portal": "dive",
  "name": "Seagrape Plantation Dive Center",
  "area": "West End",
  "description": "Resort dive shop.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 242,
  "booking": "request"
 },
 {
  "id": "dive-splash-inn-dive-resort",
  "portal": "dive",
  "name": "Splash Inn Dive Resort",
  "area": "West End",
  "description": "Dive resort on Main Street.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-west-bay-divers",
  "portal": "dive",
  "name": "West Bay Divers",
  "area": "West Bay",
  "description": "PADI 5 Star, two locations on the beach.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-mayan-divers",
  "portal": "dive",
  "name": "Mayan Divers",
  "area": "West Bay",
  "description": "PADI 5-Star IDC at Mayan Princess.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-paradise-beach-divers",
  "portal": "dive",
  "name": "Paradise Beach Divers",
  "area": "West Bay",
  "description": "PADI 5-Star IDC at Paradise Beach Hotel.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-bananarama-dive-center",
  "portal": "dive",
  "name": "Bananarama Dive Center",
  "area": "West Bay",
  "description": "Family-friendly dive resort.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-infinity-bay-aqua-center",
  "portal": "dive",
  "name": "Infinity Bay Aqua Center",
  "area": "West Bay",
  "description": "Dive center at Infinity Bay Resort.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-anthony-s-key-resort",
  "portal": "dive",
  "name": "Anthony's Key Resort",
  "area": "Sandy Bay",
  "description": "Dive resort near El Aguila wreck.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-tranquilseas-divers",
  "portal": "dive",
  "name": "Tranquilseas Divers",
  "area": "Sandy Bay",
  "description": "Small eco-focused dive shop.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-waihuka-dive-center",
  "portal": "dive",
  "name": "Waihuka Dive Center",
  "area": "Coxen Hole",
  "description": "Home of the Cara a Cara shark dive.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "dive-coco-view-resort",
  "portal": "dive",
  "name": "Coco View Resort",
  "area": "South shore",
  "description": "Dedicated dive resort.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "jet-roa-live-jet-ski-rental",
  "portal": "jet",
  "name": "ROA LIVE Jet Ski Rental",
  "area": "West Bay",
  "description": "Jet ski rentals right from West Bay Beach.",
  "priceText": "$90",
  "priceUsd": 90.0,
  "unit": "ski",
  "booking": "request"
 },
 {
  "id": "jet-blue-water-beach-co",
  "portal": "jet",
  "name": "Blue Water Beach Co.",
  "area": "West Bay",
  "description": "30-minute guided ride past the reef, 2 per ski.",
  "priceText": "$85",
  "priceUsd": 85.0,
  "unit": "ski",
  "booking": "request"
 },
 {
  "id": "jet-joyride-adventure-roatan",
  "portal": "jet",
  "name": "Joyride Adventure Roatán",
  "area": "West End",
  "description": "Jet skis, jet cars and water sports.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "jet-sunshine-powersport-rentals",
  "portal": "jet",
  "name": "Sunshine Powersport Rentals",
  "area": "West Bay",
  "description": "Powersport rentals in West Bay.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "jet-snorkel-roatan",
  "portal": "jet",
  "name": "Snorkel Roatan",
  "area": "West Bay",
  "description": "Jet ski rentals and water tours.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "jet-rankin-water-adventures",
  "portal": "jet",
  "name": "Rankin Water Adventures",
  "area": "Roatán",
  "description": "Water sports and jet ski trips.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "para-roatan-tucan-adventures",
  "portal": "para",
  "name": "Roatan Tucan Adventures",
  "area": "Roatán",
  "description": "Parasailing over West Bay reef.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 691,
  "booking": "request"
 },
 {
  "id": "para-roatan-tour-guide-association",
  "portal": "para",
  "name": "Roatan Tour Guide Association",
  "area": "Roatán",
  "description": "Parasail flights and water sports.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 338,
  "booking": "request"
 },
 {
  "id": "para-roatan-breakaway-tours",
  "portal": "para",
  "name": "Roatán Breakaway Tours",
  "area": "Coxen Hole",
  "description": "Parasailing and shore excursions.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 316,
  "booking": "request"
 },
 {
  "id": "para-roatan-activities-hn-oficial",
  "portal": "para",
  "name": "Roatan Activities hn Oficial",
  "area": "West Bay",
  "description": "Parasailing from West Bay Beach.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 130,
  "booking": "request"
 },
 {
  "id": "para-roatan-exclusive",
  "portal": "para",
  "name": "Roatan Exclusive",
  "area": "Roatán",
  "description": "Private parasail and boat tours.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 125,
  "booking": "request"
 },
 {
  "id": "para-at21-tours-roatan",
  "portal": "para",
  "name": "AT21 Tours Roatan",
  "area": "Roatán",
  "description": "Parasail and combo tours.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 54,
  "booking": "request"
 },
 {
  "id": "para-roatan-water-activities-and-tours",
  "portal": "para",
  "name": "Roatan Water Activities and Tours",
  "area": "Roatán",
  "description": "Parasailing and water activities.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "car-our-island-car",
  "portal": "car",
  "name": "Our island car",
  "area": "Delivered to you",
  "description": "Dropped at your rental or hotel.",
  "priceText": "$45 / day",
  "priceUsd": 45.0,
  "unit": "day",
  "ours": true,
  "booking": "instant"
 },
 {
  "id": "car-captain-van-s-rentals",
  "portal": "car",
  "name": "Captain Van's Rentals",
  "area": "West Bay Mall",
  "description": "Cars, scooters and motorbikes. Insurance included.",
  "priceText": "from $42 / day",
  "priceUsd": 42.0,
  "priceIsFrom": true,
  "unit": "day",
  "booking": "request"
 },
 {
  "id": "car-sersa-rent-a-car",
  "portal": "car",
  "name": "Sersa Rent a Car",
  "area": "RTB airport",
  "description": "Meet-and-greet or shuttle pickup.",
  "priceText": "from $49 / day",
  "priceUsd": 49.0,
  "priceIsFrom": true,
  "unit": "day",
  "booking": "request"
 },
 {
  "id": "car-caribbean-rent-a-car",
  "portal": "car",
  "name": "Caribbean Rent a Car",
  "area": "RTB airport",
  "description": "Local agency with an airport desk.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "car-econo-rent-a-car",
  "portal": "car",
  "name": "Econo Rent a Car",
  "area": "RTB airport",
  "description": "Local agency at the airport.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "car-racing-rent-a-car",
  "portal": "car",
  "name": "Racing Rent a Car",
  "area": "Airport delivery",
  "description": "Local rental, delivers to the airport or ferry.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "car-thomas-car-rental",
  "portal": "car",
  "name": "Thomas Car Rental",
  "area": "Roatán",
  "description": "Local car rental.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "car-avis-enterprise-alamo-national",
  "portal": "car",
  "name": "Avis · Enterprise · Alamo · National",
  "area": "RTB airport",
  "description": "International brands at the airport.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-rony-s-tours",
  "portal": "land",
  "name": "Rony's Tours",
  "area": "Island-wide",
  "description": "Private guides and cruise-day tours.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-bodden-tours",
  "portal": "land",
  "name": "Bodden Tours",
  "area": "Island-wide",
  "description": "Island tours since 2003, original Zip 'n Dip.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-roatan-driver",
  "portal": "land",
  "name": "Roatan Driver",
  "area": "Island-wide",
  "description": "Private driver tours, run by a local couple.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-roatan-breakaway-tours",
  "portal": "land",
  "name": "Roatán Breakaway Tours",
  "area": "Coxen Hole",
  "description": "Island tours and shore excursions.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 316,
  "booking": "request"
 },
 {
  "id": "land-detour-roatan",
  "portal": "land",
  "name": "Detour Roatan",
  "area": "Pickup at port",
  "description": "West Side tour: Sandy Bay, West Bay, West End.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-real-deal-roatan-tours",
  "portal": "land",
  "name": "Real Deal Roatan Tours",
  "area": "Island-wide",
  "description": "Custom island tours.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-explore-roatan-excursions",
  "portal": "land",
  "name": "Explore Roatan Excursions",
  "area": "Island-wide",
  "description": "Island sightseeing tours.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-custom-roatan-adventures",
  "portal": "land",
  "name": "Custom Roatan Adventures",
  "area": "Island-wide",
  "description": "Build-your-own island day.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-jorge-lopez-roatan-tours",
  "portal": "land",
  "name": "Jorge Lopez Roatan Tours",
  "area": "Island-wide",
  "description": "Private guided tours.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "land-mayan-jungle-atv",
  "portal": "land",
  "name": "Mayan Jungle ATV",
  "area": "Roatán",
  "description": "ATV rides on jungle trails.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "zip-south-shore-adventures",
  "portal": "zip",
  "name": "South Shore Adventures",
  "area": "Near West Bay",
  "description": "About 2 miles of line, longest run 1,300 ft.",
  "priceText": "from $65",
  "priceUsd": 65.0,
  "priceIsFrom": true,
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "zip-gumbalimba-park-canopy",
  "portal": "zip",
  "name": "Gumbalimba Park Canopy",
  "area": "West Bay",
  "description": "Zip lines that end inside Gumbalimba Park.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "zip-pirates-of-the-caribbean-canopy",
  "portal": "zip",
  "name": "Pirates of the Caribbean Canopy",
  "area": "Roatán",
  "description": "Canopy course with beginner and advanced lines.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "zip-jungle-top-zipline",
  "portal": "zip",
  "name": "Jungle Top Zipline",
  "area": "French Harbour",
  "description": "Zip line, wildlife eco-park and snorkel combos.",
  "priceText": "from $65",
  "priceUsd": 65.0,
  "priceIsFrom": true,
  "unit": "person",
  "rating": 4.8,
  "reviews": 42,
  "booking": "request"
 },
 {
  "id": "zip-mayan-jungle-canopy",
  "portal": "zip",
  "name": "Mayan Jungle Canopy",
  "area": "Roatán",
  "description": "Zip line with monkeys and sloths.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "zip-king-kong-extreme-zipline",
  "portal": "zip",
  "name": "King Kong Extreme Zipline",
  "area": "Roatán",
  "description": "Extreme zip line with city tour.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-gumbalimba-park",
  "portal": "park",
  "name": "Gumbalimba Park",
  "area": "West Bay",
  "description": "Monkeys, macaws, gardens, suspension bridge, pirate cave.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-mayan-eden-eco-park",
  "portal": "park",
  "name": "Mayan Eden Eco Park",
  "area": "Coxen Hole",
  "description": "Wildlife park close to the cruise ports.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-daniel-johnson-s-monkey-sloth-hangout",
  "portal": "park",
  "name": "Daniel Johnson's Monkey & Sloth Hangout",
  "area": "French Cay",
  "description": "Hold a sloth and meet capuchins. Closed Sundays.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-aj-s-monkeys-sloths",
  "portal": "park",
  "name": "AJ's Monkeys & Sloths",
  "area": "French Cay",
  "description": "Sloth and monkey encounters. Closed Sundays.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-victor-bodden-s-monkey-business",
  "portal": "park",
  "name": "Victor Bodden's Monkey Business",
  "area": "Sandy Bay",
  "description": "Sloths and monkeys. Closed Saturdays.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-manawakie-eco-nature-park",
  "portal": "park",
  "name": "Manawakie Eco Nature Park",
  "area": "Roatán",
  "description": "Monkeys, sloths, hummingbirds. Mon–Sat 7–4.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-arch-s-iguana-marine-park",
  "portal": "park",
  "name": "Arch's Iguana & Marine Park",
  "area": "French Harbour",
  "description": "Thousands of iguanas, fed around noon.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-carambola-botanical-gardens",
  "portal": "park",
  "name": "Carambola Botanical Gardens",
  "area": "Sandy Bay",
  "description": "Orchid gardens and jungle trails.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-roatan-institute-for-marine-sciences",
  "portal": "park",
  "name": "Roatan Institute for Marine Sciences",
  "area": "Sandy Bay · Anthony's Key",
  "description": "Dolphin encounters and marine programs.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "park-roatan-museum",
  "portal": "park",
  "name": "Roatán Museum",
  "area": "Sandy Bay",
  "description": "Island history and archaeology.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "rx-west-roatan-drugstore",
  "portal": "rx",
  "name": "West Roatan Drugstore",
  "area": "West End",
  "description": "Pharmacy in West End.",
  "unit": "person",
  "phone": "+50499734601",
  "coords": [
   -86.5925,
   16.3055
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-international",
  "portal": "rx",
  "name": "Farmacia International",
  "area": "French Harbour",
  "description": "Open 8 am–7 pm.",
  "unit": "person",
  "phone": "+50424555831",
  "coords": [
   -86.4655,
   16.3545
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-siman",
  "portal": "rx",
  "name": "Farmacia Simán",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424450300",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-roatan",
  "portal": "rx",
  "name": "Farmacia Roatán",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424451260",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-moderna",
  "portal": "rx",
  "name": "Farmacia Moderna",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424451368",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-del-ahorro",
  "portal": "rx",
  "name": "Farmacia Del Ahorro",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424452118",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-loren",
  "portal": "rx",
  "name": "Farmacia Loren",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424452302",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-genesis",
  "portal": "rx",
  "name": "Farmacia Genesis",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424451528",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-josues",
  "portal": "rx",
  "name": "Farmacia Josues",
  "area": "Coxen Hole",
  "description": "",
  "unit": "person",
  "phone": "+50424452533",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "rx-farmacia-mount-pleasant",
  "portal": "rx",
  "name": "Farmacia Mount Pleasant",
  "area": "Los Fuertes",
  "description": "",
  "unit": "person",
  "phone": "+50424555413",
  "coords": [
   -86.472,
   16.356
  ],
  "booking": "info"
 },
 {
  "id": "med-hospital-cemesa-roatan",
  "portal": "med",
  "name": "Hospital Cemesa Roatán",
  "area": "French Harbour · Megaplaza, 2nd floor",
  "description": "Full private hospital: emergency, surgery, ICU, maternity, CT. English-speaking staff.",
  "unit": "person",
  "phone": "+50494460097",
  "coords": [
   -86.4655,
   16.3545
  ],
  "tag": "t247",
  "booking": "info"
 },
 {
  "id": "med-woods-medical-center",
  "portal": "med",
  "name": "Woods Medical Center",
  "area": "Coxen Hole",
  "description": "CT, X-ray, lab, inpatient care and air ambulance. Pharmacy open 24/7.",
  "unit": "person",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "med-unimed-urgent-care",
  "portal": "med",
  "name": "UNIMED Urgent Care",
  "area": "West End · Coconut Tree Plaza",
  "description": "Doctor available 24/7. X-ray, house calls, ground and air ambulance.",
  "unit": "person",
  "coords": [
   -86.5925,
   16.3055
  ],
  "tag": "t247",
  "booking": "info"
 },
 {
  "id": "med-alert-international-rescue",
  "portal": "med",
  "name": "Alert International Rescue",
  "area": "West Bay Mall",
  "description": "Emergency and outpatient care, ambulance. Accepts international insurance.",
  "unit": "person",
  "coords": [
   -86.5955,
   16.284
  ],
  "tag": "t247",
  "booking": "info"
 },
 {
  "id": "med-anthony-s-key-resort-clinic",
  "portal": "med",
  "name": "Anthony's Key Resort Clinic",
  "area": "Sandy Bay",
  "description": "Open to the public. The island's only hyperbaric chamber for dive injuries.",
  "unit": "person",
  "coords": [
   -86.566,
   16.329
  ],
  "tag": "tHyper",
  "booking": "info"
 },
 {
  "id": "med-clinica-esperanza",
  "portal": "med",
  "name": "Clínica Esperanza",
  "area": "Sandy Bay",
  "description": "Low-cost walk-in clinic: pediatrics, women's health, lab and pharmacy.",
  "unit": "person",
  "coords": [
   -86.566,
   16.329
  ],
  "booking": "info"
 },
 {
  "id": "med-island-med-clinic",
  "portal": "med",
  "name": "Island Med Clinic",
  "area": "Coxen Hole · Main Street",
  "description": "Specialists, lab and minor surgery.",
  "unit": "person",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "med-roatan-public-hospital",
  "portal": "med",
  "name": "Roatán Public Hospital",
  "area": "Coxen Hole",
  "description": "Public hospital. Limited resources; private hospitals are better equipped for serious emergencies.",
  "unit": "person",
  "coords": [
   -86.5374,
   16.318
  ],
  "booking": "info"
 },
 {
  "id": "hotel-infinity-bay-spa-beach-resort",
  "portal": "hotel",
  "name": "Infinity Bay Spa & Beach Resort",
  "area": "West Bay",
  "description": "Upscale beachfront resort.",
  "unit": "person",
  "rating": 4.5,
  "reviews": 3391,
  "booking": "request"
 },
 {
  "id": "hotel-kimpton-grand-roatan-resort",
  "portal": "hotel",
  "name": "Kimpton Grand Roatan Resort",
  "area": "West Bay",
  "description": "Luxury beach resort and spa.",
  "unit": "person",
  "rating": 4.7,
  "reviews": 1610,
  "booking": "request"
 },
 {
  "id": "hotel-hacienda-caribe-tesoro",
  "portal": "hotel",
  "name": "Hacienda Caribe Tesoro",
  "area": "West Bay",
  "description": "Boutique hotel.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 574,
  "booking": "request"
 },
 {
  "id": "hotel-paradise-beach-hotel",
  "portal": "hotel",
  "name": "Paradise Beach Hotel",
  "area": "West Bay",
  "description": "Beachfront, snorkeling right offshore.",
  "unit": "person",
  "rating": 4.4,
  "reviews": 2261,
  "booking": "request"
 },
 {
  "id": "hotel-mayan-princess-beach-dive-resort",
  "portal": "hotel",
  "name": "Mayan Princess Beach & Dive Resort",
  "area": "West Bay",
  "description": "Beach and dive resort.",
  "unit": "person",
  "rating": 4.3,
  "reviews": 1891,
  "booking": "request"
 },
 {
  "id": "hotel-bananarama-dive-beach-resort",
  "portal": "hotel",
  "name": "Bananarama Dive & Beach Resort",
  "area": "West Bay",
  "description": "Beach resort with dive center.",
  "unit": "person",
  "rating": 4.4,
  "reviews": 1780,
  "booking": "request"
 },
 {
  "id": "hotel-ibagari-boutique-hotel",
  "portal": "hotel",
  "name": "Ibagari Boutique Hotel",
  "area": "West Bay",
  "description": "Boutique hotel.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 403,
  "booking": "request"
 },
 {
  "id": "hotel-naboo-resort",
  "portal": "hotel",
  "name": "Naboo Resort",
  "area": "West Bay",
  "description": "Boutique dive resort.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 623,
  "booking": "request"
 },
 {
  "id": "hotel-seagrape-plantation-resort",
  "portal": "hotel",
  "name": "Seagrape Plantation Resort",
  "area": "West End",
  "description": "Family-run resort with dive center.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 908,
  "booking": "request"
 },
 {
  "id": "hotel-luna-beach-resort",
  "portal": "hotel",
  "name": "Luna Beach Resort",
  "area": "West End",
  "description": "Boutique beachfront resort.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 146,
  "booking": "request"
 },
 {
  "id": "hotel-mr-tucan-hotel",
  "portal": "hotel",
  "name": "Mr. Tucan Hotel",
  "area": "West End",
  "description": "Village hotel.",
  "unit": "person",
  "rating": 4.7,
  "reviews": 232,
  "booking": "request"
 },
 {
  "id": "hotel-puerta-azul-boutique-hotel",
  "portal": "hotel",
  "name": "Puerta Azul Boutique Hotel",
  "area": "Sandy Bay",
  "description": "Boutique hotel.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 441,
  "booking": "request"
 },
 {
  "id": "hotel-anthony-s-key-resort",
  "portal": "hotel",
  "name": "Anthony's Key Resort",
  "area": "Sandy Bay",
  "description": "Classic dive resort.",
  "unit": "person",
  "rating": 4.6,
  "reviews": 1632,
  "booking": "request"
 },
 {
  "id": "hotel-blue-bahia-resort",
  "portal": "hotel",
  "name": "Blue Bahia Resort",
  "area": "Sandy Bay",
  "description": "Beachfront resort.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 348,
  "booking": "request"
 },
 {
  "id": "hotel-barefoot-cay",
  "portal": "hotel",
  "name": "Barefoot Cay",
  "area": "French Harbour",
  "description": "Private-island luxury resort.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 779,
  "booking": "request"
 },
 {
  "id": "hotel-las-verandas-hotel-villas",
  "portal": "hotel",
  "name": "Las Verandas Hotel & Villas",
  "area": "Pristine Bay",
  "description": "Golf and marina resort.",
  "unit": "person",
  "rating": 4.6,
  "reviews": 347,
  "booking": "request"
 },
 {
  "id": "hotel-las-rocas-resort",
  "portal": "hotel",
  "name": "Las Rocas Resort",
  "area": "West End · Half Moon Bay",
  "description": "Resort and dive center.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-henry-morgan-hotel-beach-resort",
  "portal": "hotel",
  "name": "Henry Morgan Hotel & Beach Resort",
  "area": "West Bay",
  "description": "Beach resort; day passes available.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-lawson-rock-beach-resort",
  "portal": "hotel",
  "name": "Lawson Rock Beach Resort",
  "area": "Sandy Bay",
  "description": "Oceanfront resort.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-tranquilseas-eco-lodge",
  "portal": "hotel",
  "name": "Tranquilseas Eco Lodge",
  "area": "Sandy Bay",
  "description": "Eco lodge and dive center.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-guava-grove-resort-villas",
  "portal": "hotel",
  "name": "Guava Grove Resort & Villas",
  "area": "Sandy Bay",
  "description": "Family resort and villas.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-sol-y-mar-resort",
  "portal": "hotel",
  "name": "Sol y Mar Resort",
  "area": "Sandy Bay",
  "description": "Waterfront resort with a private beach club.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-airport-inn-roatan",
  "portal": "hotel",
  "name": "Airport Inn Roatan",
  "area": "Coxen Hole",
  "description": "Hotel by the airport.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-palmetto-bay-plantation",
  "portal": "hotel",
  "name": "Palmetto Bay Plantation",
  "area": "Palmetto Bay",
  "description": "Resort on the north shore.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-roatan-yacht-club-hotel-dive-center",
  "portal": "hotel",
  "name": "Roatan Yacht Club Hotel & Dive Center",
  "area": "French Harbour",
  "description": "Hotel, marina and dive center.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-las-palmas-beach-resort",
  "portal": "hotel",
  "name": "Las Palmas Beach Resort",
  "area": "French Harbour",
  "description": "Beach resort near French Harbour.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-pristine-bay-resort",
  "portal": "hotel",
  "name": "Pristine Bay Resort",
  "area": "Pristine Bay · First Bight",
  "description": "Resort with beach club and golf.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-media-luna-resort-beach-club",
  "portal": "hotel",
  "name": "Media Luna Resort & Beach Club",
  "area": "First Bight",
  "description": "Resort with beach club and spa.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-clarion-suites-at-pineapple-villas",
  "portal": "hotel",
  "name": "Clarion Suites at Pineapple Villas",
  "area": "First Bight",
  "description": "Suites and villas.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-fantasy-island-beach-resort",
  "portal": "hotel",
  "name": "Fantasy Island Beach Resort",
  "area": "French Cay",
  "description": "All-inclusive island resort and marina.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-parrot-tree-beach-resort",
  "portal": "hotel",
  "name": "Parrot Tree Beach Resort",
  "area": "Second Bight",
  "description": "Beach resort and marina.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-reef-house-resort",
  "portal": "hotel",
  "name": "Reef House Resort",
  "area": "Oak Ridge",
  "description": "Dive resort, water access.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-mango-creek-resort",
  "portal": "hotel",
  "name": "Mango Creek Resort",
  "area": "Port Royal",
  "description": "Overwater bungalows; water access only.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-paya-bay-resort",
  "portal": "hotel",
  "name": "Paya Bay Resort",
  "area": "Paya Bay",
  "description": "Beach resort; two beaches and nature trails.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-camp-bay-adventure-lodge",
  "portal": "hotel",
  "name": "Camp Bay Adventure Lodge",
  "area": "Camp Bay",
  "description": "Lodge on Camp Bay beach; kitesurfing in windy season.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-chelle-s-suites-and-restaurant",
  "portal": "hotel",
  "name": "Chelle's Suites and Restaurant",
  "area": "Camp Bay",
  "description": "Suites with restaurant.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-diamond-hill-resort",
  "portal": "hotel",
  "name": "Diamond Hill Resort",
  "area": "Diamond Rock",
  "description": "Apartments and resort.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "hotel-turquoise-bay-dive-beach-resort",
  "portal": "hotel",
  "name": "Turquoise Bay Dive & Beach Resort",
  "area": "Turquoise Bay",
  "description": "Beach and dive resort east of Punta Gorda.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-mila-del-mar",
  "portal": "food",
  "name": "Mila del Mar",
  "area": "West End",
  "description": "American and Caribbean.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 350,
  "booking": "request"
 },
 {
  "id": "food-sundowners",
  "portal": "food",
  "name": "Sundowners",
  "area": "West End · Half Moon Bay",
  "description": "Sunset beach bar.",
  "unit": "person",
  "rating": 4.6,
  "reviews": 1569,
  "booking": "request"
 },
 {
  "id": "food-happy-harry-s-hideaway",
  "portal": "food",
  "name": "Happy Harry's HideAway",
  "area": "West End",
  "description": "Italian and American.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 1551,
  "booking": "request"
 },
 {
  "id": "food-creole-s-rotisserie-chicken",
  "portal": "food",
  "name": "Creole's Rotisserie Chicken",
  "area": "West End",
  "description": "Island-style rotisserie chicken.",
  "unit": "person",
  "rating": 4.7,
  "reviews": 1341,
  "booking": "request"
 },
 {
  "id": "food-roatan-oasis",
  "portal": "food",
  "name": "Roatan Oasis",
  "area": "West End",
  "description": "Seafood.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 1108,
  "booking": "request"
 },
 {
  "id": "food-argentinian-grill",
  "portal": "food",
  "name": "Argentinian Grill",
  "area": "West End",
  "description": "Steaks and seafood.",
  "unit": "person",
  "rating": 4.2,
  "reviews": 1922,
  "booking": "request"
 },
 {
  "id": "food-cafe-escondido",
  "portal": "food",
  "name": "Cafe Escondido",
  "area": "West End",
  "description": "Breakfast and lunch above West End Divers.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 543,
  "booking": "request"
 },
 {
  "id": "food-ginger-s-caribbean-grill",
  "portal": "food",
  "name": "Ginger's Caribbean Grill",
  "area": "West End",
  "description": "Caribbean grill.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 483,
  "booking": "request"
 },
 {
  "id": "food-the-drunken-sailor",
  "portal": "food",
  "name": "The Drunken Sailor",
  "area": "West End",
  "description": "Italian and pizza.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 217,
  "booking": "request"
 },
 {
  "id": "food-luna-muna-by-ibagari",
  "portal": "food",
  "name": "Luna Muna By Ibagari",
  "area": "West Bay",
  "description": "Italian and seafood.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 1113,
  "booking": "request"
 },
 {
  "id": "food-la-palapa-beach-bar",
  "portal": "food",
  "name": "La Palapa Beach Bar",
  "area": "West Bay",
  "description": "Beach bar.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 1122,
  "booking": "request"
 },
 {
  "id": "food-cayuco-beach-bar",
  "portal": "food",
  "name": "Cayuco Beach Bar",
  "area": "West Bay",
  "description": "Caribbean beach bar.",
  "unit": "person",
  "rating": 4.6,
  "reviews": 988,
  "booking": "request"
 },
 {
  "id": "food-beachers-west-bay",
  "portal": "food",
  "name": "Beachers West Bay",
  "area": "West Bay",
  "description": "Beach bar and grill.",
  "unit": "person",
  "rating": 4.3,
  "reviews": 1805,
  "booking": "request"
 },
 {
  "id": "food-alera",
  "portal": "food",
  "name": "Alera",
  "area": "West Bay",
  "description": "Caribbean and Central American.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 368,
  "booking": "request"
 },
 {
  "id": "food-thirsty-turtle-bar-and-grill",
  "portal": "food",
  "name": "Thirsty Turtle Bar and Grill",
  "area": "West Bay",
  "description": "American and Caribbean.",
  "unit": "person",
  "rating": 4.2,
  "reviews": 1377,
  "booking": "request"
 },
 {
  "id": "food-javavine-cafe-wine-bar",
  "portal": "food",
  "name": "JavaVine Cafe & Wine Bar",
  "area": "West Bay",
  "description": "Coffee and wine bar.",
  "unit": "person",
  "rating": 4.6,
  "reviews": 663,
  "booking": "request"
 },
 {
  "id": "food-ilene-s-kitchen",
  "portal": "food",
  "name": "Ilene's Kitchen",
  "area": "West End",
  "description": "Traditional island cooking.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-the-thai-place",
  "portal": "food",
  "name": "The Thai Place",
  "area": "West End",
  "description": "Thai.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-por-que-no",
  "portal": "food",
  "name": "Por Qué No?",
  "area": "West End",
  "description": "Mediterranean.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-wraps-art",
  "portal": "food",
  "name": "Wraps + Art",
  "area": "West End",
  "description": "Wraps and sandwiches.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-anthony-s-chicken",
  "portal": "food",
  "name": "Anthony's Chicken",
  "area": "West End",
  "description": "Jerk chicken and chicken baleadas.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-sandy-buns-bakery",
  "portal": "food",
  "name": "Sandy Buns Bakery",
  "area": "West End",
  "description": "Bakery and American breakfast.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-loretta-s-island-cooking",
  "portal": "food",
  "name": "Loretta's Island Cooking",
  "area": "West End · Half Moon Bay",
  "description": "Home-style island and Honduran food.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-lily-pond-house-restaurant",
  "portal": "food",
  "name": "Lily Pond House Restaurant",
  "area": "West End",
  "description": "Seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-pazzo-italian-restaurant",
  "portal": "food",
  "name": "Pazzo Italian Restaurant",
  "area": "West End",
  "description": "Italian.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-pura-vida-roatan",
  "portal": "food",
  "name": "Pura Vida Roatán",
  "area": "West End · Half Moon Bay",
  "description": "Costa Rican and Central American.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-cafe-de-palo",
  "portal": "food",
  "name": "Cafe de Palo",
  "area": "West End",
  "description": "Café and breakfast.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-crisp",
  "portal": "food",
  "name": "Crisp",
  "area": "West End",
  "description": "Asian-inspired bowls and poke.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-splash-inn-restaurant",
  "portal": "food",
  "name": "Splash Inn Restaurant",
  "area": "West End",
  "description": "Fajitas, pasta and seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-calelu-s",
  "portal": "food",
  "name": "Calelu's",
  "area": "West End",
  "description": "Honduran.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-booty-bar",
  "portal": "food",
  "name": "Booty Bar",
  "area": "West End",
  "description": "American and Honduran bar food.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-yahongreh",
  "portal": "food",
  "name": "Yahongreh",
  "area": "West End",
  "description": "Honduran baleadas.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-c-level-pizza",
  "portal": "food",
  "name": "C Level Pizza",
  "area": "West End",
  "description": "Pizza.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-blue-marlin",
  "portal": "food",
  "name": "Blue Marlin",
  "area": "West End",
  "description": "Bar food, breakfast and lunch.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-pollos-to-go",
  "portal": "food",
  "name": "Pollos to Go",
  "area": "West End",
  "description": "Chicken.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-vintage-pearl-restaurant-wine-cellar",
  "portal": "food",
  "name": "Vintage Pearl Restaurant & Wine Cellar",
  "area": "West Bay",
  "description": "Gourmet menu that changes daily.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-lala-s-gallery-and-garden-cafe",
  "portal": "food",
  "name": "Lala's Gallery and Garden Cafe",
  "area": "West Bay",
  "description": "Vegetable-forward international.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-sea-salt-fine-dining-beach-bistro",
  "portal": "food",
  "name": "Sea Salt Fine Dining Beach Bistro",
  "area": "West Bay",
  "description": "Seafood, fine dining.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-argentinian-grill-west-bay",
  "portal": "food",
  "name": "Argentinian Grill West Bay",
  "area": "West Bay",
  "description": "Argentinian grill.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-trattoria-da-piero",
  "portal": "food",
  "name": "Trattoria Da Piero",
  "area": "West Bay",
  "description": "Italian and Bay Islands dishes.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-the-mayan",
  "portal": "food",
  "name": "The Mayan",
  "area": "West Bay",
  "description": "Ceviche, steak and seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-the-hungry-kiwi",
  "portal": "food",
  "name": "The Hungry Kiwi",
  "area": "Sandy Bay",
  "description": "Breakfast and lunch; dinners Wed–Sat (lamb, prime rib, fish).",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-blue-bahia-beach-grill",
  "portal": "food",
  "name": "Blue Bahia Beach Grill",
  "area": "Sandy Bay",
  "description": "Beachfront grill: smoked ribs, catch of the day.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-dragonfly-rolls-sushi-fusion",
  "portal": "food",
  "name": "Dragonfly Rolls Sushi & Fusion",
  "area": "Sandy Bay",
  "description": "Sushi and fusion.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-the-sunken-fish-restaurant",
  "portal": "food",
  "name": "The Sunken Fish Restaurant",
  "area": "Sandy Bay",
  "description": "Caribbean seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-la-cevicheria-roatan",
  "portal": "food",
  "name": "La Cevicheria Roatan",
  "area": "Sandy Bay",
  "description": "Ceviche and Latin seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-j-o-the-steak-house",
  "portal": "food",
  "name": "J&O The Steak House",
  "area": "Sandy Bay",
  "description": "Steakhouse.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-ankor-seafood-grill",
  "portal": "food",
  "name": "Ankor Seafood Grill",
  "area": "Sandy Bay",
  "description": "Seafood and steak.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-guava-grill-pool-bar-restaurant",
  "portal": "food",
  "name": "Guava Grill Pool Bar & Restaurant",
  "area": "Sandy Bay",
  "description": "Pool bar and restaurant.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-kazoku",
  "portal": "food",
  "name": "Kazoku",
  "area": "Sandy Bay",
  "description": "Korean, sushi and tacos.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-fort-consolation-restaurant",
  "portal": "food",
  "name": "Fort Consolation Restaurant",
  "area": "Consolation Bight",
  "description": "Caribbean fusion and seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-silversides-restaurant-bar",
  "portal": "food",
  "name": "Silversides Restaurant & Bar",
  "area": "French Harbour · Brick Bay",
  "description": "Fine dining, seafood and meat (on the cay by Barefoot Cay).",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-gio-s",
  "portal": "food",
  "name": "Gio's",
  "area": "French Harbour",
  "description": "Seafood and steaks.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-h-b-warren-lunch-counter",
  "portal": "food",
  "name": "H.B. Warren lunch counter",
  "area": "Coxen Hole",
  "description": "Supermarket lunch counter: fried chicken, breakfast.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-cal-s-temporary-cantina",
  "portal": "food",
  "name": "Cal's Temporary Cantina",
  "area": "First Bight",
  "description": "Island Tex-Mex with a ridge-top view.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-hole-in-the-wall",
  "portal": "food",
  "name": "Hole in the Wall",
  "area": "Jonesville",
  "description": "Lobster, shrimp and steaks; reached by boat.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-the-crow-s-nest",
  "portal": "food",
  "name": "The Crow's Nest",
  "area": "Oak Ridge",
  "description": "Seafood, salads, sandwiches and smoked BBQ.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-bj-s-backyard",
  "portal": "food",
  "name": "BJ's Backyard",
  "area": "Oak Ridge",
  "description": "Casual: shrimp burgers and fries.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-garifuna-living-foods",
  "portal": "food",
  "name": "Garifuna Living Foods",
  "area": "Punta Gorda",
  "description": "Garifuna food, including machuca.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-restaurante-perla",
  "portal": "food",
  "name": "Restaurante Perla",
  "area": "Punta Gorda",
  "description": "Local food at the west entrance to Punta Gorda.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-la-sirena-de-camp-bay",
  "portal": "food",
  "name": "La Sirena de Camp Bay",
  "area": "Camp Bay",
  "description": "Island food: lionfish, coconut shrimp.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "food-udurau-restaurant-turquoise-bay",
  "portal": "food",
  "name": "Udurau Restaurant (Turquoise Bay)",
  "area": "Turquoise Bay",
  "description": "British-Caribbean seafood.",
  "unit": "person",
  "booking": "request"
 },
 {
  "id": "merch-roatan-rum-company",
  "portal": "merch",
  "name": "Roatan Rum Company",
  "area": "West End area",
  "description": "Rum tasting, make your own rum, rum cake.",
  "unit": "person",
  "rating": 4.7,
  "reviews": 461,
  "booking": "request"
 },
 {
  "id": "merch-the-roatan-chocolate-factory",
  "portal": "merch",
  "name": "The Roatan Chocolate Factory",
  "area": "West End",
  "description": "Island chocolate and tours.",
  "unit": "person",
  "rating": 4.5,
  "reviews": 285,
  "booking": "request"
 },
 {
  "id": "merch-mayak-chocolate",
  "portal": "merch",
  "name": "Mayak Chocolate",
  "area": "West End",
  "description": "Local chocolate shop.",
  "unit": "person",
  "rating": 4.5,
  "reviews": 103,
  "booking": "request"
 },
 {
  "id": "merch-karma-jewelry-design",
  "portal": "merch",
  "name": "Karma Jewelry Design",
  "area": "West Bay",
  "description": "Handmade jewelry.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 441,
  "booking": "request"
 },
 {
  "id": "merch-rusty-fish",
  "portal": "merch",
  "name": "Rusty Fish",
  "area": "Roatán",
  "description": "Art made from recycled materials.",
  "unit": "person",
  "rating": 4.7,
  "reviews": 338,
  "booking": "request"
 },
 {
  "id": "merch-stone-castle-cameo-factory",
  "portal": "merch",
  "name": "Stone Castle Cameo Factory",
  "area": "Coxen Hole",
  "description": "Cameos, island stones and carvings.",
  "unit": "person",
  "rating": 4.3,
  "reviews": 120,
  "booking": "request"
 },
 {
  "id": "merch-shawn-jackson-gallery",
  "portal": "merch",
  "name": "Shawn Jackson Gallery",
  "area": "West End",
  "description": "Local art gallery.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 66,
  "booking": "request"
 },
 {
  "id": "merch-penelope-s-island-emporium",
  "portal": "merch",
  "name": "Penelope's Island Emporium",
  "area": "West Bay",
  "description": "Gifts and island goods.",
  "unit": "person",
  "rating": 4.8,
  "reviews": 51,
  "booking": "request"
 },
 {
  "id": "merch-made-in-roatan",
  "portal": "merch",
  "name": "Made in Roatan",
  "area": "Roatán",
  "description": "Island-made gifts.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 37,
  "booking": "request"
 },
 {
  "id": "merch-pies-bonitos",
  "portal": "merch",
  "name": "Pies Bonitos",
  "area": "West Bay",
  "description": "Gift shop.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 25,
  "booking": "request"
 },
 {
  "id": "merch-so-tropic",
  "portal": "merch",
  "name": "So Tropic",
  "area": "West Bay",
  "description": "Tropical gifts and clothing.",
  "unit": "person",
  "rating": 5.0,
  "reviews": 17,
  "booking": "request"
 },
 {
  "id": "merch-booknook-roatan",
  "portal": "merch",
  "name": "Booknook Roatan",
  "area": "West End",
  "description": "Books and gifts.",
  "unit": "person",
  "rating": 4.9,
  "reviews": 16,
  "booking": "request"
 },
 {
  "id": "merch-waves-of-art-gallery",
  "portal": "merch",
  "name": "Waves of Art Gallery",
  "area": "Sandy Bay",
  "description": "Local art, crafts and photography.",
  "unit": "person",
  "booking": "request"
 }
];
