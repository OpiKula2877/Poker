import { describe, expect, it, vi } from 'vitest';

vi.mock('peerjs', () => ({ default: class {} }));

import { createGame, makeBlindLevels, startHand } from '../engine/game';
import { DEFAULT_SETTINGS } from '../settings';
import { type Conn, HostRoom } from './host';
import { type HostMsg, PROTOCOL_VERSION, normalizeCode, parseClientMsg, viewFor } from './protocol';

class FakeConn implements Conn {
  sent: HostMsg[] = [];
  closed = false;
  send(msg: HostMsg) {
    this.sent.push(msg);
  }
  close() {
    this.closed = true;
  }
  last<T extends HostMsg['t']>(t: T) {
    return [...this.sent].reverse().find((m) => m.t === t) as Extract<HostMsg, { t: T }> | undefined;
  }
}

const hello = (name: string, token: string) => ({ t: 'hello', v: PROTOCOL_VERSION, name, token });

function sampleGame() {
  const config = { seats: 3, startStack: 1000, blinds: makeBlindLevels(20), levelMinutes: 10, turnSeconds: 20 };
  const g = createGame(
    config,
    [
      { id: 'me', name: 'Host', isBot: false },
      { id: 'g1', name: 'Eva', isBot: false },
      { id: 'bot1', name: 'Ada', isBot: true },
    ],
    42,
    0,
  );
  return startHand(g, 0);
}

describe('viewFor', () => {
  it('neprozradí cizí karty, balíček ani seed', () => {
    const g = sampleGame();
    const v = viewFor(g, 'g1');
    expect(v.seed).toBe(0);
    expect(v.deck.every((c) => c.r === 0)).toBe(true);
    expect(v.deck.length).toBe(g.deck.length);
    expect(v.players.find((p) => p.id === 'g1')!.hole).toEqual(g.players.find((p) => p.id === 'g1')!.hole);
    for (const id of ['me', 'bot1']) {
      const hole = v.players.find((p) => p.id === id)!.hole;
      expect(hole.length).toBe(2);
      expect(hole.every((c) => c.r === 0)).toBe(true);
    }
    expect(JSON.stringify(v)).not.toContain('"seed":42');
  });

  it('otočené karty při showdownu vidí všichni', () => {
    const g = sampleGame();
    g.players[0].showCards = true;
    expect(viewFor(g, 'g1').players[0].hole).toEqual(g.players[0].hole);
  });
});

describe('HostRoom', () => {
  it('přijme hráče, pošle uvítání a stav stolu', () => {
    const room = new HostRoom(DEFAULT_SETTINGS);
    const c = new FakeConn();
    room.handleMessage(c, hello('Eva', 'token-eva-123'));
    expect(c.last('welcome')).toEqual({ t: 'welcome', id: 'g1' });
    expect(c.last('room')!.room.players.map((p) => p.name)).toEqual(['Ty', 'Eva']);
  });

  it('stejné jméno dostane číslo', () => {
    const room = new HostRoom(DEFAULT_SETTINGS);
    room.handleMessage(new FakeConn(), hello('Eva', 'token-eva-111'));
    room.handleMessage(new FakeConn(), hello('Eva', 'token-eva-222'));
    expect(room.roomInfo().players.map((p) => p.name)).toEqual(['Ty', 'Eva', 'Eva 2']);
  });

  it('po startu odmítne nové hráče, ale pustí zpět známý token', () => {
    const room = new HostRoom(DEFAULT_SETTINGS);
    const c1 = new FakeConn();
    room.handleMessage(c1, hello('Eva', 'token-eva-123'));
    room.start();
    room.broadcastState(sampleGame(), false);

    const stranger = new FakeConn();
    room.handleMessage(stranger, hello('Petr', 'token-petr-123'));
    expect(stranger.last('reject')).toBeDefined();

    room.handleClose(c1);
    expect(room.isConnected('g1')).toBe(false);
    const back = new FakeConn();
    room.handleMessage(back, hello('Eva', 'token-eva-123'));
    expect(back.last('welcome')).toEqual({ t: 'welcome', id: 'g1' });
    expect(back.last('state')).toBeDefined();
    expect(room.isConnected('g1')).toBe(true);
  });

  it('hráč, který se dlouho neozval, je odpojený', () => {
    const room = new HostRoom(DEFAULT_SETTINGS);
    const c = new FakeConn();
    room.handleMessage(c, hello('Eva', 'token-eva-123'));
    room.start();
    room.checkTimeouts(Date.now() + 5000);
    expect(room.isConnected('g1')).toBe(true);
    room.checkTimeouts(Date.now() + 20000);
    expect(room.isConnected('g1')).toBe(false);
    expect(c.closed).toBe(true);
  });

  it('plný stůl odmítne', () => {
    const room = new HostRoom({ ...DEFAULT_SETTINGS, seats: 2 });
    room.handleMessage(new FakeConn(), hello('Eva', 'token-eva-123'));
    const c = new FakeConn();
    room.handleMessage(c, hello('Petr', 'token-petr-123'));
    expect(c.last('reject')!.reason).toMatch(/plný/);
  });

  it('akce předá enginu jen od připojeného hráče', () => {
    const room = new HostRoom(DEFAULT_SETTINGS);
    const onAction = vi.fn();
    room.onAction = onAction;
    const c = new FakeConn();
    room.handleMessage(new FakeConn(), { t: 'action', action: { type: 'fold' } }); // neznámé spojení
    room.handleMessage(c, hello('Eva', 'token-eva-123'));
    room.handleMessage(c, { t: 'action', action: { type: 'raise', to: 300 } });
    room.handleMessage(c, { t: 'action', action: { type: 'steal' } }); // neplatná
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('g1', { type: 'raise', to: 300 });
  });

  it('stav posílá každému jen jeho karty', () => {
    const room = new HostRoom(DEFAULT_SETTINGS);
    const c = new FakeConn();
    room.handleMessage(c, hello('Eva', 'token-eva-123'));
    const g = sampleGame();
    room.broadcastState(g, false);
    const state = c.last('state')!.game;
    expect(state.players.find((p) => p.id === 'me')!.hole.every((x) => x.r === 0)).toBe(true);
  });
});

describe('protokol', () => {
  it('kód stolu z odkazu', () => {
    expect(normalizeCode('#k7f2q')).toBe('K7F2Q');
    expect(normalizeCode('#K7F2')).toBeNull();
    expect(normalizeCode('#K0F2Q')).toBeNull(); // 0 v abecedě není
  });
  it('zahodí nesmyslné zprávy', () => {
    expect(parseClientMsg(null)).toBeNull();
    expect(parseClientMsg({ t: 'hello', name: 'x', token: 'short', v: 1 })).toBeNull();
    expect(parseClientMsg({ t: 'action', action: { type: 'raise', to: Infinity } })).toBeNull();
    expect(parseClientMsg({ t: 'chat', text: 'a'.repeat(500) })).toEqual({ t: 'chat', text: 'a'.repeat(200) });
  });
});
