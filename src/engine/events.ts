import { DEFAULT_RULES, type RoundRules } from './rules';
import { shuffle } from './cards';

export type Rarity = 'common' | 'rare' | 'legendary' | 'exotic';

export interface GameEvent {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  /** Úprava pravidel pro tuto ruku. */
  apply?: (r: RoundRules, rng: () => number) => RoundRules;
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 5, legendary: 1.5, exotic: 0.6 };
export const RARITY_NAME: Record<Rarity, string> = { common: 'běžná', rare: 'vzácná', legendary: 'legendární', exotic: 'exotická' };

/** 20 Game Changer karet. Každá platí jen pro jednu ruku. */
export const EVENTS: GameEvent[] = [
  // --- běžné ---
  {
    id: 'reverse',
    name: 'Obrácené pořadí',
    desc: 'Nejslabší kombinace vyhrává: nejvyšší karta poráží pár, pár dva páry… Ve stejné kombinaci dál vyhrává vyšší.',
    rarity: 'common',
    apply: (r) => ({ ...r, catRank: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] }),
  },
  {
    id: 'pairKing',
    name: 'Pár je král',
    desc: 'Pár je nejsilnější ruka ze všech. Ostatní kombinace platí jako obvykle.',
    rarity: 'common',
    apply: (r) => ({ ...r, catRank: [0, 10, 2, 3, 4, 5, 6, 7, 8, 9] }),
  },
  {
    id: 'sixth',
    name: 'Šestá karta',
    desc: 'Na stole bude 6 společných karet – river přijde dvakrát.',
    rarity: 'common',
    apply: (r) => ({ ...r, boardCards: 6 }),
  },
  {
    id: 'threeHole',
    name: 'Tři do ruky',
    desc: 'Každý dostane 3 karty. Počítá se nejlepších 5 z osmi.',
    rarity: 'common',
    apply: (r) => ({ ...r, holeCards: 3 }),
  },
  {
    id: 'doubleBlinds',
    name: 'Dvojité blindy',
    desc: 'Small a big blind jsou v této ruce dvojnásobné.',
    rarity: 'common',
    apply: (r) => ({ ...r, blindMult: 2 }),
  },
  {
    id: 'anteAll',
    name: 'Ante pro všechny',
    desc: 'Každý dá do banku 1 big blind ještě před rozdáním.',
    rarity: 'common',
    apply: (r) => ({ ...r, anteBb: 1 }),
  },
  {
    id: 'lightning',
    name: 'Bleskové kolo',
    desc: 'Na každý tah je jen 7 sekund.',
    rarity: 'common',
    apply: (r) => ({ ...r, turnSeconds: 7 }),
  },
  {
    id: 'flopOnly',
    name: 'Jen flop',
    desc: 'Turn ani river nepřijdou. Po flopu se rovnou vyhodnocuje.',
    rarity: 'common',
    apply: (r) => ({ ...r, boardCards: 3 }),
  },
  {
    id: 'revealOne',
    name: 'Odhalená karta',
    desc: 'Každému hráči se otočí jedna karta pro všechny.',
    rarity: 'common',
    apply: (r) => ({ ...r, revealFirst: true }),
  },
  {
    id: 'noSuits',
    name: 'Bez barev',
    desc: 'Barvy se nepočítají: barva ani postupka v barvě neplatí. Postupka ano.',
    rarity: 'common',
    apply: (r) => ({ ...r, ignoreSuits: true }),
  },
  // --- vzácné ---
  {
    id: 'shuffledOrder',
    name: 'Přeházené pořadí',
    desc: 'Pořadí kombinací se náhodně zamíchá. Nové pořadí ukazuje panel vpravo dole.',
    rarity: 'rare',
    apply: (r, rng) => ({ ...r, catRank: shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], rng) }),
  },
  {
    id: 'lowball',
    name: 'Nejnižší bere',
    desc: 'Vyhrává nejslabší ruka. Páry, postupky i barvy škodí.',
    rarity: 'rare',
    apply: (r) => ({ ...r, lowball: true }),
  },
  {
    id: 'omaha',
    name: 'Omaha kolo',
    desc: '4 karty do ruky. Musíš použít přesně 2 z ruky a 3 ze stolu.',
    rarity: 'rare',
    apply: (r) => ({ ...r, holeCards: 4, omaha: true }),
  },
  {
    id: 'shortDeck',
    name: 'Krátký balíček',
    desc: 'Hraje se bez dvojek až pětek. Barva poráží full house.',
    rarity: 'rare',
    apply: (r) => ({ ...r, shortDeck: true, catRank: [0, 1, 2, 3, 4, 6, 5, 7, 8, 9] }),
  },
  {
    id: 'limit',
    name: 'Limit kolo',
    desc: 'Sázet a navyšovat jde jen o 1 big blind, nejvýš 3 navýšení v každém kole.',
    rarity: 'rare',
    apply: (r) => ({ ...r, betting: 'limit' }),
  },
  {
    id: 'potLimit',
    name: 'Pot limit',
    desc: 'Navýšit jde nejvýš o velikost banku.',
    rarity: 'rare',
    apply: (r) => ({ ...r, betting: 'pot' }),
  },
  {
    id: 'blind',
    name: 'Naslepo',
    desc: 'Svoje karty uvidíš až po flopu.',
    rarity: 'rare',
    apply: (r) => ({ ...r, hideOwnPreflop: true }),
  },
  {
    id: 'pushFold',
    name: 'All in nebo fold',
    desc: 'Každá sázka je all in. Jinak jde jen checknout, dorovnat, nebo složit.',
    rarity: 'rare',
    apply: (r) => ({ ...r, betting: 'pushfold' }),
  },
  // --- legendární ---
  {
    id: 'swapTwo',
    name: 'Výměna balancí',
    desc: 'Dva náhodní hráči si prohodí všechny žetony.',
    rarity: 'legendary',
  },
  {
    id: 'shuffleAll',
    name: 'Velké míchání',
    desc: 'Žetony všech hráčů ve hře se náhodně přehází mezi ně.',
    rarity: 'legendary',
  },

  // ===== druhá série =====
  // --- běžné ---
  {
    id: 'hiddenBets',
    name: 'Skryté sázky',
    desc: 'Sázky soupeřů ani bank nejsou vidět. Co kdo vsadil, se ukáže až po ruce.',
    rarity: 'common',
    apply: (r) => ({ ...r, hiddenBets: true }),
  },
  {
    id: 'aceLow',
    name: 'Eso dolů',
    desc: 'Eso je nejnižší karta (jednička). Postupka do esa neplatí, A-2-3-4-5 ano.',
    rarity: 'common',
    apply: (r) => ({ ...r, aceLow: true }),
  },
  {
    id: 'poorDealer',
    name: 'Špatný dealer',
    desc: 'Dealerem je hráč s nejmenším počtem žetonů – má nejlepší pozici.',
    rarity: 'common',
    apply: (r) => ({ ...r, poorDealer: true }),
  },
  // --- vzácné ---
  {
    id: 'hiddenRiver',
    name: 'Skrytá river',
    desc: 'River leží rubem. Jakou kartu měla, se ukáže až při vyhodnocení.',
    rarity: 'rare',
    apply: (r) => ({ ...r, hiddenBoard: [4] }),
  },
  {
    id: 'draw',
    name: 'Draw poker',
    desc: 'Po prvním kole sázení si každý může vyměnit až 2 karty z ruky za nové.',
    rarity: 'rare',
    apply: (r) => ({ ...r, draw: true }),
  },
  {
    id: 'bounty',
    name: 'Bounty',
    desc: 'Vítěz ruky dostane navíc 1 BB od každého, kdo byl v ruce.',
    rarity: 'rare',
    apply: (r) => ({ ...r, bounty: true }),
  },
  {
    id: 'quickFlop',
    name: 'Rychlý flop',
    desc: 'Flop leží na stole hned od začátku – sází se rovnou nad třemi kartami.',
    rarity: 'rare',
    apply: (r) => ({ ...r, boardSchedule: [3, 4, 5] }),
  },
  {
    id: 'buyCard',
    name: 'Dokup kartu',
    desc: 'Před flopem si můžeš jednou za ruku dokoupit kartu do ruky za 1 BB.',
    rarity: 'rare',
    apply: (r) => ({ ...r, buyCard: true }),
  },
  {
    id: 'roulette',
    name: 'Ruleta karet',
    desc: 'Každý dostane náhodně 1 až 4 karty – každý jiný počet.',
    rarity: 'rare',
    apply: (r) => ({ ...r, roulette: true }),
  },
  {
    id: 'hungry',
    name: 'Hladovka',
    desc: 'Kdo má méně než 5 big blindů, jde hned povinně all in.',
    rarity: 'rare',
    apply: (r) => ({ ...r, hungry: true }),
  },
  {
    id: 'splitAll',
    name: 'Zrcadlový pot',
    desc: 'Na kartách nezáleží: bank se rozdělí rovným dílem mezi všechny, kdo nesložili.',
    rarity: 'rare',
    apply: (r) => ({ ...r, splitAll: true }),
  },
  {
    id: 'blindsOnly',
    name: 'Hra pro dva',
    desc: 'Hrají jen small a big blind. Všichni ostatní tuhle ruku automaticky složí.',
    rarity: 'rare',
    apply: (r) => ({ ...r, blindsOnly: true }),
  },
  // --- legendární ---
  {
    id: 'reverseDeal',
    name: 'Obrácené rozdávání',
    desc: 'Na začátku jsou 2 karty na stole a nikdo nemá nic v ruce. Po sázení přijdou do ruky 3 karty, pak 1 a ještě 1; stůl se dorozdá do 5.',
    rarity: 'legendary',
    apply: (r) => ({ ...r, boardSchedule: [2, 3, 4, 5], holeSchedule: [0, 3, 4, 5], holeCards: 5 }),
  },
  {
    id: 'tenBoard',
    name: 'Deset karet',
    desc: 'Na stole bude 10 společných karet, rozdávají se po sázení: 3, 5, 7 a 10.',
    rarity: 'legendary',
    apply: (r) => ({ ...r, boardSchedule: [0, 3, 5, 7, 10], boardCards: 10 }),
  },
  {
    id: 'openHands',
    name: 'Otevřené karty',
    desc: 'Všichni vidí karty všech. Hraje se na otevřeno – blufovat jde jen sázkou.',
    rarity: 'legendary',
    apply: (r) => ({ ...r, openHands: true }),
  },
  {
    id: 'quake',
    name: 'Zemětřesení',
    desc: 'Stolem otřese zemětřesení a karty se rozsypou. Pravidla platí jako obvykle – jen to tak nevypadá.',
    rarity: 'legendary',
    apply: (r) => ({ ...r, quake: true }),
  },
  {
    id: 'jackpot',
    name: 'Jackpot',
    desc: 'Jedna karta na stole je jackpot. Kdo vyhraje s kombinací, ve které je, dostane od každého hráče u stolu 1 BB.',
    rarity: 'legendary',
    apply: (r, rng) => ({ ...r, jackpotIndex: Math.floor(rng() * 5) }),
  },
  {
    id: 'dark',
    name: 'Tma',
    desc: 'Zhasla světla. Nevidíš žetony ani sázky soupeřů, jen svoje karty a stůl.',
    rarity: 'legendary',
    apply: (r) => ({ ...r, dark: true, hiddenBets: true }),
  },
  // --- exotické ---
  {
    id: 'dejaVu',
    name: 'Déjà vu',
    desc: 'Při vyhodnocení se rozdá druhý, úplně nový stůl. Polovinu banku bere nejlepší ruka na prvním stole, druhou na druhém.',
    rarity: 'exotic',
    apply: (r) => ({ ...r, runTwice: true }),
  },
  {
    id: 'blackCat',
    name: 'Černá kočka',
    desc: 'Jedna karta v něčí ruce je černá kočka. Kdo ji má, platí hned 2 BB do banku – a všichni ví, kdo to je.',
    rarity: 'exotic',
    apply: (r) => ({ ...r, catCard: '?' }),
  },
];

export function eventById(id: string | null): GameEvent | undefined {
  return id ? EVENTS.find((e) => e.id === id) : undefined;
}

/** Vylosuje kartu podle vzácnosti; `chance` = pravděpodobnost, že ruka nějakou kartu má. */
export function drawEvent(rng: () => number, chance: number, allowed?: string[]): GameEvent | null {
  if (rng() >= chance) return null;
  const pool = EVENTS.filter((e) => !allowed || allowed.includes(e.id));
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + RARITY_WEIGHT[e.rarity], 0);
  let x = rng() * total;
  for (const e of pool) {
    x -= RARITY_WEIGHT[e.rarity];
    if (x <= 0) return e;
  }
  return pool[pool.length - 1];
}

export function rulesForEvent(e: GameEvent | null, rng: () => number): RoundRules {
  const base = { ...DEFAULT_RULES, eventId: e?.id ?? null };
  return e?.apply ? e.apply(base, rng) : base;
}
