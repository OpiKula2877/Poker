import { describe, expect, it } from 'vitest';
import { decideBotAction } from '../bots/bot';
import { createRng } from './cards';
import {
  type GameConfig,
  type GameState,
  advance,
  applyAction,
  chipTotal,
  createGame,
  legalActions,
  makeBlindLevels,
  startHand,
} from './game';

const config = (seats: number, startStack = 1000): GameConfig => ({
  seats,
  startStack,
  blinds: makeBlindLevels(20),
  levelMinutes: 10,
  turnSeconds: 20,
});

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Hráč ' + i, isBot: true, botLevel: i % 3 }));

describe('průběh ruky', () => {
  it('blindy a první na tahu (3 hráči)', () => {
    let s = createGame(config(3), players(3), 1, 0);
    s = startHand(s, 0);
    const sb = s.players.find((p) => p.id === s.sbId)!;
    const bb = s.players.find((p) => p.id === s.bbId)!;
    expect(sb.bet).toBe(10);
    expect(bb.bet).toBe(20);
    expect(s.toActId).toBe(s.dealerId); // u 3 hráčů je po BB na tahu dealer
  });

  it('heads-up: dealer je small blind a hraje první před flopem', () => {
    let s = createGame(config(2), players(2), 2, 0);
    s = startHand(s, 0);
    expect(s.sbId).toBe(s.dealerId);
    expect(s.toActId).toBe(s.dealerId);
  });

  it('fold všech ukončí ruku bez showdownu', () => {
    let s = createGame(config(3), players(3), 3, 0);
    s = startHand(s, 0);
    s = applyAction(s, s.toActId!, { type: 'fold' }, 0);
    s = applyAction(s, s.toActId!, { type: 'fold' }, 0);
    expect(s.phase).toBe('roundEnd');
    s = advance(s, 0);
    expect(s.phase).toBe('handEnd');
    expect(s.showdown?.uncontested).toBe(true);
    expect(chipTotal(s)).toBe(3000);
  });

  it('BB má možnost checknout po dorovnání', () => {
    let s = createGame(config(3), players(3), 4, 0);
    s = startHand(s, 0);
    s = applyAction(s, s.toActId!, { type: 'call' }, 0);
    s = applyAction(s, s.toActId!, { type: 'call' }, 0);
    expect(s.toActId).toBe(s.bbId);
    expect(legalActions(s, s.bbId!)?.canCheck).toBe(true);
  });

  it('nedorovnaná část all inu se vrací a nepočítá se jako výhra', () => {
    let s = createGame(config(2), players(2), 7, 0);
    s = startHand(s, 0);
    const big = s.toActId!; // dealer/SB
    const short = s.bbId!;
    s.players.find((p) => p.id === short)!.stack = 280; // BB má celkem 300
    s = applyAction(s, big, { type: 'allin' }, 0); // 1000
    s = applyAction(s, short, { type: 'call' }, 0); // all in 300
    while (s.phase === 'roundEnd') s = advance(s, 0);
    expect(s.showdown!.refunds).toEqual([{ id: big, amount: 700 }]);
    expect(s.showdown!.winners.reduce((a, w) => a + w.amount, 0)).toBe(600);
  });

  it('minimální navýšení je o poslední navýšení', () => {
    let s = createGame(config(3), players(3), 5, 0);
    s = startHand(s, 0);
    s = applyAction(s, s.toActId!, { type: 'raise', to: 60 }, 0); // +40
    const legal = legalActions(s, s.toActId!)!;
    expect(legal.minRaiseTo).toBe(100);
  });

  it('krátký all in znovu neotevře navyšování', () => {
    let s = createGame(config(3), players(3), 6, 0);
    s = startHand(s, 0);
    const dealer = s.toActId!;
    s.players.find((p) => p.id === s.sbId)!.stack = 140; // SB má celkem 150
    s = applyAction(s, dealer, { type: 'raise', to: 100 }, 0); // navýšení o 80
    s = applyAction(s, s.sbId!, { type: 'allin' }, 0); // all in na 150 = jen +50
    s = applyAction(s, s.bbId!, { type: 'fold' }, 0);
    expect(s.toActId).toBe(dealer);
    const legal = legalActions(s, dealer)!;
    expect(legal.canRaise).toBe(false);
    expect(legal.callAmount).toBe(50);
  });
});

/** Odehraje celý turnaj s boty a po každém kroku kontroluje, že žetony nevznikají ani nemizí. */
function playTournament(n: number, seed: number): GameState {
  const rng = createRng(seed);
  let s = createGame(config(n, 1500), players(n), seed, 0);
  let now = 0;
  const total = n * 1500;
  for (let step = 0; step < 50_000; step++) {
    now += 7_000;
    if (s.phase === 'waiting' || s.phase === 'handEnd') s = startHand(s, now);
    else if (s.phase === 'roundEnd') s = advance(s, now);
    else if (s.phase === 'betting') s = applyAction(s, s.toActId!, decideBotAction(s, s.toActId!, rng), now);
    else break;
    expect(chipTotal(s)).toBe(total);
    for (const p of s.players) expect(p.stack).toBeGreaterThanOrEqual(0);
  }
  return s;
}

describe('simulace turnaje', () => {
  for (const [n, seed] of [
    [2, 11],
    [6, 12],
    [9, 13],
  ] as const) {
    it(`${n} botů dohraje turnaj a žetony sedí`, () => {
      const s = playTournament(n, seed);
      expect(s.phase).toBe('gameOver');
      const places = s.players.map((p) => p.place).sort((a, b) => a! - b!);
      expect(places).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(s.players.find((p) => p.id === s.winnerId)!.stack).toBe(n * 1500);
    }, 60_000);
  }
});
