import { type Card, cardId } from '../engine/cards';
import type { Action, GameState } from '../engine/game';
import type { Settings } from '../settings';

export const PROTOCOL_VERSION = 1;
/** Předpona ID na zprostředkovacím serveru PeerJS, aby se kódy nepletly s cizími aplikacemi. */
export const PEER_PREFIX = 'okpoker-';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez 0/O, 1/I/L
export const CODE_LENGTH = 5;

export function makeRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return code;
}

export function normalizeCode(text: string): string | null {
  const code = text.replace(/^#\/?/, '').trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export function joinLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${code}`;
}

export interface RoomPlayer {
  id: string;
  name: string;
  /** Profilový obrázek (malé JPEG data URL), nebo null. */
  avatar?: string | null;
  connected: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  code: string;
  players: RoomPlayer[];
  settings: Settings;
  started: boolean;
}

export interface ChatMsg {
  n: number;
  from: string;
  text: string;
}

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; token: string; avatar?: string | null }
  | { t: 'action'; action: Action }
  | { t: 'chat'; text: string }
  | { t: 'leave' }
  | { t: 'ping' }
  | { t: 'rebuy' }
  | { t: 'ack' }
  | { t: 'discard'; idx: number[] }
  | { t: 'buycard' };

/** Jak často si strany posílají ping a po jaké době ticha se spojení bere jako ztracené. */
export const PING_MS = 3000;
export const SILENCE_MS = 9000;

export type HostMsg =
  | { t: 'welcome'; id: string }
  | { t: 'reject'; reason: string }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; game: GameState; paused: boolean; hostNow: number }
  | { t: 'chat'; messages: ChatMsg[] }
  | { t: 'closed'; reason: string }
  | { t: 'ping' };

const HIDDEN: Card = { r: 0, s: 's' };

/**
 * Stav hry tak, jak ho smí vidět jeden hráč: cizí karty v ruce, balíček
 * a seed (z něj by šel balíček dopočítat) se nahradí prázdnými hodnotami.
 */
export function viewFor(s: GameState, playerId: string): GameState {
  const done = s.phase === 'handEnd' || s.phase === 'gameOver';
  // Naslepo: před flopem nevidí své karty ani hráč sám.
  const blindNow = s.rules.hideOwnPreflop && s.street === 'preflop' && !done;
  const me = s.players.find((p) => p.id === playerId);
  // Černá kočka: kterou kartu má, ví jen majitel.
  const ownsCat = !!s.rules.catCard && !!me?.hole.some((c) => cardId(c) === s.rules.catCard);
  return {
    ...s,
    seed: 0,
    deck: s.deck.map(() => HIDDEN),
    // Skrytá river: karta leží rubem až do vyhodnocení.
    board: done ? s.board : s.board.map((c, i) => (s.rules.hiddenBoard.includes(i) ? HIDDEN : c)),
    rules: ownsCat || done ? s.rules : { ...s.rules, catCard: s.rules.catCard ? '?' : null },
    players: s.players.map((p) => {
      if (p.showCards || s.rules.openHands || (p.id === playerId && !blindNow)) return p;
      // Odhalená karta: první karta každého je vidět všem.
      return { ...p, hole: p.hole.map((c, i) => (s.rules.revealFirst && i === 0 && p.inHand ? c : HIDDEN)) };
    }),
  };
}

/** Ověří zprávu od klienta; cokoli podezřelého zahodí. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      if (typeof m.name !== 'string' || typeof m.token !== 'string' || typeof m.v !== 'number') return null;
      if (m.token.length < 8 || m.token.length > 64) return null;
      return { t: 'hello', v: m.v, name: m.name.slice(0, 40), token: m.token, avatar: cleanAvatar(m.avatar) };
    case 'action': {
      const a = m.action as Record<string, unknown> | undefined;
      if (!a || typeof a !== 'object') return null;
      if (a.type === 'fold' || a.type === 'check' || a.type === 'call' || a.type === 'allin') return { t: 'action', action: { type: a.type } };
      if (a.type === 'raise' && typeof a.to === 'number' && Number.isFinite(a.to)) return { t: 'action', action: { type: 'raise', to: a.to } };
      return null;
    }
    case 'chat':
      if (typeof m.text !== 'string') return null;
      return { t: 'chat', text: m.text.slice(0, 200) };
    case 'leave':
      return { t: 'leave' };
    case 'ping':
      return { t: 'ping' };
    case 'rebuy':
      return { t: 'rebuy' };
    case 'ack':
      return { t: 'ack' };
    case 'buycard':
      return { t: 'buycard' };
    case 'discard':
      if (!Array.isArray(m.idx)) return null;
      return { t: 'discard', idx: m.idx.filter((i): i is number => Number.isInteger(i)).slice(0, 2) };
    default:
      return null;
  }
}

/** Profilový obrázek: jen malé obrázkové data URL, cokoli jiného se zahodí. */
export const AVATAR_MAX = 40_000;
export function cleanAvatar(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > AVATAR_MAX) return null;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : null;
}

export function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
