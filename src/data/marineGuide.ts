// Roatán reef species guide (Marine life → Guide). Facts kept to well-established natural history.
// Status: cr = critically endangered, en = endangered (IUCN Red List), sanctuary = all sharks protected in Honduras
// (shark sanctuary since 2011), protected = protected marine mammal, invasive = remove/eat, none = no special status.
// Safety notes are added in the app from supabase/functions/_shared/marine.ts (same table as the scanner).
export type GuideGroup = 'fish' | 'turtle' | 'ray' | 'shark' | 'eel' | 'invertebrate' | 'mammal' | 'coral';
export type GuideStatus = 'cr' | 'en' | 'sanctuary' | 'protected' | 'invasive' | 'none';
export type Habitat = 'reef' | 'sand' | 'seagrass' | 'wall' | 'open' | 'night';
export interface GuideSpecies {
  id: string;
  group: GuideGroup;
  emoji: string;
  sci: string;
  names: { en: string; es: string };
  status: GuideStatus;
  habitat: Habitat;
  fact: Record<'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'zh', string>;
}

export const MARINE_GUIDE: GuideSpecies[] = [
 {
  "id": "hawksbill",
  "group": "turtle",
  "emoji": "🐢",
  "sci": "Eretmochelys imbricata",
  "names": {
   "en": "Hawksbill turtle",
   "es": "Tortuga carey"
  },
  "status": "cr",
  "habitat": "reef",
  "fact": {
   "en": "Eats mostly sponges, which helps corals get space to grow.",
   "es": "Come sobre todo esponjas, lo que deja espacio para que crezcan los corales.",
   "fr": "Se nourrit surtout d’éponges, ce qui laisse de la place aux coraux.",
   "de": "Frisst vor allem Schwämme und schafft so Platz für Korallen.",
   "pt": "Come principalmente esponjas, abrindo espaço para os corais.",
   "it": "Mangia soprattutto spugne, lasciando spazio ai coralli.",
   "zh": "主要以海绵为食，为珊瑚腾出生长空间。"
  }
 },
 {
  "id": "green-turtle",
  "group": "turtle",
  "emoji": "🐢",
  "sci": "Chelonia mydas",
  "names": {
   "en": "Green turtle",
   "es": "Tortuga verde"
  },
  "status": "en",
  "habitat": "seagrass",
  "fact": {
   "en": "Adults graze on seagrass, keeping the meadows healthy.",
   "es": "Los adultos pastan pastos marinos y mantienen sanas las praderas.",
   "fr": "Les adultes broutent les herbiers et les gardent en bonne santé.",
   "de": "Erwachsene grasen Seegraswiesen ab und halten sie gesund.",
   "pt": "Os adultos pastam ervas marinhas e mantêm os prados saudáveis.",
   "it": "Gli adulti brucano le praterie di fanerogame, mantenendole sane.",
   "zh": "成年绿海龟啃食海草，让海草床保持健康。"
  }
 },
 {
  "id": "eagle-ray",
  "group": "ray",
  "emoji": "🌊",
  "sci": "Aetobatus narinari",
  "names": {
   "en": "Spotted eagle ray",
   "es": "Raya águila"
  },
  "status": "en",
  "habitat": "sand",
  "fact": {
   "en": "Often glides in pairs or small groups over sand near the reef.",
   "es": "Suele planear en parejas o grupos pequeños sobre la arena.",
   "fr": "Glisse souvent en couple ou en petit groupe au-dessus du sable.",
   "de": "Gleitet oft paarweise oder in kleinen Gruppen über Sand.",
   "pt": "Costuma planar em pares ou pequenos grupos sobre a areia.",
   "it": "Plana spesso in coppia o in piccoli gruppi sopra la sabbia.",
   "zh": "常成对或成小群在礁石附近的沙地上空滑翔。"
  }
 },
 {
  "id": "southern-stingray",
  "group": "ray",
  "emoji": "🌊",
  "sci": "Hypanus americanus",
  "names": {
   "en": "Southern stingray",
   "es": "Raya látigo"
  },
  "status": "none",
  "habitat": "sand",
  "fact": {
   "en": "Buries itself in sand with only its eyes showing.",
   "es": "Se entierra en la arena y solo se le ven los ojos.",
   "fr": "S’enfouit dans le sable, seuls ses yeux dépassent.",
   "de": "Gräbt sich in Sand ein, nur die Augen schauen heraus.",
   "pt": "Enterra-se na areia deixando só os olhos de fora.",
   "it": "Si seppellisce nella sabbia lasciando fuori solo gli occhi.",
   "zh": "把自己埋进沙里，只露出眼睛。"
  }
 },
 {
  "id": "nurse-shark",
  "group": "shark",
  "emoji": "🦈",
  "sci": "Ginglymostoma cirratum",
  "names": {
   "en": "Nurse shark",
   "es": "Tiburón gata"
  },
  "status": "sanctuary",
  "habitat": "reef",
  "fact": {
   "en": "Rests under ledges by day and hunts at night. Honduras protects all sharks.",
   "es": "Descansa bajo salientes de día y caza de noche. Honduras protege a todos los tiburones.",
   "fr": "Se repose sous les surplombs le jour et chasse la nuit. Le Honduras protège tous les requins.",
   "de": "Ruht tagsüber unter Überhängen und jagt nachts. Honduras schützt alle Haie.",
   "pt": "Descansa sob saliências de dia e caça à noite. Honduras protege todos os tubarões.",
   "it": "Riposa sotto gli anfratti di giorno e caccia di notte. L’Honduras protegge tutti gli squali.",
   "zh": "白天在礁石下休息，夜间觅食。洪都拉斯保护所有鲨鱼。"
  }
 },
 {
  "id": "reef-shark",
  "group": "shark",
  "emoji": "🦈",
  "sci": "Carcharhinus perezi",
  "names": {
   "en": "Caribbean reef shark",
   "es": "Tiburón de arrecife"
  },
  "status": "sanctuary",
  "habitat": "wall",
  "fact": {
   "en": "Seen mostly on deeper dives; calm unless people feed or chase it.",
   "es": "Se ve sobre todo en buceos profundos; es tranquilo si no lo alimentan ni persiguen.",
   "fr": "Surtout visible en plongée profonde ; calme si on ne le nourrit ni ne le poursuit.",
   "de": "Meist bei tieferen Tauchgängen zu sehen; ruhig, solange man es nicht füttert oder jagt.",
   "pt": "Visto sobretudo em mergulhos profundos; calmo se não for alimentado ou perseguido.",
   "it": "Si vede soprattutto nelle immersioni profonde; tranquillo se non lo si nutre o insegue.",
   "zh": "多在较深潜点出现；只要不投喂、不追逐，它很平静。"
  }
 },
 {
  "id": "whale-shark",
  "group": "shark",
  "emoji": "🦈",
  "sci": "Rhincodon typus",
  "names": {
   "en": "Whale shark",
   "es": "Tiburón ballena"
  },
  "status": "en",
  "habitat": "open",
  "fact": {
   "en": "The biggest fish in the sea; eats plankton. Seen most around Utila.",
   "es": "El pez más grande del mar; come plancton. Se ve más cerca de Utila.",
   "fr": "Le plus grand poisson des mers ; mange du plancton. Surtout vu près d’Utila.",
   "de": "Der größte Fisch der Welt; frisst Plankton. Meist bei Utila zu sehen.",
   "pt": "O maior peixe do mar; come plâncton. Mais visto perto de Utila.",
   "it": "Il pesce più grande del mare; mangia plancton. Avvistato soprattutto vicino a Utila.",
   "zh": "世界上最大的鱼，以浮游生物为食，多见于乌提拉岛附近。"
  }
 },
 {
  "id": "green-moray",
  "group": "eel",
  "emoji": "🐍",
  "sci": "Gymnothorax funebris",
  "names": {
   "en": "Green moray",
   "es": "Morena verde"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Opens and closes its mouth to breathe — it is not threatening you.",
   "es": "Abre y cierra la boca para respirar, no te está amenazando.",
   "fr": "Ouvre et ferme la bouche pour respirer — ce n’est pas une menace.",
   "de": "Öffnet das Maul zum Atmen – das ist keine Drohung.",
   "pt": "Abre e fecha a boca para respirar — não é ameaça.",
   "it": "Apre e chiude la bocca per respirare: non ti sta minacciando.",
   "zh": "张嘴闭嘴是在呼吸，并非威胁你。"
  }
 },
 {
  "id": "spotted-moray",
  "group": "eel",
  "emoji": "🐍",
  "sci": "Gymnothorax moringa",
  "names": {
   "en": "Spotted moray",
   "es": "Morena pintada"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Hides in holes by day; peek in, but keep your fingers out.",
   "es": "Se esconde en huecos de día; mira, pero no metas los dedos.",
   "fr": "Se cache dans les trous le jour ; regardez sans y mettre les doigts.",
   "de": "Versteckt sich tagsüber in Löchern; schauen ja, Finger nein.",
   "pt": "Esconde-se em buracos de dia; olhe, mas sem pôr os dedos.",
   "it": "Di giorno si nasconde nelle tane; guarda, ma tieni lontane le dita.",
   "zh": "白天躲在洞里，可以看，但别把手指伸进去。"
  }
 },
 {
  "id": "lionfish",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Pterois volitans",
  "names": {
   "en": "Lionfish",
   "es": "Pez león"
  },
  "status": "invasive",
  "habitat": "reef",
  "fact": {
   "en": "Invasive here — divers remove them and local restaurants serve them.",
   "es": "Aquí es invasor: los buzos lo retiran y los restaurantes lo sirven.",
   "fr": "Espèce invasive ici : les plongeurs la retirent et les restaurants la servent.",
   "de": "Hier invasiv – Taucher entfernen ihn, Restaurants servieren ihn.",
   "pt": "Invasor aqui: mergulhadores retiram e restaurantes servem.",
   "it": "Qui è invasivo: i sub lo rimuovono e i ristoranti lo servono.",
   "zh": "在这里是入侵物种，潜水员会清除，当地餐厅也会供应。"
  }
 },
 {
  "id": "queen-angelfish",
  "group": "fish",
  "emoji": "🐠",
  "sci": "Holacanthus ciliaris",
  "names": {
   "en": "Queen angelfish",
   "es": "Pez ángel reina"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Look for the blue “crown” spot on its forehead.",
   "es": "Busca la mancha azul en forma de “corona” en su frente.",
   "fr": "Cherchez la tache bleue en « couronne » sur son front.",
   "de": "Achten Sie auf den blauen „Kronen“-Fleck auf der Stirn.",
   "pt": "Procure a mancha azul em forma de “coroa” na testa.",
   "it": "Cerca la macchia blu a “corona” sulla fronte.",
   "zh": "留意它额头上蓝色的“王冠”斑点。"
  }
 },
 {
  "id": "french-angelfish",
  "group": "fish",
  "emoji": "🐠",
  "sci": "Pomacanthus paru",
  "names": {
   "en": "French angelfish",
   "es": "Pez ángel francés"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Usually swims in pairs and is curious about divers.",
   "es": "Suele nadar en pareja y es curioso con los buzos.",
   "fr": "Nage souvent en couple et se montre curieux.",
   "de": "Schwimmt meist paarweise und ist neugierig.",
   "pt": "Costuma nadar em pares e é curioso com mergulhadores.",
   "it": "Di solito nuota in coppia ed è curioso verso i sub.",
   "zh": "通常成对游动，对潜水员很好奇。"
  }
 },
 {
  "id": "stoplight-parrotfish",
  "group": "fish",
  "emoji": "🐠",
  "sci": "Sparisoma viride",
  "names": {
   "en": "Stoplight parrotfish",
   "es": "Pez loro semáforo"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Scrapes algae off coral; the sand on our beaches is partly parrotfish poop.",
   "es": "Raspa algas del coral; parte de la arena de las playas viene de sus heces.",
   "fr": "Racle les algues du corail ; une partie du sable des plages vient de ses excréments.",
   "de": "Schabt Algen von Korallen; ein Teil unseres Strandsands ist Papageifisch-Kot.",
   "pt": "Raspa algas do coral; parte da areia das praias vem das fezes dele.",
   "it": "Raschia le alghe dal corallo; parte della sabbia delle spiagge sono i suoi escrementi.",
   "zh": "啃食珊瑚上的藻类；海滩上的沙子部分来自鹦嘴鱼的粪便。"
  }
 },
 {
  "id": "queen-parrotfish",
  "group": "fish",
  "emoji": "🐠",
  "sci": "Scarus vetula",
  "names": {
   "en": "Queen parrotfish",
   "es": "Pez loro reina"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Sleeps in a mucus “sleeping bag” it makes every night.",
   "es": "Duerme dentro de una “bolsa” de moco que fabrica cada noche.",
   "fr": "Dort dans un « sac de couchage » de mucus fabriqué chaque nuit.",
   "de": "Schläft in einem Schleim-„Schlafsack“, den er jede Nacht bildet.",
   "pt": "Dorme num “saco de dormir” de muco que faz toda noite.",
   "it": "Dorme in un “sacco a pelo” di muco che produce ogni notte.",
   "zh": "每晚会分泌黏液做成“睡袋”在里面睡觉。"
  }
 },
 {
  "id": "blue-tang",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Acanthurus coeruleus",
  "names": {
   "en": "Blue tang",
   "es": "Cirujano azul"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Young ones are bright yellow and turn blue as they grow.",
   "es": "Los jóvenes son amarillos y se vuelven azules al crecer.",
   "fr": "Les jeunes sont jaune vif et bleuissent en grandissant.",
   "de": "Jungtiere sind leuchtend gelb und werden später blau.",
   "pt": "Os jovens são amarelos e ficam azuis ao crescer.",
   "it": "I giovani sono gialli e diventano blu crescendo.",
   "zh": "幼鱼是亮黄色，长大后变成蓝色。"
  }
 },
 {
  "id": "sergeant-major",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Abudefduf saxatilis",
  "names": {
   "en": "Sergeant major",
   "es": "Pez sargento"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Males guard purple egg patches and will chase much bigger fish away.",
   "es": "Los machos cuidan los huevos morados y ahuyentan peces más grandes.",
   "fr": "Les mâles gardent des pontes violettes et chassent des poissons bien plus gros.",
   "de": "Männchen bewachen violette Gelege und vertreiben viel größere Fische.",
   "pt": "Os machos guardam ovos roxos e espantam peixes muito maiores.",
   "it": "I maschi sorvegliano le uova viola e scacciano pesci molto più grandi.",
   "zh": "雄鱼守护紫色鱼卵，会驱赶比自己大得多的鱼。"
  }
 },
 {
  "id": "yellowtail-snapper",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Ocyurus chrysurus",
  "names": {
   "en": "Yellowtail snapper",
   "es": "Pargo cola amarilla"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Easy to spot by the yellow stripe running to its forked tail.",
   "es": "Fácil de ver por la raya amarilla que llega a su cola.",
   "fr": "Facile à repérer grâce à la bande jaune jusqu’à la queue.",
   "de": "Gut am gelben Streifen bis zur Schwanzflosse zu erkennen.",
   "pt": "Fácil de ver pela faixa amarela até a cauda.",
   "it": "Facile da riconoscere per la striscia gialla fino alla coda.",
   "zh": "从身侧延伸到叉形尾巴的黄色条纹很好辨认。"
  }
 },
 {
  "id": "barracuda",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Sphyraena barracuda",
  "names": {
   "en": "Great barracuda",
   "es": "Barracuda"
  },
  "status": "none",
  "habitat": "open",
  "fact": {
   "en": "Curious and often follows snorkelers at a distance; just enjoy the view.",
   "es": "Es curiosa y suele seguir a los buceadores a distancia; solo disfrútala.",
   "fr": "Curieux, il suit souvent les nageurs à distance ; profitez du spectacle.",
   "de": "Neugierig, folgt Schnorchlern oft mit Abstand; einfach genießen.",
   "pt": "Curiosa, segue mergulhadores à distância; só aprecie.",
   "it": "Curioso, segue spesso gli snorkelisti a distanza; goditi la vista.",
   "zh": "好奇心强，常远远跟着浮潜者，欣赏就好。"
  }
 },
 {
  "id": "hogfish",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Lachnolaimus maximus",
  "names": {
   "en": "Hogfish",
   "es": "Pez perro"
  },
  "status": "none",
  "habitat": "sand",
  "fact": {
   "en": "Starts life as a female and can later change to male.",
   "es": "Nace hembra y más tarde puede volverse macho.",
   "fr": "Naît femelle et peut devenir mâle plus tard.",
   "de": "Beginnt als Weibchen und kann später zum Männchen werden.",
   "pt": "Nasce fêmea e pode virar macho depois.",
   "it": "Nasce femmina e può diventare maschio in seguito.",
   "zh": "出生时是雌性，之后可以转变为雄性。"
  }
 },
 {
  "id": "trumpetfish",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Aulostomus maculatus",
  "names": {
   "en": "Trumpetfish",
   "es": "Pez trompeta"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Hangs head-down among sea rods to hide while it hunts.",
   "es": "Se cuelga cabeza abajo entre gorgonias para cazar sin ser visto.",
   "fr": "Se tient tête en bas parmi les gorgones pour chasser caché.",
   "de": "Hängt kopfüber zwischen Gorgonien, um versteckt zu jagen.",
   "pt": "Fica de cabeça para baixo entre gorgônias para caçar escondido.",
   "it": "Sta a testa in giù tra le gorgonie per cacciare nascosto.",
   "zh": "头朝下藏在柳珊瑚间伺机捕猎。"
  }
 },
 {
  "id": "trunkfish",
  "group": "fish",
  "emoji": "🐡",
  "sci": "Lactophrys triqueter",
  "names": {
   "en": "Smooth trunkfish",
   "es": "Pez cofre"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Has a hard box-like shell and releases a toxin when stressed.",
   "es": "Tiene un caparazón duro como una caja y suelta toxina si se estresa.",
   "fr": "Possède une carapace rigide et libère une toxine s’il est stressé.",
   "de": "Hat einen harten Panzer und gibt bei Stress Gift ab.",
   "pt": "Tem carapaça dura como caixa e solta toxina se estressado.",
   "it": "Ha un guscio rigido e rilascia una tossina se stressato.",
   "zh": "有坚硬的盒状外壳，受惊时会释放毒素。"
  }
 },
 {
  "id": "porcupinefish",
  "group": "fish",
  "emoji": "🐡",
  "sci": "Diodon hystrix",
  "names": {
   "en": "Porcupinefish",
   "es": "Pez erizo"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Puffs up with water when scared — please never grab one to see it.",
   "es": "Se infla de agua cuando se asusta; nunca lo agarres para verlo.",
   "fr": "Se gonfle d’eau quand il a peur — ne l’attrapez jamais pour le voir.",
   "de": "Bläst sich bei Angst mit Wasser auf – bitte nie anfassen, um es zu sehen.",
   "pt": "Infla com água quando assustado — nunca o pegue para ver.",
   "it": "Si gonfia d’acqua se spaventato: non afferrarlo mai per vederlo.",
   "zh": "受惊时会吸水膨胀——千万别为了看它膨胀而抓它。"
  }
 },
 {
  "id": "spotted-drum",
  "group": "fish",
  "emoji": "🐟",
  "sci": "Equetus punctatus",
  "names": {
   "en": "Spotted drum",
   "es": "Pez tambor"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Juveniles have a very long, flowing front fin.",
   "es": "Los jóvenes tienen una aleta delantera muy larga y ondulante.",
   "fr": "Les juvéniles ont une très longue nageoire avant flottante.",
   "de": "Jungtiere haben eine sehr lange, wehende Rückenflosse.",
   "pt": "Os jovens têm uma nadadeira dianteira muito longa.",
   "it": "I giovani hanno una pinna anteriore lunghissima e fluttuante.",
   "zh": "幼鱼有一条又长又飘逸的前背鳍。"
  }
 },
 {
  "id": "octopus",
  "group": "invertebrate",
  "emoji": "🐙",
  "sci": "Octopus briareus",
  "names": {
   "en": "Caribbean reef octopus",
   "es": "Pulpo de arrecife"
  },
  "status": "none",
  "habitat": "night",
  "fact": {
   "en": "Comes out at night and can change color in a split second.",
   "es": "Sale de noche y cambia de color en un instante.",
   "fr": "Sort la nuit et change de couleur en une fraction de seconde.",
   "de": "Kommt nachts heraus und wechselt blitzschnell die Farbe.",
   "pt": "Sai à noite e muda de cor num instante.",
   "it": "Esce di notte e cambia colore in un attimo.",
   "zh": "夜间出没，能在瞬间改变颜色。"
  }
 },
 {
  "id": "reef-squid",
  "group": "invertebrate",
  "emoji": "🦑",
  "sci": "Sepioteuthis sepioidea",
  "names": {
   "en": "Caribbean reef squid",
   "es": "Calamar de arrecife"
  },
  "status": "none",
  "habitat": "open",
  "fact": {
   "en": "Hovers in small groups near the surface, watching you back.",
   "es": "Flota en grupos pequeños cerca de la superficie, observándote.",
   "fr": "Flotte en petits groupes près de la surface et vous observe.",
   "de": "Schwebt in kleinen Gruppen nahe der Oberfläche und beobachtet Sie.",
   "pt": "Fica em pequenos grupos perto da superfície, observando você.",
   "it": "Fluttua in piccoli gruppi vicino alla superficie, osservandoti.",
   "zh": "成小群悬停在水面附近，也在观察你。"
  }
 },
 {
  "id": "seahorse",
  "group": "fish",
  "emoji": "🐴",
  "sci": "Hippocampus reidi",
  "names": {
   "en": "Longsnout seahorse",
   "es": "Caballito de mar"
  },
  "status": "none",
  "habitat": "seagrass",
  "fact": {
   "en": "Rare and hard to spot; the male carries the eggs in a pouch.",
   "es": "Raro y difícil de ver; el macho lleva los huevos en una bolsa.",
   "fr": "Rare et discret ; c’est le mâle qui porte les œufs dans une poche.",
   "de": "Selten und schwer zu finden; das Männchen trägt die Eier in einer Tasche.",
   "pt": "Raro e difícil de ver; o macho carrega os ovos numa bolsa.",
   "it": "Raro e difficile da vedere; è il maschio a portare le uova nel marsupio.",
   "zh": "罕见难寻；由雄性在育儿袋中孵卵。"
  }
 },
 {
  "id": "lobster",
  "group": "invertebrate",
  "emoji": "🦞",
  "sci": "Panulirus argus",
  "names": {
   "en": "Caribbean spiny lobster",
   "es": "Langosta espinosa"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Hides in crevices by day — look for antennae sticking out.",
   "es": "Se esconde en grietas de día; busca las antenas que asoman.",
   "fr": "Se cache dans les fissures le jour — cherchez les antennes qui dépassent.",
   "de": "Versteckt sich tagsüber in Spalten – achten Sie auf herausragende Fühler.",
   "pt": "Esconde-se em fendas de dia — procure as antenas para fora.",
   "it": "Di giorno si nasconde nelle fessure: cerca le antenne che spuntano.",
   "zh": "白天藏在缝隙里，留意露出来的触角。"
  }
 },
 {
  "id": "christmas-tree-worm",
  "group": "invertebrate",
  "emoji": "🎄",
  "sci": "Spirobranchus giganteus",
  "names": {
   "en": "Christmas tree worm",
   "es": "Gusano árbol de Navidad"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Colorful spirals that vanish into the coral if you move too close.",
   "es": "Espirales de colores que desaparecen en el coral si te acercas.",
   "fr": "Spirales colorées qui disparaissent dans le corail si vous approchez.",
   "de": "Bunte Spiralen, die bei Annäherung im Korallenstock verschwinden.",
   "pt": "Espirais coloridas que somem no coral se você se aproxima.",
   "it": "Spirali colorate che spariscono nel corallo se ti avvicini.",
   "zh": "彩色螺旋状触手，靠近时会瞬间缩回珊瑚里。"
  }
 },
 {
  "id": "dolphin",
  "group": "mammal",
  "emoji": "🐬",
  "sci": "Tursiops truncatus",
  "names": {
   "en": "Bottlenose dolphin",
   "es": "Delfín nariz de botella"
  },
  "status": "protected",
  "habitat": "open",
  "fact": {
   "en": "Wild pods are sometimes seen from boats; never chase or feed them.",
   "es": "A veces se ven grupos salvajes desde el bote; nunca los persigas ni alimentes.",
   "fr": "On voit parfois des groupes sauvages depuis le bateau ; ne les poursuivez ni ne les nourrissez.",
   "de": "Wilde Gruppen sieht man manchmal vom Boot aus; nie verfolgen oder füttern.",
   "pt": "Grupos selvagens às vezes são vistos do barco; nunca persiga nem alimente.",
   "it": "A volte si vedono gruppi selvatici dalla barca; mai inseguirli o nutrirli.",
   "zh": "有时能从船上看到野生海豚群，切勿追逐或投喂。"
  }
 },
 {
  "id": "elkhorn-coral",
  "group": "coral",
  "emoji": "🪸",
  "sci": "Acropora palmata",
  "names": {
   "en": "Elkhorn coral",
   "es": "Coral cuerno de alce"
  },
  "status": "cr",
  "habitat": "reef",
  "fact": {
   "en": "Once the main reef builder in shallow water; now critically endangered.",
   "es": "Antes era el gran constructor del arrecife somero; hoy está en peligro crítico.",
   "fr": "Autrefois principal bâtisseur des récifs peu profonds ; aujourd’hui en danger critique.",
   "de": "Einst wichtigster Riffbauer im Flachwasser; heute vom Aussterben bedroht.",
   "pt": "Já foi o principal construtor de recifes rasos; hoje criticamente ameaçado.",
   "it": "Un tempo principale costruttore della barriera bassa; oggi in pericolo critico.",
   "zh": "曾是浅水礁的主要建造者，如今极度濒危。"
  }
 },
 {
  "id": "fire-coral",
  "group": "coral",
  "emoji": "🔥",
  "sci": "Millepora alcicornis",
  "names": {
   "en": "Fire coral",
   "es": "Coral de fuego"
  },
  "status": "none",
  "habitat": "reef",
  "fact": {
   "en": "Not a true coral — and it burns if you brush against it.",
   "es": "No es un coral verdadero, y quema si lo rozas.",
   "fr": "Ce n’est pas un vrai corail — et il brûle si on le frôle.",
   "de": "Keine echte Koralle – und sie brennt bei Berührung.",
   "pt": "Não é coral de verdade — e queima se você encostar.",
   "it": "Non è un vero corallo, e brucia se lo sfiori.",
   "zh": "并非真正的珊瑚，轻轻碰到也会灼痛。"
  }
 },
 {
  "id": "barrel-sponge",
  "group": "coral",
  "emoji": "🛢️",
  "sci": "Xestospongia muta",
  "names": {
   "en": "Giant barrel sponge",
   "es": "Esponja barril gigante"
  },
  "status": "none",
  "habitat": "wall",
  "fact": {
   "en": "Can live for hundreds of years and filter huge amounts of water.",
   "es": "Puede vivir cientos de años y filtrar enormes cantidades de agua.",
   "fr": "Peut vivre des centaines d’années et filtrer d’énormes volumes d’eau.",
   "de": "Kann Hunderte Jahre alt werden und riesige Wassermengen filtern.",
   "pt": "Pode viver centenas de anos e filtrar muita água.",
   "it": "Può vivere centinaia di anni e filtrare enormi quantità d’acqua.",
   "zh": "可存活数百年，过滤大量海水。"
  }
 }
];
