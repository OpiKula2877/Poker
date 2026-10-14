export interface Contribution {
  id: string;
  committed: number;
  folded: boolean;
}

export interface Pot {
  amount: number;
  /** Kdo o tento bank hraje (nesložení hráči, kteří do něj dali celou úroveň). */
  eligible: string[];
}

/**
 * Rozdělí vklady na hlavní a vedlejší banky.
 * Složení hráči do banků přispívají, ale nemohou je vyhrát.
 */
export function computePots(players: Contribution[]): Pot[] {
  const levels = [...new Set(players.filter((p) => !p.folded && p.committed > 0).map((p) => p.committed))].sort(
    (a, b) => a - b,
  );
  const pots: Pot[] = [];
  let prev = 0;
  for (const lvl of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.committed, lvl) - prev);
    const eligible = players.filter((p) => !p.folded && p.committed >= lvl).map((p) => p.id);
    if (amount > 0) {
      const last = pots[pots.length - 1];
      // Stejná skupina hráčů = jeden bank.
      if (last && last.eligible.length === eligible.length && last.eligible.every((id) => eligible.includes(id))) {
        last.amount += amount;
      } else {
        pots.push({ amount, eligible });
      }
    }
    prev = lvl;
  }
  // Vklady složených hráčů nad nejvyšší úrovní (vzácné) připadnou poslednímu banku.
  const total = players.reduce((s, p) => s + p.committed, 0);
  const counted = pots.reduce((s, p) => s + p.amount, 0);
  if (total > counted) {
    if (pots.length) pots[pots.length - 1].amount += total - counted;
    else pots.push({ amount: total - counted, eligible: players.filter((p) => !p.folded).map((p) => p.id) });
  }
  return pots;
}

export interface PotResult {
  amount: number;
  winners: string[];
}

/**
 * Rozdá banky podle síly rukou. `order` = hráči v pořadí od dealera doleva;
 * zbylý nedělitelný žeton dostane první vítěz v tomto pořadí.
 */
export function awardPots(
  pots: Pot[],
  scores: Map<string, number>,
  order: string[],
): { won: Map<string, number>; results: PotResult[] } {
  const won = new Map<string, number>();
  const results: PotResult[] = [];
  for (const pot of pots) {
    const contenders = pot.eligible.filter((id) => scores.has(id));
    if (!contenders.length) continue;
    const best = Math.max(...contenders.map((id) => scores.get(id)!));
    const winners = contenders
      .filter((id) => scores.get(id) === best)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const share = Math.floor(pot.amount / winners.length);
    let rest = pot.amount - share * winners.length;
    for (const w of winners) {
      const extra = rest > 0 ? 1 : 0;
      rest -= extra;
      won.set(w, (won.get(w) ?? 0) + share + extra);
    }
    results.push({ amount: pot.amount, winners });
  }
  return { won, results };
}
