import { type GameConfig, makeBlindLevels } from './engine/game';

export type PlayMode = 'bots' | 'link';
export type GameVariant = 'tournament' | 'sitngo' | 'cash';

export interface Settings {
  mode: PlayMode;
  /** Turnaj, Sit & Go turbo (rychlý turnaj), nebo cash game s dokupováním. */
  variant: GameVariant;
  name: string;
  seats: number;
  startStack: number;
  startBb: number;
  levelMinutes: number;
  turnSeconds: number;
  /** 0–2, nebo -1 = mix. */
  botLevel: number;
  /** Online: volná místa doplnit boty. */
  fillBots: boolean;
  /** Game Changer: každou ruku může změnit vylosovaná karta. */
  gameChanger: boolean;
  /** Jak často ruka dostane kartu (0–1). */
  gcChance: number;
  /** Trénink: nápověda se šancí na výhru a doporučením (jen proti botům). */
  hints: boolean;
  /** Profilový obrázek (data URL 96×96), nebo null. */
  avatar: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'bots',
  variant: 'tournament',
  name: 'Ty',
  seats: 9,
  startStack: 10000,
  startBb: 100,
  levelMinutes: 10,
  turnSeconds: 20,
  botLevel: 1,
  fillBots: true,
  gameChanger: false,
  gcChance: 0.5,
  hints: false,
  avatar: null,
};

/** Sit & Go turbo: krátký turnaj s pevným nastavením. */
export const SITNGO = { startStack: 1500, startBb: 20, levelMinutes: 3 };

export const VARIANT_NAMES: Record<GameVariant, string> = {
  tournament: 'Turnaj',
  sitngo: 'Sit & Go turbo',
  cash: 'Cash game',
};

/** Hodnoty, které se ve hře opravdu použijí (Sit & Go má vlastní předvolbu). */
export function effectiveSettings(s: Settings): Settings {
  return s.variant === 'sitngo' ? { ...s, ...SITNGO } : s;
}

export function settingsToConfig(raw: Settings, seats: number): GameConfig {
  const s = effectiveSettings(raw);
  const cash = s.variant === 'cash';
  return {
    seats,
    startStack: s.startStack,
    blinds: makeBlindLevels(s.startBb),
    levelMinutes: s.levelMinutes,
    turnSeconds: s.turnSeconds,
    variant: cash ? 'cash' : 'tournament',
    gameChanger: s.gameChanger ? { chance: s.gcChance } : null,
  };
}

export function cleanName(name: string, fallback = 'Hráč'): string {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 14);
  return n || fallback;
}
