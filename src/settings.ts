import { type GameConfig, makeBlindLevels } from './engine/game';

export type PlayMode = 'bots' | 'link';

export interface Settings {
  mode: PlayMode;
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
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'bots',
  name: 'Ty',
  seats: 9,
  startStack: 10000,
  startBb: 100,
  levelMinutes: 10,
  turnSeconds: 20,
  botLevel: 1,
  fillBots: true,
};

export function settingsToConfig(s: Settings, seats: number): GameConfig {
  return {
    seats,
    startStack: s.startStack,
    blinds: makeBlindLevels(s.startBb),
    levelMinutes: s.levelMinutes,
    turnSeconds: s.turnSeconds,
  };
}

export function cleanName(name: string, fallback = 'Hráč'): string {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 14);
  return n || fallback;
}
