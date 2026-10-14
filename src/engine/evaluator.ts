import type { Card } from './cards';

export const HAND_NAMES = [
  'Nejvyšší karta',
  'Pár',
  'Dva páry',
  'Trojice',
  'Postupka',
  'Barva',
  'Full house',
  'Poker',
  'Postupka v barvě',
  'Královská postupka',
] as const;

export const CAT = {
  HIGH: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
} as const;

export interface HandValue {
  /** Kategorie 0–9, viz HAND_NAMES. */
  cat: number;
  /** Rozhodující hodnoty pro remízy, od nejdůležitější. */
  ranks: number[];
  /** Karty ruky v pořadí pro zobrazení: nejdřív ty, které tvoří kombinaci. */
  cards: Card[];
  /** Kolik prvních karet z `cards` kombinaci tvoří (zbytek jsou kickery). */
  counted: number;
  /** Síla podle běžných pravidel: větší = silnější. */
  score: number;
  /** Síla podle pravidel ruky (Game Changer); bez nich = score. Porovnává se tímto. */
  strength: number;
}

/** Co z pravidel ruky ovlivňuje vyhodnocení. */
export interface EvalRules {
  catRank?: number[] | null;
  lowball?: boolean;
  ignoreSuits?: boolean;
  omaha?: boolean;
  /** Eso má hodnotu 1 (nejnižší karta). */
  aceLow?: boolean;
}

const lowAce = (cards: Card[]) => cards.map((c) => (c.r === 14 ? { r: 1, s: c.s } : c));

const CAT_UNIT = 15 ** 5;

export function strengthOf(v: { cat: number; score: number }, r?: EvalRules): number {
  let s = v.score;
  if (r?.catRank) s = r.catRank[v.cat] * CAT_UNIT + (v.score - v.cat * CAT_UNIT);
  if (r?.lowball) s = -s;
  return s;
}

const COUNTED_BY_CAT = [1, 2, 4, 3, 5, 5, 5, 4, 5, 5];

function scoreOf(cat: number, ranks: number[]): number {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (ranks[i] ?? 0);
  return s;
}

/** Ohodnotí 1–5 karet (méně než 5 jen podle shod – pro náhled před flopem). */
export function evaluate5(cards: Card[], ignoreSuits = false): HandValue {
  const n = cards.length;
  const byRank = new Map<number, Card[]>();
  for (const c of cards) {
    const g = byRank.get(c.r);
    if (g) g.push(c);
    else byRank.set(c.r, [c]);
  }
  const groups = [...byRank.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);
  const desc = cards.slice().sort((a, b) => b.r - a.r);

  const flush = !ignoreSuits && n === 5 && cards.every((c) => c.s === cards[0].s);
  let straightHigh = 0;
  if (n === 5 && groups.length === 5) {
    if (desc[0].r - desc[4].r === 4) straightHigh = desc[0].r;
    else if (desc[0].r === 14 && desc[1].r === 5) straightHigh = 5; // A-2-3-4-5
  }

  let cat: number;
  let ranks: number[];
  let ordered: Card[];

  if (straightHigh) {
    cat = flush ? (straightHigh === 14 ? CAT.ROYAL_FLUSH : CAT.STRAIGHT_FLUSH) : CAT.STRAIGHT;
    ranks = [straightHigh];
    ordered = straightHigh === 5 ? [...desc.slice(1), desc[0]] : desc;
  } else {
    ordered = groups.flatMap(([, g]) => g);
    const sizes = groups.map(([, g]) => g.length);
    const gr = groups.map(([r]) => r);
    if (sizes[0] === 4) {
      cat = CAT.QUADS;
      ranks = gr;
    } else if (sizes[0] === 3 && sizes[1] >= 2) {
      cat = CAT.FULL_HOUSE;
      ranks = gr;
    } else if (flush) {
      cat = CAT.FLUSH;
      ranks = desc.map((c) => c.r);
      ordered = desc;
    } else if (sizes[0] === 3) {
      cat = CAT.TRIPS;
      ranks = gr;
    } else if (sizes[0] === 2 && sizes[1] === 2) {
      cat = CAT.TWO_PAIR;
      ranks = gr;
    } else if (sizes[0] === 2) {
      cat = CAT.PAIR;
      ranks = gr;
    } else {
      cat = CAT.HIGH;
      ranks = gr;
    }
  }

  const score = scoreOf(cat, ranks);
  return {
    cat,
    ranks,
    cards: ordered,
    counted: Math.min(COUNTED_BY_CAT[cat], n),
    score,
    strength: score,
  };
}

function withStrength(v: HandValue, r?: EvalRules): HandValue {
  if (!r?.catRank && !r?.lowball) return v;
  return { ...v, strength: strengthOf(v, r) };
}

/** Nejlepší ruka z libovolného počtu karet (5 z N) podle pravidel ruky. */
export function bestHand(cards: Card[], r?: EvalRules): HandValue {
  const ignore = !!r?.ignoreSuits;
  if (cards.length <= 5) return withStrength(evaluate5(cards, ignore), r);
  let best: HandValue | null = null;
  const n = cards.length;
  const pick: Card[] = new Array(5);
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            pick[0] = cards[a];
            pick[1] = cards[b];
            pick[2] = cards[c];
            pick[3] = cards[d];
            pick[4] = cards[e];
            const v = withStrength(evaluate5(pick, ignore), r);
            if (!best || v.strength > best.strength) best = v;
          }
  return best!;
}

/** Nejlepší ruka hráče: karty v ruce + na stole (Omaha = přesně 2 z ruky a 3 ze stolu). */
export function bestHandFor(hole: Card[], board: Card[], r?: EvalRules): HandValue {
  if (r?.aceLow) return bestHandFor(lowAce(hole), lowAce(board), { ...r, aceLow: false });
  if (!hole.length && !board.length) return { cat: 0, ranks: [], cards: [], counted: 0, score: -1, strength: -1 };
  if (!r?.omaha || board.length < 3 || hole.length < 2) {
    if (r?.omaha && board.length < 3) return bestHand(hole, r);
    return bestHand([...hole, ...board], r);
  }
  let best: HandValue | null = null;
  for (let i = 0; i < hole.length; i++)
    for (let j = i + 1; j < hole.length; j++)
      for (let a = 0; a < board.length; a++)
        for (let b = a + 1; b < board.length; b++)
          for (let c = b + 1; c < board.length; c++) {
            const v = withStrength(evaluate5([hole[i], hole[j], board[a], board[b], board[c]], !!r.ignoreSuits), r);
            if (!best || v.strength > best.strength) best = v;
          }
  return best!;
}

/** Krátký popis ruky, např. „Trojice králů“, „Postupka do 9“. */
export function describeHand(h: HandValue): string {
  const plural: Record<number, string> = {
    14: 'es',
    13: 'králů',
    12: 'dam',
    11: 'kluků',
    10: 'desítek',
    9: 'devítek',
    8: 'osmiček',
    7: 'sedmiček',
    6: 'šestek',
    5: 'pětek',
    4: 'čtyřek',
    3: 'trojek',
    2: 'dvojek',
  };
  const name = (r: number) => (r === 14 ? 'es' : plural[r]);
  const label = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));
  switch (h.cat) {
    case CAT.HIGH:
      return 'Nejvyšší karta ' + label(h.ranks[0]);
    case CAT.PAIR:
      return 'Pár ' + name(h.ranks[0]);
    case CAT.TWO_PAIR:
      return 'Dva páry, ' + label(h.ranks[0]) + ' a ' + label(h.ranks[1]);
    case CAT.TRIPS:
      return 'Trojice ' + name(h.ranks[0]);
    case CAT.STRAIGHT:
      return 'Postupka do ' + label(h.ranks[0]);
    case CAT.FLUSH:
      return 'Barva, nejvyšší ' + label(h.ranks[0]);
    case CAT.FULL_HOUSE:
      return 'Full house, ' + label(h.ranks[0]) + ' na ' + label(h.ranks[1]);
    case CAT.QUADS:
      return 'Poker ' + name(h.ranks[0]);
    case CAT.STRAIGHT_FLUSH:
      return 'Postupka v barvě do ' + label(h.ranks[0]);
    default:
      return 'Královská postupka';
  }
}
