import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { botExchange, decideBotAction } from '../bots/bot';
import { createRng, cryptoRandom, randomSeed, shuffle } from '../engine/cards';
import {
  type Action,
  type GameConfig,
  type GameState,
  type PlayerSetup,
  ackEvent,
  advance,
  buyCard,
  canBuyCard,
  exchangeCards,
  applyAction,
  createGame,
  legalActions,
  rebuy,
  startHand,
  turnSecondsOf,
} from '../engine/game';

export const HERO_ID = 'me';

/** Kdo sedí u tohoto zařízení (hostitel 'me', host online 'g1'…). */
export const HeroContext = createContext<string>(HERO_ID);
export const useHeroId = () => useContext(HeroContext);

const BOT_NAMES = ['Ada', 'Viktor', 'Hugo', 'Klára', 'Marek', 'Tomáš', 'Jana', 'Luka', 'Eva', 'Petr', 'Ema', 'Ondra'];

export type PreAction = 'checkfold' | 'callany' | null;

/** Lidé u stolu + boti do zadaného počtu míst. */
export function buildGame(config: GameConfig, humans: { id: string; name: string }[], botLevel: number): GameState {
  const seed = randomSeed();
  const rng = createRng(seed ^ 0x5bd1e995);
  const taken = new Set(humans.map((h) => h.name));
  const names = shuffle(
    BOT_NAMES.filter((n) => !taken.has(n)),
    rng,
  );
  const players: PlayerSetup[] = humans.map((h) => ({ id: h.id, name: h.name, isBot: false }));
  for (let i = 1; players.length < config.seats; i++) {
    players.push({ id: 'bot' + i, name: names[(i - 1) % names.length], isBot: true, botLevel: botLevel < 0 ? i % 3 : botLevel });
  }
  return createGame(config, players, seed, Date.now());
}

/** Bezpečné provedení akce (neplatná akce od vzdáleného hráče stav nezmění). */
function tryApply(x: GameState, id: string, a: Action): GameState {
  if (x.phase !== 'betting' || x.toActId !== id) return x;
  try {
    return applyAction(x, id, a, Date.now());
  } catch {
    return x;
  }
}

interface EngineOptions {
  heroId: string;
  /** Odpojený hráč: místo celého limitu se za něj rozhodne po pár sekundách. */
  isAway?: (id: string) => boolean;
  /** Mění se, když se někdo odpojí/připojí → tah se přeplánuje. */
  awayKey?: string;
  onState?: (game: GameState, paused: boolean) => void;
}

/** Herní smyčka u hostitele (nebo offline): tahy botů, časové limity, přechody mezi koly. */
export function useEngine(initial: () => GameState, opts: EngineOptions) {
  const { heroId } = opts;
  const [game, setGame] = useState<GameState>(initial);
  const [paused, setPaused] = useState(false);
  const [preAction, setPreAction] = useState<PreAction>(null);
  const rngRef = useRef(createRng(randomSeed()));
  const pausedAt = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const hero = game.players.find((p) => p.id === heroId);
  const heroOut = hero?.out ?? true;

  useEffect(() => {
    optsRef.current.onState?.(game, paused);
  }, [game, paused]);

  useEffect(() => {
    if (paused) return;
    const fast = heroOut && !game.players.some((p) => !p.isBot && !p.out && p.id !== heroId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const g = game;
    const rng = rngRef.current;

    if (g.phase === 'waiting') {
      timer = setTimeout(() => setGame((x) => (x.phase === 'waiting' ? startHand(x, Date.now(), cryptoRandom) : x)), 800);
    } else if (g.phase === 'handEnd') {
      timer = setTimeout(
        () => {
          setPreAction(null);
          setGame((x) => (x.phase === 'handEnd' ? startHand(x, Date.now(), cryptoRandom) : x));
        },
        fast ? 1600 : g.showdown?.uncontested ? 1800 : 3600,
      );
    } else if (g.phase === 'reveal') {
      // Odpojení hráči kartu potvrdit nemůžou – potvrdí se za ně.
      const gone = g.pendingAcks.filter((id) => optsRef.current.isAway?.(id));
      if (gone.length) timer = setTimeout(() => setGame((x) => gone.reduce((y, id) => ackEvent(y, id, Date.now()), x)), 300);
    } else if (g.phase === 'exchange') {
      // Draw: boti a odpojení hráči vymění hned, ostatní mají čas na tah.
      const auto = g.pendingExchange.filter((id) => g.players.find((p) => p.id === id)?.isBot || optsRef.current.isAway?.(id));
      if (auto.length) {
        timer = setTimeout(
          () => setGame((x) => auto.reduce((y, id) => exchangeCards(y, id, y.players.find((p) => p.id === id)?.isBot ? botExchange(y, id) : [], Date.now()), x)),
          fast ? 300 : 900,
        );
      } else {
        const left = turnSecondsOf(g) * 1000 - (Date.now() - g.turnStartedAt);
        timer = setTimeout(() => setGame((x) => x.pendingExchange.reduce((y, id) => exchangeCards(y, id, [], Date.now()), x)), Math.max(0, left));
      }
    } else if (g.phase === 'roundEnd') {
      const runout = g.players.some((p) => p.showCards) && g.street !== 'river';
      timer = setTimeout(() => setGame((x) => (x.phase === 'roundEnd' ? advance(x, Date.now()) : x)), runout ? 1300 : fast ? 450 : 750);
    } else if (g.phase === 'betting' && g.toActId) {
      const id = g.toActId;
      const p = g.players.find((x) => x.id === id)!;
      if (p.isBot) {
        const delay = fast ? 250 + rng() * 400 : 550 + rng() * 950;
        timer = setTimeout(
          () =>
            setGame((x) => {
              if (x.phase !== 'betting' || x.toActId !== id) return x;
              // Dokup kartu: bot si občas přikoupí.
              const y = canBuyCard(x, id) && rng() < 0.35 ? buyCard(x, id) : x;
              return tryApply(y, id, decideBotAction(y, id, rng));
            }),
          delay,
        );
      } else {
        const legal = legalActions(g, id);
        if (id === heroId && preAction && legal) {
          const a: Action =
            preAction === 'checkfold' ? (legal.canCheck ? { type: 'check' } : { type: 'fold' }) : legal.canCheck ? { type: 'check' } : { type: 'call' };
          timer = setTimeout(() => {
            setPreAction(null);
            setGame((x) => tryApply(x, id, a));
          }, 250);
        } else {
          let left = turnSecondsOf(g) * 1000 - (Date.now() - g.turnStartedAt);
          if (optsRef.current.isAway?.(id)) left = Math.min(left, 2500);
          timer = setTimeout(
            () =>
              setGame((x) => {
                if (x.toActId !== id || x.turnStartedAt !== g.turnStartedAt) return x;
                const l = legalActions(x, id);
                return tryApply(x, id, l?.canCheck ? { type: 'check' } : { type: 'fold' });
              }),
            Math.max(0, left),
          );
        }
      }
    }
    return () => clearTimeout(timer);
  }, [game, paused, heroOut, preAction, heroId, opts.awayKey]);

  const actFor = useCallback((id: string, a: Action) => setGame((x) => tryApply(x, id, a)), []);
  const rebuyFor = useCallback((id: string) => setGame((x) => rebuy(x, id)), []);
  const ackFor = useCallback((id: string) => setGame((x) => ackEvent(x, id, Date.now())), []);
  const exchangeFor = useCallback((id: string, idx: number[]) => setGame((x) => exchangeCards(x, id, idx, Date.now())), []);
  const buyCardFor = useCallback((id: string) => setGame((x) => buyCard(x, id)), []);
  const act = useCallback((a: Action) => actFor(heroId, a), [actFor, heroId]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (!p) {
        pausedAt.current = Date.now();
      } else {
        const d = Date.now() - pausedAt.current;
        setGame((x) => ({ ...x, levelEndsAt: x.levelEndsAt + d, turnStartedAt: x.turnStartedAt + d }));
      }
      return !p;
    });
  }, []);

  const reset = useCallback((next: GameState) => {
    setGame(next);
    setPaused(false);
    setPreAction(null);
  }, []);

  return { game, act, actFor, rebuyFor, ackFor, exchangeFor, buyCardFor, paused, togglePause, preAction, setPreAction, reset };
}

// ---------- statistiky hráče ----------

export interface HeroStats {
  maxStack: number;
  bestCat: number;
  handsPlayed: number;
  startedAt: number;
  endedAt: number | null;
  /** Snímek ruky, ve které hráč vypadl. */
  lastHand: GameState | null;
}

export function useHeroStats(game: GameState | null, heroId: string): HeroStats {
  const fresh = (): HeroStats => ({ maxStack: 0, bestCat: -1, handsPlayed: 0, startedAt: Date.now(), endedAt: null, lastHand: null });
  const stats = useRef<HeroStats>(fresh());
  const gameId = useRef<string | null>(null);

  // Nová hra → statistiky od nuly.
  if (game && game.gameId !== gameId.current) {
    gameId.current = game.gameId;
    stats.current = fresh();
  }

  useEffect(() => {
    if (!game) return;
    const hero = game.players.find((p) => p.id === heroId);
    if (!hero) return;
    const st = stats.current;
    st.maxStack = Math.max(st.maxStack, hero.stack + hero.committed);
    if (game.phase === 'handEnd' || game.phase === 'gameOver') {
      const h = game.showdown?.hands[heroId];
      if (h) st.bestCat = Math.max(st.bestCat, h.cat);
      if (!st.endedAt && (hero.out || game.phase === 'gameOver')) {
        st.endedAt = Date.now();
        st.lastHand = game;
        st.handsPlayed = game.handNo;
      }
    }
  }, [game, heroId]);

  return stats.current;
}
