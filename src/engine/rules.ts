/**
 * Pravidla jedné ruky. Výchozí = klasický No Limit Texas Hold'em;
 * Game Changer karty je na jednu ruku mění.
 */
export type BettingKind = 'nl' | 'limit' | 'pot' | 'pushfold';

export interface RoundRules {
  /** Aktivní Game Changer karta (null = žádná). */
  eventId: string | null;
  holeCards: number;
  /** Kolik společných karet se celkem rozdá (3 = jen flop, 6 = river dvakrát). */
  boardCards: number;
  /** Omaha: z ruky musí být použity přesně 2 karty. */
  omaha: boolean;
  /** Síla každé kategorie (index = kategorie 0–9); null = běžné pořadí. */
  catRank: number[] | null;
  /** Vyhrává nejslabší ruka. */
  lowball: boolean;
  /** Barvy se nepočítají (barva ani postupka v barvě neexistují). */
  ignoreSuits: boolean;
  /** Balíček bez 2–5. */
  shortDeck: boolean;
  blindMult: number;
  /** Ante navíc pro všechny, v násobcích big blindu. */
  anteBb: number;
  /** Vlastní karty se ukážou až po flopu. */
  hideOwnPreflop: boolean;
  /** První karta každého hráče je vidět všem. */
  revealFirst: boolean;
  betting: BettingKind;
  /** Čas na tah pro tuto ruku (null = podle nastavení). */
  turnSeconds: number | null;

  // --- rozšíření pro další Game Changer karty ---
  /** Kolik karet leží na stole po každém kole (index 0 = před prvním sázením). null = podle boardCards. */
  boardSchedule: number[] | null;
  /** Kolik karet má hráč v ruce po každém kole (index 0 = na začátku). null = vše hned (holeCards). */
  holeSchedule: number[] | null;
  /** Každý hráč dostane náhodně 1–4 karty. */
  roulette: boolean;
  /** Indexy karet na stole, které leží rubem až do showdownu. */
  hiddenBoard: number[];
  /** Všechny karty všech hráčů jsou vidět všem. */
  openHands: boolean;
  /** Draw: po prvním sázení si každý může vyměnit až 2 karty. */
  draw: boolean;
  /** Před flopem si hráč může za 1 BB dokoupit kartu. */
  buyCard: boolean;
  /** Vítěz dostane 1 BB od každého, kdo byl v ruce. */
  bounty: boolean;
  /** Index karty na stole, která je jackpot (null = žádná). */
  jackpotIndex: number | null;
  /** Bank se dělí rovným dílem mezi všechny, kdo nesložili. */
  splitAll: boolean;
  /** Hrají jen small a big blind, ostatní složí. */
  blindsOnly: boolean;
  /** Kdo má méně než 5 BB, jde povinně all in. */
  hungry: boolean;
  /** Dealerem je hráč s nejmenším stackem. */
  poorDealer: boolean;
  /** Eso má hodnotu 1. */
  aceLow: boolean;
  /** Vizuální: tma – soupeři a sázky nejsou vidět. */
  dark: boolean;
  /** Vizuální: zemětřesení. */
  quake: boolean;
  /** Sázky a bank ostatních nejsou vidět. */
  hiddenBets: boolean;
  /** Černá kočka: id karty, kterou má někdo v ruce (null = žádná). */
  catCard: string | null;
  /** Déjà vu: na konci se rozdá druhý stůl a bank se dělí na poloviny. */
  runTwice: boolean;
}

export const DEFAULT_RULES: RoundRules = {
  eventId: null,
  holeCards: 2,
  boardCards: 5,
  omaha: false,
  catRank: null,
  lowball: false,
  ignoreSuits: false,
  shortDeck: false,
  blindMult: 1,
  anteBb: 0,
  hideOwnPreflop: false,
  revealFirst: false,
  betting: 'nl',
  turnSeconds: null,
  boardSchedule: null,
  holeSchedule: null,
  roulette: false,
  hiddenBoard: [],
  openHands: false,
  draw: false,
  buyCard: false,
  bounty: false,
  jackpotIndex: null,
  splitAll: false,
  blindsOnly: false,
  hungry: false,
  poorDealer: false,
  aceLow: false,
  dark: false,
  quake: false,
  hiddenBets: false,
  catCard: null,
  runTwice: false,
};

/** Počty karet na stole po jednotlivých kolech sázení. */
export function boardScheduleOf(r: RoundRules): number[] {
  if (r.boardSchedule) return r.boardSchedule;
  if (r.boardCards <= 3) return [0, 3];
  if (r.boardCards === 4) return [0, 3, 4];
  return [0, 3, 4, r.boardCards];
}

/** Konečný počet karet na stole. */
export function boardTotal(r: RoundRules): number {
  const s = boardScheduleOf(r);
  return s[s.length - 1];
}

/** Síla kategorií jako pořadí v přehledu (0 = nejslabší) – pro zobrazení. */
export function categoryOrder(r: RoundRules): number[] {
  const cats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const strength = (c: number) => (r.catRank ? r.catRank[c] : c) * (r.lowball ? -1 : 1);
  return cats.sort((a, b) => strength(a) - strength(b));
}
