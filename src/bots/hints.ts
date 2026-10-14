import { fullDeck } from '../engine/cards';
import { bestHandFor } from '../engine/evaluator';
import { type GameState, legalActions, potTotal, visibleBoard } from '../engine/game';
import { boardTotal } from '../engine/rules';
import { estimateEquity } from './bot';

export type Advice = 'fold' | 'check' | 'call' | 'raise';

export interface Hint {
  /** Šance na výhru 0–1 (null = karty nevidíš). */
  equity: number | null;
  /** Kolik procent banku tvoří dorovnání – tolik musí být šance, aby se dorovnání vyplatilo. */
  potOdds: number;
  /** Karty, které ti na další kartě zlepší kombinaci (jen po flopu). */
  outs: number | null;
  advice: Advice;
  text: string;
}

const pct = (x: number) => Math.round(x * 100) + ' %';

/** Nápověda pro režim tréninku: spočítá šanci, pot odds, outy a doporučí tah. */
export function computeHint(s: GameState, heroId: string, rng: () => number): Hint | null {
  const legal = legalActions(s, heroId);
  if (!legal) return null;
  const me = s.players.find((p) => p.id === heroId)!;
  const rules = s.rules;
  const opponents = s.players.filter((p) => p.inHand && !p.folded && p.id !== heroId).length;
  const pot = potTotal(s);
  const potOdds = legal.callAmount > 0 ? legal.callAmount / (pot + legal.callAmount) : 0;

  if ((rules.hideOwnPreflop && s.street === 'preflop') || !me.hole.length) {
    return {
      equity: null,
      potOdds,
      outs: null,
      advice: legal.canCheck ? 'check' : 'fold',
      text: me.hole.length ? 'Hraješ naslepo – bez znalosti karet je nejlevnější check, jinak spíš fold.' : 'Zatím nemáš karty v ruce – sázka je čistý odhad.',
    };
  }

  const cards = (rules.holeSchedule ? rules.holeSchedule[rules.holeSchedule.length - 1] : rules.holeCards) + boardTotal(rules);
  const cost = rules.omaha ? 3 : cards > 9 ? 10 : cards > 7 ? 3 : 1;
  const iterations = Math.max(cost >= 10 ? 40 : 150, Math.floor(900 / Math.max(1, Math.ceil(opponents / 2)) / cost));
  const board = visibleBoard(s);
  const simOpp = cost >= 10 ? Math.min(opponents, 2) : opponents;
  const raw = rules.splitAll ? 1 / (opponents + 1) : estimateEquity(me.hole, board, simOpp, iterations, rng, rules);
  const equity = rules.splitAll || simOpp === opponents ? raw : Math.pow(raw, opponents / simOpp);

  // Outy: neviděné karty, které na další kartě zlepší kombinaci.
  let outs: number | null = null;
  if (board.length >= 3 && board.length < boardTotal(rules) && !rules.hiddenBoard.length) {
    const cur = bestHandFor(me.hole, board, rules);
    const seen = new Set([...me.hole, ...board].map((c) => c.r + c.s));
    outs = 0;
    for (const c of fullDeck()) {
      if (seen.has(c.r + c.s) || (rules.shortDeck && c.r < 6)) continue;
      const next = bestHandFor(me.hole, [...board, c], rules);
      if (next.cat !== cur.cat && next.strength > cur.strength) outs++;
    }
  }

  const fair = 1 / (opponents + 1);
  let advice: Advice;
  let text: string;
  if (legal.canRaise && equity > Math.max(0.55, fair * 1.8)) {
    advice = 'raise';
    text = `Silná ruka: vyhraješ asi v ${pct(equity)} případů proti ${opponents} ${opponents === 1 ? 'soupeři' : 'soupeřům'}. Navyš a nech je platit.`;
  } else if (legal.canCheck) {
    advice = 'check';
    text = `Check je zadarmo. Šance ${pct(equity)} na sázení nestačí, ale další karta nic nestojí.`;
  } else if (equity >= potOdds) {
    advice = 'call';
    text = `Dorovnání se vyplatí: potřebuješ aspoň ${pct(potOdds)}, máš asi ${pct(equity)}.`;
  } else {
    advice = 'fold';
    text = `Na dorovnání potřebuješ aspoň ${pct(potOdds)}, ale máš jen asi ${pct(equity)}. Slož.`;
  }
  return { equity, potOdds, outs, advice, text };
}
