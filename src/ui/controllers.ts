import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Action, type GameState, legalActions } from '../engine/game';
import type { ClientRoom } from '../net/client';
import { HOST_PLAYER_ID, type HostRoom } from '../net/host';
import type { ChatMsg } from '../net/protocol';
import { type Settings, cleanName, settingsToConfig } from '../settings';
import { type HeroStats, type PreAction, HERO_ID, buildGame, useEngine, useHeroStats } from './useGame';

/** Co obrazovka stolu potřebuje – stejné pro hru offline, hostitele i připojeného hráče. */
export interface GameController {
  game: GameState | null;
  heroId: string;
  act: (a: Action) => void;
  paused: boolean;
  togglePause?: () => void;
  preAction: PreAction;
  setPreAction: (p: PreAction) => void;
  stats: HeroStats;
  restart?: () => void;
  /** Hráči, kteří ztratili spojení. */
  away: Set<string>;
  chat?: { messages: ChatMsg[]; send: (text: string) => void };
  online?: { code: string; role: 'host' | 'guest' };
}

/** Překreslí komponentu při každé změně stolu / připojení. */
export function useSubscribe(obj: { subscribe(fn: () => void): () => void } | null) {
  const [, setV] = useState(0);
  useEffect(() => (obj ? obj.subscribe(() => setV((v) => v + 1)) : undefined), [obj]);
}

export function useLocalController(settings: Settings): GameController {
  const make = useCallback(
    () => buildGame(settingsToConfig(settings, settings.seats), [{ id: HERO_ID, name: cleanName(settings.name, 'Ty') }], settings.botLevel),
    [settings],
  );
  const engine = useEngine(make, { heroId: HERO_ID });
  const stats = useHeroStats(engine.game, HERO_ID);
  const away = useMemo(() => new Set<string>(), []);
  return {
    game: engine.game,
    heroId: HERO_ID,
    act: engine.act,
    paused: engine.paused,
    togglePause: engine.togglePause,
    preAction: engine.preAction,
    setPreAction: engine.setPreAction,
    stats,
    restart: () => engine.reset(make()),
    away,
  };
}

function hostGame(room: HostRoom, settings: Settings): GameState {
  const humans = room
    .roomInfo()
    .players.filter((p) => p.connected)
    .map((p) => ({ id: p.id, name: p.name }));
  const seats = settings.fillBots ? Math.max(settings.seats, humans.length) : Math.max(2, humans.length);
  return buildGame(settingsToConfig(settings, seats), humans, settings.botLevel);
}

export function useHostController(room: HostRoom, settings: Settings): GameController {
  useSubscribe(room);
  const away = new Set(room.roomInfo().players.filter((p) => !p.connected).map((p) => p.id));
  const engine = useEngine(() => hostGame(room, settings), {
    heroId: HOST_PLAYER_ID,
    isAway: (id) => !room.isConnected(id),
    awayKey: [...away].sort().join(),
    onState: (g, paused) => room.broadcastState(g, paused),
  });
  const { actFor } = engine;
  useEffect(() => {
    room.onAction = actFor;
    return () => {
      room.onAction = undefined;
    };
  }, [room, actFor]);
  const stats = useHeroStats(engine.game, HOST_PLAYER_ID);
  return {
    game: engine.game,
    heroId: HOST_PLAYER_ID,
    act: engine.act,
    paused: engine.paused,
    togglePause: engine.togglePause,
    preAction: engine.preAction,
    setPreAction: engine.setPreAction,
    stats,
    restart: () => engine.reset(hostGame(room, settings)),
    away,
    chat: { messages: room.chat, send: (t) => room.addChat(room.hostName, t) },
    online: { code: room.code, role: 'host' },
  };
}

export function useClientController(room: ClientRoom): GameController {
  useSubscribe(room);
  const [preAction, setPreAction] = useState<PreAction>(null);
  const game = room.game;
  const heroId = room.myId ?? '';
  const stats = useHeroStats(game, heroId);

  // Předvolba tahu se odešle hned, jak je hráč na tahu.
  useEffect(() => {
    if (!game || !preAction) return;
    const legal = legalActions(game, heroId);
    if (!legal) return;
    const a: Action =
      preAction === 'checkfold' ? (legal.canCheck ? { type: 'check' } : { type: 'fold' }) : legal.canCheck ? { type: 'check' } : { type: 'call' };
    setPreAction(null);
    room.sendAction(a);
  }, [game, preAction, heroId, room]);

  // Nová ruka → předvolba se ruší.
  const handNo = game?.handNo;
  useEffect(() => setPreAction(null), [handNo]);

  const away = new Set((room.room?.players ?? []).filter((p) => !p.connected).map((p) => p.id));
  return {
    game,
    heroId,
    act: (a) => room.sendAction(a),
    paused: room.paused,
    preAction,
    setPreAction,
    stats,
    away,
    chat: { messages: room.chat, send: (t) => room.sendChat(t) },
    online: { code: room.code, role: 'guest' },
  };
}
