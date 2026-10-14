import Peer, { type DataConnection } from 'peerjs';
import type { Action, GameState } from '../engine/game';
import {
  type ChatMsg,
  type ClientMsg,
  type HostMsg,
  type RoomInfo,
  PEER_PREFIX,
  PING_MS,
  PROTOCOL_VERSION,
  SILENCE_MS,
  randomToken,
} from './protocol';

export type ClientStatus = 'connecting' | 'waiting' | 'playing' | 'rejected' | 'closed' | 'error';

function storedToken(code: string): string {
  const key = 'poker.token.' + code;
  try {
    const t = localStorage.getItem(key);
    if (t) return t;
    const fresh = randomToken();
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return randomToken();
  }
}

/** Připojení hráče ke stolu hostitele. */
export class ClientRoom {
  readonly code: string;
  name: string;
  status: ClientStatus = 'connecting';
  message = '';
  myId: string | null = null;
  room: RoomInfo | null = null;
  game: GameState | null = null;
  paused = false;
  chat: ChatMsg[] = [];

  private token: string;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private lastHostMsg = 0;
  private listeners = new Set<() => void>();

  constructor(code: string, name: string) {
    this.code = code;
    this.name = name;
    this.token = storedToken(code);
  }

  static hasToken(code: string): boolean {
    try {
      return !!localStorage.getItem('poker.token.' + code);
    } catch {
      return false;
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private fail(status: ClientStatus, message: string) {
    if (this.status === 'rejected' || this.status === 'closed') return;
    this.status = status;
    this.message = message;
    clearTimeout(this.timeout);
    this.emit();
  }

  connect() {
    this.disposePeer();
    this.status = 'connecting';
    this.message = '';
    this.emit();
    const peer = new Peer({ debug: 0 });
    this.peer = peer;
    this.timeout = setTimeout(() => this.fail('error', 'Připojení trvá moc dlouho. Zkontroluj kód stolu a internet.'), 20_000);

    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + this.code, { reliable: true, serialization: 'json' });
      this.conn = conn;
      conn.on('open', () => {
        this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, token: this.token });
        this.lastHostMsg = Date.now();
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          this.send({ t: 'ping' });
          if (Date.now() - this.lastHostMsg > SILENCE_MS + 3000 && (this.status === 'waiting' || this.status === 'playing')) {
            this.fail('error', 'Hostitel neodpovídá. Možná zavřel stránku nebo ztratil internet.');
            this.disposePeer();
          }
        }, PING_MS);
      });
      conn.on('data', (raw) => this.handle(raw as HostMsg));
      conn.on('close', () => this.fail('error', 'Spojení s hostitelem se přerušilo.'));
    });
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'peer-unavailable') this.fail('error', 'Stůl s tímto kódem neexistuje, nebo už skončil.');
      else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')
        this.fail('error', 'Nepodařilo se spojit se serverem pro navázání spojení. Jsi připojený k internetu?');
      else this.fail('error', 'Připojení selhalo (' + (err.type ?? 'neznámá chyba') + ').');
    });
  }

  private handle(msg: HostMsg) {
    if (!msg || typeof msg !== 'object') return;
    this.lastHostMsg = Date.now();
    switch (msg.t) {
      case 'ping':
        return;
      case 'welcome':
        this.myId = msg.id;
        clearTimeout(this.timeout);
        if (this.status === 'connecting') this.status = 'waiting';
        break;
      case 'room':
        this.room = msg.room;
        if (this.status === 'waiting' && msg.room.started && this.game) this.status = 'playing';
        break;
      case 'state': {
        // Časy hostitele převedeme na hodiny tohoto zařízení.
        const offset = Date.now() - msg.hostNow;
        this.game = { ...msg.game, turnStartedAt: msg.game.turnStartedAt + offset, levelEndsAt: msg.game.levelEndsAt + offset };
        this.paused = msg.paused;
        if (this.status === 'waiting' || this.status === 'connecting') this.status = 'playing';
        break;
      }
      case 'chat':
        this.chat = msg.messages;
        break;
      case 'reject':
        this.fail('rejected', msg.reason);
        this.disposePeer();
        return;
      case 'closed':
        this.fail('closed', msg.reason);
        this.disposePeer();
        return;
    }
    this.emit();
  }

  private send(msg: ClientMsg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  sendAction(action: Action) {
    this.send({ t: 'action', action });
  }

  sendChat(text: string) {
    this.send({ t: 'chat', text });
  }

  private disposePeer() {
    clearInterval(this.heartbeat);
    const peer = this.peer;
    this.peer = null;
    this.conn = null;
    if (peer) setTimeout(() => peer.destroy(), 200);
  }

  leave() {
    this.send({ t: 'leave' });
    this.status = 'closed';
    clearTimeout(this.timeout);
    this.disposePeer();
    this.emit();
  }
}
