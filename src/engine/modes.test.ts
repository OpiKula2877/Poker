import { describe, expect, it } from 'vitest';
import { decideBotAction } from '../bots/bot';
import { computeHint } from '../bots/hints';
import { createRng, parseCards } from './cards';
import { bestHandFor, CAT } from './evaluator';
import { EVENTS, drawEvent, rulesForEvent } from './events';
import {
  type GameConfig,
  type GameState,
  ackEvent,
  advance,
  applyAction,
  chipTotal,
  createGame,
  legalActions,
  makeBlindLevels,
  rebuy,
  startHand,
} from './game';
import { DEFAULT_RULES } from './rules';

const rulesOf = (id: string) => rulesForEvent(EVENTS.find((e) => e.id === id)!, createRng(1));

describe('vyhodnocení podle Game Changer pravidel', () => {
  const board = parseCards('2c 7d 9h Jd 3s');
  it('Obrácené pořadí: nejvyšší karta poráží pár', () => {
    const r = rulesOf('reverse');
    const high = bestHandFor(parseCards('Ac Kh'), board, r);
    const pair = bestHandFor(parseCards('9c 9s'), parseCards('2c 7d 4h Jd 3s'), r);
    expect(high.cat).toBe(CAT.HIGH);
    expect(high.strength).toBeGreaterThan(pair.strength);
  });
  it('Obrácené pořadí: hráč si z karet vybere nejslabší kombinaci', () => {
    // s párem v ruce i na stole jde poskládat i nejvyšší karta – ta se teď hodí víc
    const h = bestHandFor(parseCards('9c Ks'), parseCards('9h 2c 5d 7s Qh'), rulesOf('reverse'));
    expect(h.cat).toBe(CAT.HIGH);
  });
  it('Pár je král: pár poráží barvu', () => {
    const r = rulesOf('pairKing');
    const flush = bestHandFor(parseCards('Ad Kd'), parseCards('2d 7d 9d Jc 3s'), r);
    const pair = bestHandFor(parseCards('Qc Qs'), parseCards('2c 7h 9d Jc 3s'), r);
    expect(flush.cat).toBe(CAT.FLUSH);
    expect(pair.strength).toBeGreaterThan(flush.strength);
  });
  it('Nejnižší bere: nejvyšší karta 7 poráží pár', () => {
    const r = rulesOf('lowball');
    const low = bestHandFor(parseCards('4c 6h'), parseCards('2c 5d 7h Kd Qs'), r);
    const pair = bestHandFor(parseCards('2h 2s'), parseCards('2c 5d 7h Kd Qs'), r);
    expect(low.strength).toBeGreaterThan(pair.strength);
  });
  it('Bez barev: pět srdcí není barva', () => {
    const h = bestHandFor(parseCards('Ah Kh'), parseCards('2h 7h 9h Jc 3s'), rulesOf('noSuits'));
    expect(h.cat).toBe(CAT.HIGH);
  });
  it('Omaha: musí použít přesně 2 karty z ruky', () => {
    // na stole 4 srdce, v ruce jen jedno – v Omaze to barva není
    const h = bestHandFor(parseCards('Ah Kc Qd Js'), parseCards('2h 7h 9h 4h 3s'), rulesOf('omaha'));
    expect(h.cat).not.toBe(CAT.FLUSH);
    const normal = bestHandFor(parseCards('Ah Kc'), parseCards('2h 7h 9h 4h 3s'), DEFAULT_RULES);
    expect(normal.cat).toBe(CAT.FLUSH);
  });
  it('Krátký balíček: barva poráží full house', () => {
    const r = rulesOf('shortDeck');
    const flush = bestHandFor(parseCards('Ad Kd'), parseCards('6d 7d 9d Jc 8s'), r);
    const full = bestHandFor(parseCards('Qc Qs'), parseCards('Qh 9c 9s Jc 8s'), r);
    expect(flush.strength).toBeGreaterThan(full.strength);
  });
});

const cfg = (extra: Partial<GameConfig> = {}): GameConfig => ({
  seats: 4,
  startStack: 1500,
  blinds: makeBlindLevels(20),
  levelMinutes: 10,
  turnSeconds: 20,
  ...extra,
});

const bots = (n: number, level = 0) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'B' + i, isBot: true, botLevel: level }));

/** Odehraje `hands` rukou s boty a hlídá žetony; vrací všechny stavy na konci rukou. */
function play(config: GameConfig, hands: number, seed: number, check?: (s: GameState) => void): GameState[] {
  const rng = createRng(seed);
  let s = createGame(config, bots(config.seats), seed, 0);
  const ends: GameState[] = [];
  let now = 0;
  for (let step = 0; step < 20_000 && ends.length < hands; step++) {
    now += 5_000;
    if (s.phase === 'waiting' || s.phase === 'handEnd') s = startHand(s, now);
    else if (s.phase === 'roundEnd') s = advance(s, now);
    else if (s.phase === 'betting') s = applyAction(s, s.toActId!, decideBotAction(s, s.toActId!, rng), now);
    else break;
    check?.(s);
    const bought = s.players.reduce((a, p) => a + p.buyIns, 0) * config.startStack;
    expect(chipTotal(s)).toBe(bought);
    if (s.phase === 'handEnd' || s.phase === 'gameOver') ends.push(s);
    if (s.phase === 'gameOver') break;
  }
  return ends;
}

describe('každá Game Changer karta odehraje ruce bez chyby', () => {
  for (const e of EVENTS) {
    it(e.id, () => {
      let maxBoard = 0;
      let saw = false;
      play(cfg({ gameChanger: { chance: 1, events: [e.id] } }), 6, 100 + e.id.length, (s) => {
        if (s.rules.eventId !== e.id) return;
        saw = true;
        maxBoard = Math.max(maxBoard, s.board.length);
        expect(s.board.length).toBeLessThanOrEqual(s.rules.boardCards);
        for (const p of s.players) if (p.inHand) expect(p.hole.length).toBe(s.rules.holeCards);
        if (s.rules.shortDeck) for (const c of [...s.board, ...s.deck]) expect(c.r).toBeGreaterThanOrEqual(6);
      });
      expect(saw).toBe(true);
      if (e.id === 'flopOnly') expect(maxBoard).toBeLessThanOrEqual(3);
    }, 120_000);
  }
});

describe('sázky podle karty', () => {
  const withEvent = (id: string) => startHand(createGame(cfg({ gameChanger: { chance: 1, events: [id] } }), bots(4), 9, 0), 0);

  it('Limit: navýšit jde jen o 1 BB', () => {
    const s = withEvent('limit');
    const l = legalActions(s, s.toActId!)!;
    expect(l.minRaiseTo).toBe(40);
    expect(l.maxRaiseTo).toBe(40);
  });
  it('Limit: nejvýš 3 navýšení v kole', () => {
    let s = withEvent('limit');
    for (let i = 0; i < 3; i++) s = applyAction(s, s.toActId!, { type: 'raise', to: 0 }, 0);
    expect(legalActions(s, s.toActId!)!.canRaise).toBe(false);
  });
  it('All in nebo fold: jediné navýšení je all in', () => {
    const s = withEvent('pushFold');
    const p = s.players.find((x) => x.id === s.toActId)!;
    const l = legalActions(s, p.id)!;
    expect(l.minRaiseTo).toBe(p.stack + p.bet);
  });
  it('Pot limit: navýšení nejvýš o velikost banku', () => {
    const s = withEvent('potLimit');
    const l = legalActions(s, s.toActId!)!;
    // bank 30 (blindy) + dorovnání 20 → navýšení na 20 + 50 = 70
    expect(l.maxRaiseTo).toBe(70);
  });
  it('Dvojité blindy', () => {
    const s = withEvent('doubleBlinds');
    expect(s.players.find((p) => p.id === s.bbId)!.bet).toBe(40);
  });
  it('Výměna balancí prohodí žetony a nic se neztratí', () => {
    let s = createGame(cfg({ gameChanger: { chance: 1, events: ['swapTwo'] } }), bots(4), 3, 0);
    s.players.forEach((p, i) => (p.stack = 1000 + i * 500));
    s = startHand(s, 0);
    expect(chipTotal(s)).toBe(1000 + 1500 + 2000 + 2500);
  });
});

describe('losování karet', () => {
  it('chance 0 = nikdy, 1 = vždy', () => {
    const rng = createRng(5);
    expect(drawEvent(rng, 0)).toBeNull();
    for (let i = 0; i < 50; i++) expect(drawEvent(rng, 1)).not.toBeNull();
  });
  it('legendární karty jsou vzácnější než běžné', () => {
    const rng = createRng(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const e = drawEvent(rng, 1)!;
      counts[e.rarity] = (counts[e.rarity] ?? 0) + 1;
    }
    expect(counts.common / 10).toBeGreaterThan(counts.legendary / 2);
  });
});

describe('cash game', () => {
  it('boti dokupují, žetony sedí podle počtu nákupů, blindy nerostou', () => {
    const ends = play(cfg({ variant: 'cash', startStack: 400 }), 40, 21);
    const last = ends[ends.length - 1];
    expect(last.phase).toBe('handEnd');
    expect(last.level).toBe(0);
    expect(last.players.some((p) => p.buyIns > 1)).toBe(true);
  }, 60_000);

  it('člověk bez žetonů sedí mimo hru, dokud nedokoupí', () => {
    let s = createGame(cfg({ variant: 'cash' }), [{ id: 'me', name: 'Ty', isBot: false }, ...bots(3).slice(1)], 4, 0);
    s.players[0].stack = 0;
    s.players[0].out = true;
    s = startHand(s, 0);
    expect(s.players[0].inHand).toBe(false);
    s = rebuy(s, 'me');
    expect(s.players[0].stack).toBe(1500);
    expect(s.players[0].buyIns).toBe(2);
    expect(s.players[0].out).toBe(false);
  });
});

describe('nápověda', () => {
  it('doporučí tah a spočítá šanci', () => {
    const s = startHand(createGame(cfg(), [{ id: 'me', name: 'Ty', isBot: false }, ...bots(4).slice(1)], 2, 0), 0);
    let g = s;
    const rng = createRng(3);
    while (g.toActId !== 'me' && g.phase === 'betting') g = applyAction(g, g.toActId!, { type: 'call' }, 0);
    const h = computeHint(g, 'me', rng)!;
    expect(h.equity).toBeGreaterThanOrEqual(0);
    expect(h.equity).toBeLessThanOrEqual(1);
    expect(['fold', 'check', 'call', 'raise']).toContain(h.advice);
  });
});

describe('Game Changer čeká na potvrzení', () => {
  const humans = [
    { id: 'me', name: 'Ty', isBot: false },
    { id: 'g1', name: 'Eva', isBot: false },
    { id: 'b1', name: 'Bot', isBot: true },
  ];
  it('hra stojí, dokud kartu nepotvrdí všichni lidé', () => {
    let s = startHand(createGame(cfg({ seats: 3, gameChanger: { chance: 1, events: ['reverse'] } }), humans, 8, 0), 0);
    expect(s.phase).toBe('reveal');
    expect(s.pendingAcks.sort()).toEqual(['g1', 'me']);
    expect(legalActions(s, s.toActId!)).toBeNull();
    expect(() => applyAction(s, s.toActId!, { type: 'fold' }, 0)).toThrow();
    s = ackEvent(s, 'me', 1000);
    expect(s.phase).toBe('reveal');
    s = ackEvent(s, 'me', 1000); // dvojí potvrzení nic nemění
    expect(s.pendingAcks).toEqual(['g1']);
    s = ackEvent(s, 'g1', 5000);
    expect(s.phase).toBe('betting');
    expect(s.turnStartedAt).toBe(5000);
    expect(legalActions(s, s.toActId!)).not.toBeNull();
  });
  it('bez karty se nečeká', () => {
    const s = startHand(createGame(cfg({ seats: 3, gameChanger: { chance: 0 } }), humans, 8, 0), 0);
    expect(s.phase).toBe('betting');
  });
});
