import Peer, { type DataConnection } from 'peerjs';
import type { Action, GameState } from '../engine/game';
import { type Settings, cleanName } from '../settings';
import {
  type ChatMsg,
  type HostMsg,
  type RoomInfo,
  PEER_PREFIX,
  PING_MS,
  PROTOCOL_VERSION,
  SILENCE_MS,
  makeRoomCode,
  parseClientMsg,
  viewFor,
} from './protocol';

export const HOST_PLAYER_ID = 'me';

/** Jedno spojení s hráčem (PeerJS DataConnection, v testech náhrada). */
export interface Conn {
  send(msg: HostMsg): void;
  close(): void;
}

interface Guest {
  id: string;
  name: string;
  token: string;
  conn: Conn | null;
  lastSeen: number;
}

export type HostStatus = 'opening' | 'open' | 'error' | 'closed';

/**
 * Stůl u hostitele: přijímá hráče, rozesílá jim stav hry (každému jen jeho karty)
 * a předává jejich akce hernímu enginu, který běží u hostitele.
 */
export class HostRoom {
  code = makeRoomCode();
  status: HostStatus = 'opening';
  error = '';
  started = false;
  guests: Guest[] = [];
  chat: ChatMsg[] = [];
  /** Herní smyčka si sem zaregistruje příjem akcí. */
  onAction?: (playerId: string, action: Action) => void;
  /** Cash game: hráč chce dokoupit žetony. */
  onRebuy?: (playerId: string) => void;

  private settings: Settings;
  private peer: Peer | null = null;
  private guestSeq = 0;
  private chatSeq = 0;
  private lastState: { game: GameState; paused: boolean } | null = null;
  private listeners = new Set<() => void>();
  private heartbeat: ReturnType<typeof setInterval> | undefined;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  get hostName() {
    return cleanName(this.settings.name, 'Hostitel');
  }

  /** Zaregistruje stůl na zprostředkovacím serveru PeerJS. */
  open(attempt = 0) {
    this.status = 'opening';
    this.emit();
    const peer = new Peer(PEER_PREFIX + this.code, { debug: 0 });
    this.peer = peer;
    peer.on('open', () => {
      this.status = 'open';
      this.emit();
    });
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      this.broadcast({ t: 'ping' });
      this.checkTimeouts();
    }, PING_MS);
    peer.on('connection', (dc) => this.attach(dc));
    peer.on('disconnected', () => {
      // Spojení se zprostředkovatelem spadlo; stávající hráči fungují dál, noví by se nepřipojili.
      if (this.status === 'open') peer.reconnect();
    });
    peer.on('error', (err: { type?: string; message?: string }) => {
      if (err.type === 'unavailable-id' && attempt < 5) {
        peer.destroy();
        this.code = makeRoomCode();
        this.open(attempt + 1);
        return;
      }
      if (err.type === 'peer-unavailable') return; // týká se jen jednoho hráče
      this.status = 'error';
      this.error =
        err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error'
          ? 'Nepodařilo se spojit se serverem pro navázání spojení. Jsi připojený k internetu?'
          : 'Stůl se nepodařilo otevřít (' + (err.type ?? err.message ?? 'neznámá chyba') + ').';
      this.emit();
    });
  }

  private attach(dc: DataConnection) {
    const conn: Conn = {
      send: (msg) => {
        if (dc.open) dc.send(msg);
      },
      close: () => dc.close(),
    };
    dc.on('data', (raw) => this.handleMessage(conn, raw));
    dc.on('close', () => this.handleClose(conn));
    dc.on('error', () => this.handleClose(conn));
  }

  /** Zpracuje zprávu od hráče (veřejné kvůli testům). */
  handleMessage(conn: Conn, raw: unknown) {
    const msg = parseClientMsg(raw);
    if (!msg) return;
    const guest = this.guests.find((g) => g.conn === conn);
    if (guest) guest.lastSeen = Date.now();
    if (msg.t === 'ping') return;

    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) {
        conn.send({ t: 'reject', reason: 'Máš jinou verzi hry. Načti stránku znovu.' });
        return;
      }
      const known = this.guests.find((g) => g.token === msg.token);
      if (known) {
        if (known.conn && known.conn !== conn) known.conn.close();
        known.conn = conn;
        known.lastSeen = Date.now();
      } else {
        if (this.started) {
          conn.send({ t: 'reject', reason: 'Turnaj už běží. Počkej na další hru.' });
          return;
        }
        if (this.guests.length + 1 >= this.settings.seats) {
          conn.send({ t: 'reject', reason: 'Stůl je plný.' });
          return;
        }
        this.guests.push({ id: 'g' + ++this.guestSeq, name: this.uniqueName(cleanName(msg.name)), token: msg.token, conn, lastSeen: Date.now() });
      }
      const g = this.guests.find((x) => x.conn === conn)!;
      conn.send({ t: 'welcome', id: g.id });
      conn.send({ t: 'chat', messages: this.chat });
      if (this.lastState) this.sendState(g);
      this.broadcastRoom();
      this.emit();
      return;
    }

    if (!guest) return;
    if (msg.t === 'action') this.onAction?.(guest.id, msg.action);
    else if (msg.t === 'chat') this.addChat(guest.name, msg.text);
    else if (msg.t === 'leave') this.handleClose(conn);
    else if (msg.t === 'rebuy') this.onRebuy?.(guest.id);
  }

  /** Kdo se dlouho neozval, je odpojený (zavřená karta se přes WebRTC nemusí ohlásit hned). */
  checkTimeouts(now = Date.now()) {
    for (const g of this.guests) {
      if (g.conn && now - g.lastSeen > SILENCE_MS) {
        const c = g.conn;
        this.handleClose(c);
        c.close();
      }
    }
  }

  handleClose(conn: Conn) {
    const g = this.guests.find((x) => x.conn === conn);
    if (!g) return;
    g.conn = null;
    if (!this.started) this.guests = this.guests.filter((x) => x !== g);
    this.broadcastRoom();
    this.emit();
  }

  private uniqueName(name: string): string {
    const taken = new Set([this.hostName, ...this.guests.map((g) => g.name)]);
    if (!taken.has(name)) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
  }

  isConnected(id: string): boolean {
    if (id === HOST_PLAYER_ID) return true;
    return !!this.guests.find((g) => g.id === id)?.conn;
  }

  roomInfo(): RoomInfo {
    return {
      code: this.code,
      settings: this.settings,
      started: this.started,
      players: [
        { id: HOST_PLAYER_ID, name: this.hostName, connected: true, isHost: true },
        ...this.guests.map((g) => ({ id: g.id, name: g.name, connected: !!g.conn, isHost: false })),
      ],
    };
  }

  private broadcast(msg: HostMsg) {
    for (const g of this.guests) g.conn?.send(msg);
  }

  private broadcastRoom() {
    this.broadcast({ t: 'room', room: this.roomInfo() });
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
    this.broadcastRoom();
    this.emit();
  }

  start() {
    this.started = true;
    this.broadcastRoom();
    this.emit();
  }

  private sendState(g: Guest) {
    if (!this.lastState || !g.conn) return;
    g.conn.send({ t: 'state', game: viewFor(this.lastState.game, g.id), paused: this.lastState.paused, hostNow: Date.now() });
  }

  broadcastState(game: GameState, paused: boolean) {
    this.lastState = { game, paused };
    for (const g of this.guests) this.sendState(g);
  }

  addChat(from: string, text: string) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    this.chat = [...this.chat, { n: ++this.chatSeq, from, text: t }].slice(-50);
    this.broadcast({ t: 'chat', messages: this.chat });
    this.emit();
  }

  close(reason = 'Hostitel ukončil hru.') {
    this.broadcast({ t: 'closed', reason });
    this.status = 'closed';
    clearInterval(this.heartbeat);
    // Zpráva musí odejít dřív, než se spojení zavře.
    setTimeout(() => this.peer?.destroy(), 300);
    this.emit();
  }
}
