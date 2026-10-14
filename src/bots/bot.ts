import { type Card, fullDeck } from '../engine/cards';
import { bestHandFor } from '../engine/evaluator';
import { type Action, type GameState, legalActions, potTotal, visibleBoard } from '../engine/game';
import { DEFAULT_RULES, type RoundRules, boardTotal } from '../engine/rules';

export const BOT_LEVEL_NAMES = ['Lehký', 'Střední', 'Těžký'];

/** Monte Carlo odhad šance na výhru (remíza se počítá podílem) podle pravidel ruky. */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  iterations: number,
  rng: () => number,
  rules: RoundRules = DEFAULT_RULES,
): number {
  if (opponents <= 0) return 1;
  const known = new Set([...hole, ...board].map((c) => c.r * 4 + 'shdc'.indexOf(c.s)));
  const rest = fullDeck().filter((c) => !known.has(c.r * 4 + 'shdc'.indexOf(c.s)) && (!rules.shortDeck || c.r >= 6));
  const boardSize = boardTotal(rules);
  // Karty, které do ruky teprve přijdou (Obrácené rozdávání), se simulují taky.
  const finalHole = rules.holeSchedule ? rules.holeSchedule[rules.holeSchedule.length - 1] : Math.max(hole.length, 1);
  const myMissing = Math.max(0, finalHole - hole.length);
  const holeSize = rules.holeSchedule ? finalHole : rules.roulette ? 2 : rules.holeCards;
  const need = Math.min(rest.length, Math.max(0, boardSize - board.length) + myMissing + opponents * holeSize);
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
    while (fullBoard.length < boardSize) fullBoard.push(rest[k++]);
    const myHole = myMissing ? [...hole, ...rest.slice(k, k + myMissing)] : hole;
    k += myMissing;
    const mine = bestHandFor(myHole, fullBoard, rules).strength;
    let best = true;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const opp = rest.slice(k, k + holeSize);
      k += holeSize;
      const score = bestHandFor(opp, fullBoard, rules).strength;
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
  const rules = s.rules;
  const iterBase = [120, 250, 450][level] ?? 250;
  // Víc karet = dražší vyhodnocení → méně simulací.
  const cards = (rules.holeSchedule ? rules.holeSchedule[rules.holeSchedule.length - 1] : rules.holeCards) + boardTotal(rules);
  const cost = rules.omaha ? 3 : cards > 9 ? 10 : cards > 7 ? 3 : 1;
  const iterations = Math.max(cost >= 10 ? 16 : 40, Math.floor(iterBase / Math.max(1, Math.ceil(opponents / 2)) / cost));

  const fair = 1 / (opponents + 1);
  // Naslepo: bot svoje karty před flopem nezná.
  const blindNow = rules.hideOwnPreflop && s.street === 'preflop';
  // Zrcadlový pot: na kartách nezáleží.
  // U drahých karet (hodně karet na stole/v ruce) se simulují nejvýš 2 soupeři
  // a šance se přepočítá: proti N soupeřům ≈ (šance proti 2)^(N/2).
  const simOpp = cost >= 10 ? Math.min(opponents, 2) : opponents;
  const raw = rules.splitAll || blindNow ? fair : estimateEquity(me.hole, visibleBoard(s), simOpp, iterations, rng, rules);
  let eq = rules.splitAll || blindNow || simOpp === opponents ? raw : Math.pow(raw, opponents / simOpp);
  const noise = [0.12, 0.05, 0.02][level] ?? 0.05;
  eq = Math.min(1, Math.max(0, eq + (rng() * 2 - 1) * noise));

  const pot = potTotal(s);
  const bb = s.betUnit;
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

  // All in nebo fold: sázka je vždy all in, takže jen se silnou rukou.
  if (rules.betting === 'pushfold') {
    if (legal.canRaise && eq > Math.min(0.8, fair * 1.7)) return { type: 'allin' };
    if (legal.canCheck) return { type: 'check' };
    return eq >= potOdds + callMargin + 0.05 ? { type: 'call' } : { type: 'fold' };
  }

  // Krátký stack: all in nebo fold.
  if (stackBb <= 10 && legal.canRaise && rules.betting === 'nl') {
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

/** Draw: které karty bot vymění – nejnižší karty bez páru (nejvýš 2). */
export function botExchange(s: GameState, id: string): number[] {
  const me = s.players.find((p) => p.id === id);
  if (!me) return [];
  const seen = [...me.hole, ...s.board];
  const count = (r: number) => seen.filter((c) => c.r === r).length;
  return me.hole
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => count(c.r) === 1 && c.r < 11)
    .sort((a, b) => a.c.r - b.c.r)
    .slice(0, 2)
    .map((x) => x.i);
}
