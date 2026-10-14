import { type Card, fullDeck } from '../engine/cards';
import { bestHand } from '../engine/evaluator';
import { type Action, type GameState, currentBlinds, legalActions, potTotal } from '../engine/game';

export const BOT_LEVEL_NAMES = ['Lehký', 'Střední', 'Těžký'];

/** Monte Carlo odhad šance na výhru (remíza se počítá podílem). */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  iterations: number,
  rng: () => number,
): number {
  if (opponents <= 0) return 1;
  const known = new Set([...hole, ...board].map((c) => c.r * 4 + 'shdc'.indexOf(c.s)));
  const rest = fullDeck().filter((c) => !known.has(c.r * 4 + 'shdc'.indexOf(c.s)));
  const need = 5 - board.length + opponents * 2;
  let total = 0;
  for (let it = 0; it < iterations; it++) {
    // částečné zamíchání: stačí prvních `need` karet
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i));
      const t = rest[i];
      rest[i] = rest[j];
      rest[j] = t;
    }
    let k = 0;
    const fullBoard = board.slice();
    while (fullBoard.length < 5) fullBoard.push(rest[k++]);
    const mine = bestHand([...hole, ...fullBoard]).score;
    let best = true;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const score = bestHand([rest[k++], rest[k++], ...fullBoard]).score;
      if (score > mine) {
        best = false;
        break;
      }
      if (score === mine) ties++;
    }
    if (best) total += 1 / (ties + 1);
  }
  return total / iterations;
}

const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

/** Rozhodnutí bota. Level 0 = lehký, 1 = střední, 2 = těžký. */
export function decideBotAction(s: GameState, id: string, rng: () => number): Action {
  const legal = legalActions(s, id);
  if (!legal) return { type: 'check' };
  const me = s.players.find((p) => p.id === id)!;
  const level = me.botLevel;
  // Před flopem se počítá hlavně s těmi, kdo už do hry vstoupili; kdo ještě nehrál, většinou složí.
  const others = s.players.filter((p) => p.inHand && !p.folded && p.id !== id);
  let opponents = others.length;
  if (s.street === 'preflop') {
    const entered = others.filter((p) => p.lastAction && !/^(SB|BB) /.test(p.lastAction)).length;
    opponents = Math.max(1, Math.min(others.length, entered + Math.ceil((others.length - entered) * 0.3)));
  }
  const iterBase = [120, 250, 450][level] ?? 250;
  const iterations = Math.max(60, Math.floor(iterBase / Math.max(1, Math.ceil(opponents / 2))));

  let eq = estimateEquity(me.hole, s.board, opponents, iterations, rng);
  const noise = [0.12, 0.05, 0.02][level] ?? 0.05;
  eq = Math.min(1, Math.max(0, eq + (rng() * 2 - 1) * noise));

  const fair = 1 / (opponents + 1);
  const pot = potTotal(s);
  const bb = currentBlinds(s).bb;
  const stackBb = me.stack / bb;
  const potOdds = legal.callAmount / (pot + legal.callAmount || 1);

  const strong = eq > Math.min(0.88, fair * ([2.6, 2.0, 1.8][level] ?? 2));
  const good = eq > Math.min(0.75, fair * ([1.8, 1.4, 1.3][level] ?? 1.4));
  const callMargin = [-0.1, 0.0, 0.03][level] ?? 0;
  const bluff = level === 2 && opponents <= 2 && rng() < 0.08;

  const raiseTo = (fraction: number): Action => {
    const target = legal.currentBet + Math.max(legal.minRaiseTo - legal.currentBet, (pot + legal.callAmount) * fraction);
    const to = Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, roundTo(target, Math.max(1, bb / 2))));
    return to >= legal.maxRaiseTo ? { type: 'allin' } : { type: 'raise', to };
  };

  // Krátký stack: all in nebo fold.
  if (stackBb <= 10 && legal.canRaise) {
    if (eq > fair * 1.3) return { type: 'allin' };
    return legal.canCheck ? { type: 'check' } : { type: 'fold' };
  }

  if (legal.canCheck) {
    if (legal.canRaise && (strong || (good && rng() < 0.45) || bluff)) {
      return raiseTo(strong ? 0.5 + rng() * 0.4 : 0.4 + rng() * 0.2);
    }
    return { type: 'check' };
  }

  if (legal.canRaise && (strong && rng() < (level === 0 ? 0.35 : 0.7))) {
    return raiseTo(0.7 + rng() * 0.5);
  }
  if (eq >= potOdds + callMargin || (good && legal.callAmount <= bb * 2)) {
    return { type: 'call' };
  }
  if (bluff && legal.canRaise) return raiseTo(0.6);
  return { type: 'fold' };
}
