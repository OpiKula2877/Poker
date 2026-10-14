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
};

/** Síla kategorií jako pořadí v přehledu (0 = nejslabší) – pro zobrazení. */
export function categoryOrder(r: RoundRules): number[] {
  const cats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const strength = (c: number) => (r.catRank ? r.catRank[c] : c) * (r.lowball ? -1 : 1);
  return cats.sort((a, b) => strength(a) - strength(b));
}
