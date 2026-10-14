import { type Card, cardText, createRng, fullDeck, shuffle } from './cards';
import { bestHandFor, describeHand, HAND_NAMES } from './evaluator';
import { drawEvent, rulesForEvent } from './events';
import { awardPots, computePots } from './pots';
import { DEFAULT_RULES, type RoundRules } from './rules';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
/**
 * waiting   – před první rukou (v cash game i když u stolu chybí hráči)
 * reveal    – vylosovaná Game Changer karta; čeká se, až ji všichni lidé potvrdí (ackEvent)
 * betting   – někdo je na tahu (toActId)
 * roundEnd  – sázkové kolo skončilo, `advance` rozdá další karty nebo vyhodnotí ruku
 * handEnd   – ruka vyhodnocena (showdown), `startHand` začne další
 * gameOver  – zbyl jeden hráč (jen turnaj)
 */
export type Phase = 'waiting' | 'reveal' | 'betting' | 'roundEnd' | 'handEnd' | 'gameOver';

export interface BlindLevel {
  sb: number;
  bb: number;
  ante: number;
}

export type Variant = 'tournament' | 'cash';

export interface GameChangerConfig {
  /** Pravděpodobnost, že ruka dostane kartu (1 = každá ruka). */
  chance: number;
  /** Povolené karty; bez = všechny. */
  events?: string[];
}

export interface GameConfig {
  seats: number;
  startStack: number;
  blinds: BlindLevel[];
  levelMinutes: number;
  turnSeconds: number;
  /** Turnaj (vyřazování) nebo cash game (dokupování, blindy nerostou). */
  variant?: Variant;
  gameChanger?: GameChangerConfig | null;
}

export interface PlayerSetup {
  id: string;
  name: string;
  isBot: boolean;
  botLevel?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  isBot: boolean;
  botLevel: number;
  stack: number;
  hole: Card[];
  /** Vsazeno v aktuálním sázkovém kole. */
  bet: number;
  /** Vsazeno v celé ruce (včetně ante a blindů). */
  committed: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  /** Turnaj: vyřazen. Cash game: bez žetonů, sedí mimo hru, dokud nedokoupí. */
  out: boolean;
  place: number | null;
  lastAction: string | null;
  showCards: boolean;
  /** Kolikrát hráč koupil žetony (cash game; na začátku 1). */
  buyIns: number;
}

export interface ShowdownHand {
  cat: number;
  name: string;
  cards: Card[];
  counted: number;
}

export interface ShowdownInfo {
  uncontested: boolean;
  winners: { id: string; amount: number }[];
  /** Vrácené nedorovnané sázky. */
  refunds: { id: string; amount: number }[];
  hands: Record<string, ShowdownHand>;
  eliminated: string[];
}

export interface LogEntry {
  n: number;
  kind: 'street' | 'action' | 'win' | 'info' | 'event';
  who?: string;
  text: string;
}

export interface GameState {
  /** Náhodné ID hry (pro rozpoznání nové hry na klientovi). */
  gameId: string;
  config: GameConfig;
  players: PlayerState[];
  seed: number;
  handNo: number;
  level: number;
  levelEndsAt: number;
  dealerId: string | null;
  sbId: string | null;
  bbId: string | null;
  street: Street;
  phase: Phase;
  board: Card[];
  deck: Card[];
  toActId: string | null;
  turnStartedAt: number;
  handStartedAt: number;
  pending: string[];
  actedSinceFullRaise: string[];
  currentBet: number;
  minRaise: number;
  /** Big blind této ruky (po případném zdvojení) – jednotka pro limit a min. sázku. */
  betUnit: number;
  raisesThisStreet: number;
  /** Fáze reveal: kdo ještě nepotvrdil Game Changer kartu. */
  pendingAcks: string[];
  /** Fáze, do které hra přejde po potvrzení karty. */
  revealNext: Phase | null;
  /** Pravidla aktuální ruky (Game Changer). */
  rules: RoundRules;
  showdown: ShowdownInfo | null;
  winnerId: string | null;
  log: LogEntry[];
  logSeq: number;
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number }
  | { type: 'allin' };

export interface Legal {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  /** Aktuálně nejvyšší sázka v kole (pro texty „Sázet“ vs „Navýšit“). */
  currentBet: number;
}

const fmt = (n: number) => n.toLocaleString('cs-CZ');

// ---------- blindy ----------

function nice(x: number): number {
  if (x <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const m = x / p;
  const s = steps.reduce((best, v) => (Math.abs(v - m) < Math.abs(best - m) ? v : best), 1);
  return Math.round(s * p);
}

/** Struktura blindů od zadaného big blindu: zhruba ×1,4 na level, ante od 6. levelu. */
export function makeBlindLevels(startBb: number, count = 30): BlindLevel[] {
  const levels: BlindLevel[] = [];
  let bb = startBb;
  for (let i = 0; i < count; i++) {
    const b = i === 0 ? startBb : nice(bb);
    const prev = levels[levels.length - 1];
    const fixedBb = prev && b <= prev.bb ? nice(prev.bb * 1.5) : b;
    const sb = Math.max(1, Math.floor(fixedBb / 2));
    const ante = i >= 5 ? Math.max(1, nice(fixedBb / 10)) : 0;
    levels.push({ sb, bb: fixedBb, ante });
    bb = fixedBb * 1.4;
  }
  return levels;
}

// ---------- pomocné ----------

function clone(s: GameState): GameState {
  return structuredClone(s);
}

function addLog(s: GameState, kind: LogEntry['kind'], text: string, who?: string) {
  s.log.push({ n: ++s.logSeq, kind, text, who });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

function byId(s: GameState, id: string | null): PlayerState | undefined {
  return s.players.find((p) => p.id === id);
}

/** Hráči v pořadí sedadel začínající hned za hráčem `afterId` (on sám až na konci). */
function orderAfter(s: GameState, afterId: string | null, filter: (p: PlayerState) => boolean): PlayerState[] {
  const ps = s.players;
  const start = Math.max(0, ps.findIndex((p) => p.id === afterId));
  const out: PlayerState[] = [];
  for (let i = 1; i <= ps.length; i++) {
    const p = ps[(start + i) % ps.length];
    if (filter(p)) out.push(p);
  }
  return out;
}

const canAct = (p: PlayerState) => p.inHand && !p.folded && !p.allIn;
const live = (p: PlayerState) => p.inHand && !p.folded;

export function potTotal(s: GameState): number {
  return s.players.reduce((sum, p) => sum + p.committed, 0);
}

export function activePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => !p.out);
}

export function currentBlinds(s: GameState): BlindLevel {
  return s.config.blinds[Math.min(s.level, s.config.blinds.length - 1)];
}

/** Čas na tah v aktuální ruce (Bleskové kolo ho zkracuje). */
export function turnSecondsOf(s: GameState): number {
  return s.rules.turnSeconds ?? s.config.turnSeconds;
}

export const isCash = (s: GameState) => s.config.variant === 'cash';

function pay(p: PlayerState, amount: number): number {
  const a = Math.min(amount, p.stack);
  p.stack -= a;
  p.bet += a;
  p.committed += a;
  if (p.stack === 0) p.allIn = true;
  return a;
}

// ---------- vytvoření hry ----------

export function createGame(config: GameConfig, setups: PlayerSetup[], seed: number, now: number): GameState {
  const players: PlayerState[] = setups.slice(0, config.seats).map((p, i) => ({
    id: p.id,
    name: p.name,
    seat: i,
    isBot: p.isBot,
    botLevel: p.botLevel ?? 1,
    stack: config.startStack,
    hole: [],
    bet: 0,
    committed: 0,
    inHand: false,
    folded: false,
    allIn: false,
    out: false,
    place: null,
    lastAction: null,
    showCards: false,
    buyIns: 1,
  }));
  return {
    gameId: Math.random().toString(36).slice(2, 10),
    config,
    players,
    seed,
    handNo: 0,
    level: 0,
    levelEndsAt: now + config.levelMinutes * 60_000,
    dealerId: null,
    sbId: null,
    bbId: null,
    street: 'preflop',
    phase: 'waiting',
    board: [],
    deck: [],
    toActId: null,
    turnStartedAt: now,
    handStartedAt: now,
    pending: [],
    actedSinceFullRaise: [],
    currentBet: 0,
    minRaise: config.blinds[0].bb,
    betUnit: config.blinds[0].bb,
    raisesThisStreet: 0,
    pendingAcks: [],
    revealNext: null,
    rules: DEFAULT_RULES,
    showdown: null,
    winnerId: null,
    log: [],
    logSeq: 0,
  };
}

// ---------- ruka ----------

/**
 * Začne další ruku. `random` = zdroj náhody pro míchání; bez něj se použije
 * seed hry (deterministické, pro testy). Ve skutečné hře se předává
 * kryptografická náhoda, aby nešlo balíček dopočítat z 32bitového seedu.
 */
export function startHand(prev: GameState, now: number, random?: () => number): GameState {
  const s = clone(prev);
  if (s.phase === 'gameOver') return s;
  const cash = isCash(s);

  // Cash game: hraje se, jen když jsou u stolu aspoň dva hráči se žetony.
  if (s.players.filter((p) => !p.out).length < 2) {
    s.phase = 'waiting';
    return s;
  }

  if (!cash) {
    while (now >= s.levelEndsAt && s.level < s.config.blinds.length - 1) {
      s.level++;
      s.levelEndsAt += s.config.levelMinutes * 60_000;
      const b = currentBlinds(s);
      addLog(s, 'info', `Level ${s.level + 1}: blindy ${fmt(b.sb)} / ${fmt(b.bb)}` + (b.ante ? `, ante ${fmt(b.ante)}` : ''));
    }
    if (now >= s.levelEndsAt) s.levelEndsAt = now + s.config.levelMinutes * 60_000;
  }

  s.handNo++;
  s.board = [];
  s.showdown = null;
  s.street = 'preflop';
  for (const p of s.players) {
    p.hole = [];
    p.bet = 0;
    p.committed = 0;
    p.inHand = !p.out;
    p.folded = false;
    p.allIn = false;
    p.lastAction = null;
    p.showCards = false;
  }

  const active = s.players.filter((p) => !p.out);
  const rng = random ?? createRng((s.seed + Math.imul(s.handNo, 0x9e3779b1)) >>> 0);

  addLog(s, 'street', `Ruka #${s.handNo}`);

  // Game Changer karta pro tuto ruku.
  const gc = s.config.gameChanger;
  const event = gc ? drawEvent(rng, gc.chance, gc.events) : null;
  s.rules = rulesForEvent(event, rng);
  if (event) addLog(s, 'event', event.name, 'Game Changer');
  if (event?.id === 'swapTwo' && active.length >= 2) {
    const [a, b] = shuffle(active, rng);
    [a.stack, b.stack] = [b.stack, a.stack];
    addLog(s, 'event', `${a.name} a ${b.name} si prohodili žetony`);
  } else if (event?.id === 'shuffleAll') {
    const stacks = shuffle(
      active.map((p) => p.stack),
      rng,
    );
    active.forEach((p, i) => (p.stack = stacks[i]));
    addLog(s, 'event', 'žetony všech hráčů se přeházely');
  }

  // Dealer se posouvá na dalšího hráče ve hře.
  if (!s.dealerId || !byId(s, s.dealerId)) s.dealerId = active[Math.floor(rng() * active.length)].id;
  else s.dealerId = orderAfter(s, s.dealerId, (p) => !p.out)[0].id;

  if (active.length === 2) {
    s.sbId = s.dealerId;
    s.bbId = orderAfter(s, s.dealerId, (p) => !p.out)[0].id;
  } else {
    const after = orderAfter(s, s.dealerId, (p) => !p.out);
    s.sbId = after[0].id;
    s.bbId = after[1].id;
  }

  s.deck = shuffle(
    fullDeck().filter((c) => !s.rules.shortDeck || c.r >= 6),
    rng,
  );
  const dealOrder = orderAfter(s, s.dealerId, (p) => !p.out);
  for (let round = 0; round < s.rules.holeCards; round++) for (const p of dealOrder) p.hole.push(s.deck.pop()!);

  const b = currentBlinds(s);
  const sbAmt = b.sb * s.rules.blindMult;
  const bbAmt = b.bb * s.rules.blindMult;
  const ante = b.ante + s.rules.anteBb * b.bb;
  if (ante) {
    for (const p of active) {
      pay(p, ante);
      p.bet = 0; // ante jde rovnou do banku, nepočítá se do sázky v kole
    }
  }
  const sb = byId(s, s.sbId)!;
  const bb = byId(s, s.bbId)!;
  if (!sb.allIn) pay(sb, sbAmt);
  sb.lastAction = 'SB ' + fmt(sb.bet);
  if (!bb.allIn) pay(bb, bbAmt);
  bb.lastAction = 'BB ' + fmt(bb.bet);
  addLog(s, 'action', `small blind ${fmt(sb.bet)}`, sb.name);
  addLog(s, 'action', `big blind ${fmt(bb.bet)}`, bb.name);

  s.currentBet = bbAmt;
  s.minRaise = bbAmt;
  s.betUnit = bbAmt;
  s.raisesThisStreet = 0;
  s.actedSinceFullRaise = [];
  s.pending = orderAfter(s, s.bbId, canAct).map((p) => p.id);
  s.phase = 'betting';
  s.toActId = null;
  s.handStartedAt = now;
  settle(s, s.bbId!, now);
  // Vylosovaná karta: hra stojí, dokud ji všichni lidé u stolu nepotvrdí.
  const readers = s.players.filter((p) => !p.isBot && !p.out).map((p) => p.id);
  if (event && readers.length) {
    s.revealNext = s.phase;
    s.pendingAcks = readers;
    s.phase = 'reveal';
  }
  return s;
}

export function legalActions(s: GameState, id: string): Legal | null {
  if (s.phase !== 'betting' || s.toActId !== id) return null;
  const p = byId(s, id)!;
  const callAmount = Math.min(s.currentBet - p.bet, p.stack);
  const othersCanAct = s.players.some((o) => o.id !== id && canAct(o));
  const allInTo = p.bet + p.stack;
  let maxRaiseTo = allInTo;
  let minRaiseTo = Math.min(s.currentBet + s.minRaise, allInTo);
  let canRaise = othersCanAct && allInTo > s.currentBet && !s.actedSinceFullRaise.includes(id);

  switch (s.rules.betting) {
    case 'limit':
      minRaiseTo = maxRaiseTo = Math.min(s.currentBet + s.betUnit, allInTo);
      canRaise &&= s.raisesThisStreet < 3;
      break;
    case 'pot':
      maxRaiseTo = Math.min(allInTo, s.currentBet + potTotal(s) + callAmount);
      minRaiseTo = Math.min(minRaiseTo, maxRaiseTo);
      break;
    case 'pushfold':
      minRaiseTo = maxRaiseTo = allInTo;
      break;
  }

  return {
    canCheck: s.currentBet <= p.bet,
    canCall: s.currentBet > p.bet,
    callAmount,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
    currentBet: s.currentBet,
  };
}

export function applyAction(prev: GameState, id: string, action: Action, now: number): GameState {
  const legal = legalActions(prev, id);
  if (!legal) throw new Error('Hráč není na tahu');
  const s = clone(prev);
  const p = byId(s, id)!;

  const markActed = () => {
    s.pending = s.pending.filter((x) => x !== id);
    if (!s.actedSinceFullRaise.includes(id)) s.actedSinceFullRaise.push(id);
  };

  let type = action.type;
  let to = action.type === 'raise' ? Math.floor(action.to) : 0;
  if (type === 'allin') {
    // V limitu a pot limitu znamená „all in“ maximální povolené navýšení.
    to = legal.maxRaiseTo;
    if (to <= s.currentBet || !legal.canRaise) type = 'call';
    else type = 'raise';
  }
  if (type === 'check' && !legal.canCheck) type = 'call';
  if (type === 'call' && !legal.canCall) type = 'check';

  switch (type) {
    case 'fold':
      p.folded = true;
      p.lastAction = 'Fold';
      addLog(s, 'action', 'fold', p.name);
      markActed();
      break;
    case 'check':
      p.lastAction = 'Check';
      addLog(s, 'action', 'check', p.name);
      markActed();
      break;
    case 'call': {
      const paid = pay(p, s.currentBet - p.bet);
      p.lastAction = p.allIn ? 'All in' : 'Call';
      addLog(s, 'action', p.allIn ? `all in ${fmt(paid)}` : `dorovnává ${fmt(paid)}`, p.name);
      markActed();
      break;
    }
    case 'raise': {
      if (!legal.canRaise) throw new Error('Navýšení teď není povolené');
      to = Math.min(Math.max(to, legal.minRaiseTo), legal.maxRaiseTo);
      if (to <= s.currentBet) throw new Error('Navýšení musí být vyšší než aktuální sázka');
      const wasBet = s.currentBet === 0;
      pay(p, to - p.bet);
      const increase = to - s.currentBet;
      if (increase >= s.minRaise) {
        s.minRaise = increase;
        s.actedSinceFullRaise = [id];
      } else if (!s.actedSinceFullRaise.includes(id)) {
        s.actedSinceFullRaise.push(id); // krátký all-in znovu neotevírá navyšování
      }
      s.raisesThisStreet++;
      s.currentBet = to;
      s.pending = orderAfter(s, id, (o) => canAct(o) && o.id !== id).map((o) => o.id);
      p.lastAction = p.allIn ? 'All in' : wasBet ? 'Sází ' + fmt(to) : 'Na ' + fmt(to);
      addLog(s, 'action', p.allIn ? `all in ${fmt(to)}` : wasBet ? `sází ${fmt(to)}` : `navyšuje na ${fmt(to)}`, p.name);
      break;
    }
  }

  settle(s, id, now);
  return s;
}

/** Po akci: kdo je další na tahu, nebo jestli kolo skončilo. */
function settle(s: GameState, lastId: string, now: number) {
  s.pending = s.pending.filter((id) => canAct(byId(s, id)!));
  const liveCount = s.players.filter(live).length;
  const actors = s.players.filter(canAct);
  const maxBet = Math.max(0, ...s.players.filter(live).map((p) => p.bet));

  const roundOver =
    liveCount <= 1 ||
    s.pending.length === 0 ||
    (actors.length === 1 && actors[0].bet >= maxBet) ||
    actors.length === 0;

  if (roundOver) {
    s.phase = 'roundEnd';
    s.toActId = null;
    return;
  }
  const next = orderAfter(s, lastId, (p) => s.pending.includes(p.id))[0];
  s.toActId = next.id;
  s.turnStartedAt = now;
}

/** Pokračuje po skončeném sázkovém kole: další ulice, nebo vyhodnocení ruky. */
export function advance(prev: GameState, now: number): GameState {
  if (prev.phase !== 'roundEnd') return prev;
  const s = clone(prev);
  for (const p of s.players) p.bet = 0;

  if (s.players.filter(live).length <= 1 || s.street === 'river' || s.board.length >= s.rules.boardCards) {
    finishHand(s);
    return s;
  }

  const burnAndDeal = (n: number) => {
    s.deck.pop();
    for (let i = 0; i < n; i++) s.board.push(s.deck.pop()!);
  };
  if (s.street === 'preflop') {
    s.street = 'flop';
    burnAndDeal(3);
  } else if (s.street === 'flop') {
    s.street = 'turn';
    burnAndDeal(1);
  } else {
    s.street = 'river';
    burnAndDeal(Math.max(1, s.rules.boardCards - 4));
  }
  const names = { flop: 'Flop', turn: 'Turn', river: 'River' } as const;
  addLog(s, 'street', `${names[s.street as 'flop']}: ${s.board.map(cardText).join(' ')}`);

  for (const p of s.players) if (canAct(p) && p.lastAction !== 'All in') p.lastAction = null;
  s.currentBet = 0;
  s.minRaise = s.betUnit;
  s.raisesThisStreet = 0;
  s.actedSinceFullRaise = [];
  const actors = orderAfter(s, s.dealerId, canAct);

  if (actors.length <= 1) {
    // Všichni (až na jednoho) jsou all in: karty se otočí a dorozdá se bez sázek.
    for (const p of s.players) if (live(p)) p.showCards = true;
    s.phase = 'roundEnd';
    s.toActId = null;
    return s;
  }
  s.pending = actors.map((p) => p.id);
  s.phase = 'betting';
  s.toActId = actors[0].id;
  s.turnStartedAt = now;
  return s;
}

function finishHand(s: GameState) {
  const inHand = s.players.filter((p) => p.inHand);
  const livePlayers = inHand.filter((p) => !p.folded);
  const pots = computePots(inHand.map((p) => ({ id: p.id, committed: p.committed, folded: p.folded })));
  const order = orderAfter(s, s.dealerId, (p) => p.inHand).map((p) => p.id);
  const hands: Record<string, ShowdownHand> = {};
  const scores = new Map<string, number>();
  const uncontested = livePlayers.length === 1;

  if (uncontested) {
    scores.set(livePlayers[0].id, 1);
  } else {
    for (const p of livePlayers) {
      const h = bestHandFor(p.hole, s.board, s.rules);
      scores.set(p.id, h.strength);
      hands[p.id] = { cat: h.cat, name: describeHand(h), cards: h.cards, counted: h.counted };
      p.showCards = true;
    }
  }

  // Bank, o který nikdo jiný nehraje, je nedorovnaná sázka – vrací se, nepočítá se jako výhra.
  const refunds: { id: string; amount: number }[] = [];
  const contested = uncontested
    ? pots
    : pots.filter((pot) => {
        if (pot.eligible.length !== 1) return true;
        refunds.push({ id: pot.eligible[0], amount: pot.amount });
        return false;
      });
  for (const r of refunds) {
    const p = byId(s, r.id)!;
    p.stack += r.amount;
    addLog(s, 'action', `dostává zpět ${fmt(r.amount)}`, p.name);
  }

  const { won } = awardPots(contested, scores, order);
  const winners: { id: string; amount: number }[] = [];
  for (const [id, amount] of won) {
    byId(s, id)!.stack += amount;
    winners.push({ id, amount });
  }
  winners.sort((a, b) => b.amount - a.amount);
  for (const w of winners) {
    const p = byId(s, w.id)!;
    const h = hands[w.id];
    addLog(s, 'win', `bere ${fmt(w.amount)}` + (h ? ` · ${HAND_NAMES[h.cat]}` : ''), p.name);
    p.lastAction = 'Vyhrává';
  }

  const busted = s.players.filter((p) => !p.out && p.stack === 0).sort((a, b) => b.committed - a.committed);
  if (isCash(s)) {
    // Cash game: boti hned dokoupí, lidé si sednou mimo hru, dokud nedokoupí.
    for (const p of busted) {
      if (p.isBot) {
        p.stack = s.config.startStack;
        p.buyIns++;
        addLog(s, 'info', `${p.name} dokupuje ${fmt(s.config.startStack)}`);
      } else {
        p.out = true;
        addLog(s, 'info', `${p.name} nemá žetony`);
      }
    }
  } else {
    // Vyřazení: kdo měl v ruce víc žetonů, skončí výš.
    const remaining = s.players.filter((p) => !p.out && p.stack > 0).length;
    busted.forEach((p, i) => {
      p.out = true;
      p.place = remaining + 1 + i;
      addLog(s, 'info', `${p.name} končí na ${p.place}. místě`);
    });
  }

  for (const p of s.players) {
    p.committed = 0;
    p.bet = 0;
  }
  s.showdown = { uncontested, winners, refunds, hands, eliminated: isCash(s) ? [] : busted.map((p) => p.id) };
  s.toActId = null;
  s.pending = [];

  const left = s.players.filter((p) => !p.out);
  if (!isCash(s) && left.length <= 1) {
    s.phase = 'gameOver';
    s.winnerId = left[0]?.id ?? null;
    if (left[0]) {
      left[0].place = 1;
      addLog(s, 'win', 'vyhrává turnaj', left[0].name);
    }
  } else {
    s.phase = 'handEnd';
  }
}

/** Hráč potvrdil, že si Game Changer kartu přečetl. Až potvrdí všichni, hraje se. */
export function ackEvent(prev: GameState, id: string, now: number): GameState {
  if (prev.phase !== 'reveal' || !prev.pendingAcks.includes(id)) return prev;
  const s = clone(prev);
  s.pendingAcks = s.pendingAcks.filter((x) => x !== id);
  if (!s.pendingAcks.length) {
    s.phase = s.revealNext ?? 'betting';
    s.revealNext = null;
    s.turnStartedAt = now;
  }
  return s;
}

/** Cash game: hráč bez žetonů si znovu koupí počáteční stack. */
export function rebuy(prev: GameState, id: string): GameState {
  const p = byId(prev, id);
  if (!isCash(prev) || !p || !p.out || p.stack > 0) return prev;
  const s = clone(prev);
  const q = byId(s, id)!;
  q.out = false;
  q.stack = s.config.startStack;
  q.buyIns++;
  addLog(s, 'info', `${q.name} dokupuje ${fmt(s.config.startStack)}`);
  return s;
}

/** Celkový počet žetonů ve hře (stacky + vklady v ruce). V turnaji se nemění. */
export function chipTotal(s: GameState): number {
  return s.players.reduce((sum, p) => sum + p.stack + p.committed, 0);
}
