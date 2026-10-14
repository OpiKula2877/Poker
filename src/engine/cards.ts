export type Suit = 's' | 'h' | 'd' | 'c';

/** Hodnota karty: 2–10, 11 = J, 12 = Q, 13 = K, 14 = A. */
export interface Card {
  r: number;
  s: Suit;
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// Variation selector 15 drží symboly jako text, ne jako emoji.
export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠︎',
  h: '♥︎',
  d: '♦︎',
  c: '♣︎',
};

export const SUIT_NAME: Record<Suit, string> = { s: 'piky', h: 'srdce', d: 'káry', c: 'kříže' };

export function rankLabel(r: number): string {
  if (r === 14 || r === 1) return 'A';
  if (r === 13) return 'K';
  if (r === 12) return 'Q';
  if (r === 11) return 'J';
  return String(r);
}

export function isRed(c: Card): boolean {
  return c.s === 'h' || c.s === 'd';
}

export function cardId(c: Card): string {
  return rankLabel(c.r) + c.s;
}

export function cardText(c: Card): string {
  return rankLabel(c.r) + SUIT_SYMBOL[c.s];
}

/** Parsuje zápis jako "As", "Td", "10h", "9c" (hlavně pro testy). */
export function parseCard(text: string): Card {
  const s = text.slice(-1) as Suit;
  const rt = text.slice(0, -1).toUpperCase();
  const map: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
  const r = map[rt] ?? Number(rt);
  if (!SUITS.includes(s) || !(r >= 2 && r <= 14)) throw new Error('Neplatná karta: ' + text);
  return { r, s };
}

export function parseCards(text: string): Card[] {
  return text.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  return deck;
}

/** Seedovaný generátor (mulberry32) – stejná sada čísel na každém zařízení. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates; vrací novou zamíchanou kopii. */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Kryptografická náhoda v rozsahu [0, 1) – pro míchání ve skutečné hře. */
export function cryptoRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}
