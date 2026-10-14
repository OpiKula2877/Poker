import { useCallback, useEffect, useRef, useState } from 'react';
import { decideBotAction } from '../bots/bot';
import { createRng, randomSeed, shuffle } from '../engine/cards';
import {
  type Action,
  type GameState,
  type PlayerSetup,
  advance,
  applyAction,
  createGame,
  legalActions,
  makeBlindLevels,
  startHand,
} from '../engine/game';

export const HERO_ID = 'me';

export interface Settings {
  name: string;
  seats: number;
  startStack: number;
  startBb: number;
  levelMinutes: number;
  turnSeconds: number;
  /** 0–2, nebo -1 = mix. */
  botLevel: number;
}

export const DEFAULT_SETTINGS: Settings = {
  name: 'Ty',
  seats: 9,
  startStack: 10000,
  startBb: 100,
  levelMinutes: 10,
  turnSeconds: 20,
  botLevel: 1,
};

const BOT_NAMES = ['Ada', 'Viktor', 'Hugo', 'Klára', 'Marek', 'Tomáš', 'Jana', 'Luka', 'Eva', 'Petr', 'Ema', 'Ondra'];

export type PreAction = 'checkfold' | 'callany' | null;

export interface HeroStats {
  maxStack: number;
  bestCat: number;
  handsPlayed: number;
  startedAt: number;
  endedAt: number | null;
  /** Snímek ruky, ve které hráč vypadl. */
  lastHand: GameState | null;
}

function setupGame(settings: Settings): GameState {
  const seed = randomSeed();
  const rng = createRng(seed ^ 0x5bd1e995);
  const names = shuffle(BOT_NAMES, rng);
  const players: PlayerSetup[] = [{ id: HERO_ID, name: settings.name.trim() || 'Ty', isBot: false }];
  for (let i = 1; i < settings.seats; i++) {
    players.push({
      id: 'bot' + i,
      name: names[i - 1],
      isBot: true,
      botLevel: settings.botLevel < 0 ? i % 3 : settings.botLevel,
    });
  }
  return createGame(
    {
      seats: settings.seats,
      startStack: settings.startStack,
      blinds: makeBlindLevels(settings.startBb),
      levelMinutes: settings.levelMinutes,
      turnSeconds: settings.turnSeconds,
    },
    players,
    seed,
    Date.now(),
  );
}

/** Herní smyčka pro hru proti botům: tahy botů, časový limit, přechody mezi koly. */
export function useGame(settings: Settings) {
  const [game, setGame] = useState<GameState>(() => setupGame(settings));
  const [paused, setPaused] = useState(false);
  const [preAction, setPreAction] = useState<PreAction>(null);
  const rngRef = useRef(createRng(randomSeed()));
  const pausedAt = useRef(0);
  const stats = useRef<HeroStats>({
    maxStack: settings.startStack,
    bestCat: -1,
    handsPlayed: 0,
    startedAt: Date.now(),
    endedAt: null,
    lastHand: null,
  });

  const hero = game.players.find((p) => p.id === HERO_ID)!;
  const heroOut = hero.out;

  // Statistiky hráče.
  useEffect(() => {
    const st = stats.current;
    st.maxStack = Math.max(st.maxStack, hero.stack);
    if (game.phase === 'handEnd' || game.phase === 'gameOver') {
      const h = game.showdown?.hands[HERO_ID];
      if (h) st.bestCat = Math.max(st.bestCat, h.cat);
      if (!st.endedAt && (hero.out || game.phase === 'gameOver')) {
        st.endedAt = Date.now();
        st.lastHand = game;
        st.handsPlayed = game.handNo;
      }
    }
  }, [game, hero]);

  useEffect(() => {
    if (paused) return;
    const fast = heroOut;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const g = game;
    const rng = rngRef.current;

    if (g.phase === 'waiting') {
      timer = setTimeout(() => setGame((x) => (x.phase === 'waiting' ? startHand(x, Date.now()) : x)), 500);
    } else if (g.phase === 'handEnd') {
      timer = setTimeout(
        () => {
          setPreAction(null);
          setGame((x) => (x.phase === 'handEnd' ? startHand(x, Date.now()) : x));
        },
        fast ? 1600 : g.showdown?.uncontested ? 1800 : 3600,
      );
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
              return applyAction(x, id, decideBotAction(x, id, rng), Date.now());
            }),
          delay,
        );
      } else {
        const legal = legalActions(g, id);
        if (preAction && legal) {
          const a: Action =
            preAction === 'checkfold' ? (legal.canCheck ? { type: 'check' } : { type: 'fold' }) : legal.canCheck ? { type: 'check' } : { type: 'call' };
          timer = setTimeout(() => {
            setPreAction(null);
            setGame((x) => (x.toActId === id ? applyAction(x, id, a, Date.now()) : x));
          }, 250);
        } else {
          const left = g.config.turnSeconds * 1000 - (Date.now() - g.turnStartedAt);
          timer = setTimeout(
            () =>
              setGame((x) => {
                if (x.toActId !== id || x.turnStartedAt !== g.turnStartedAt) return x;
                const l = legalActions(x, id);
                return applyAction(x, id, l?.canCheck ? { type: 'check' } : { type: 'fold' }, Date.now());
              }),
            Math.max(0, left),
          );
        }
      }
    }
    return () => clearTimeout(timer);
  }, [game, paused, heroOut, preAction]);

  const act = useCallback((a: Action) => {
    setGame((x) => (x.phase === 'betting' && x.toActId === HERO_ID ? applyAction(x, HERO_ID, a, Date.now()) : x));
  }, []);

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

  const restart = useCallback(() => {
    setGame(setupGame(settings));
    setPaused(false);
    setPreAction(null);
    stats.current = { maxStack: settings.startStack, bestCat: -1, handsPlayed: 0, startedAt: Date.now(), endedAt: null, lastHand: null };
  }, [settings]);

  return { game, act, paused, togglePause, preAction, setPreAction, stats: stats.current, restart };
}
