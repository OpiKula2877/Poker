import { useState } from 'react';
import { BOT_LEVEL_NAMES } from '../bots/bot';
import type { ClientRoom } from '../net/client';
import { useSubscribe } from './controllers';
import { Icon, fmt } from './parts';

interface Props {
  code: string;
  room: ClientRoom | null;
  defaultName: string;
  onConnect: (name: string) => void;
  onRetry: () => void;
  onBack: () => void;
}

/** Obrazovka pro hráče, který přišel přes odkaz: jméno → připojení → čekárna. */
export function JoinScreen({ code, room, defaultName, onConnect, onRetry, onBack }: Props) {
  useSubscribe(room);
  const [name, setName] = useState(defaultName);

  let body;
  if (!room) {
    body = (
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          onConnect(name);
        }}
      >
        <label className="lab" htmlFor="jname">
          TVOJE JMÉNO U STOLU
        </label>
        <input id="jname" className="field" maxLength={14} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <button type="submit" className="btn primary" style={{ height: 56 }}>
          {Icon.link(20)} Připojit se ke stolu
        </button>
      </form>
    );
  } else if (room.status === 'connecting') {
    body = <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>Připojuji se ke stolu…</p>;
  } else if (room.status === 'waiting' || (room.status === 'playing' && !room.game)) {
    const s = room.room?.settings;
    const players = room.room?.players ?? [];
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>Jsi u stolu. Čeká se, až hostitel spustí turnaj.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {players.map((p, i) => (
            <div key={p.id} className={'wrow' + (p.id === room.myId ? ' me' : '')}>
              <span style={{ width: 18, fontSize: 12, color: 'var(--muted)' }}>{i + 1}</span>
              <span className={'st ' + (p.connected ? 'on' : 'away')} />
              <span className="wn">{p.name}</span>
              <span className="ws">{p.isHost ? 'hostitel' : p.id === room.myId ? 'ty' : 'online'}</span>
            </div>
          ))}
        </div>
        {s && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {fmt(s.startStack)} žetonů · blindy {s.startBb / 2}/{s.startBb} · +1 level po {s.levelMinutes} min · {s.turnSeconds} s na tah
            {s.fillBots ? ` · volná místa doplní boti (${BOT_LEVEL_NAMES[Math.max(0, s.botLevel)].toLowerCase()})` : ''}
          </span>
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="note" style={{ color: 'var(--text)' }}>
          {room.message || 'Spojení skončilo.'}
        </div>
        {room.status !== 'closed' && (
          <button type="button" className="btn primary" onClick={onRetry}>
            Zkusit znovu
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="lobby">
      <header className="topbar" style={{ position: 'relative' }}>
        <div className="brand" style={{ flexGrow: 1 }}>
          <span className="sq" />
          <b>POKER</b>
          <span>Připojení ke stolu</span>
        </div>
        <button type="button" className="tb" onClick={onBack}>
          {Icon.exit(16)} Do lobby
        </button>
      </header>
      <main style={{ justifyContent: 'center' }}>
        <section
          style={{
            width: 560,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            padding: 32,
            marginTop: 60,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)' }}>POZVÁNKA KE STOLU</span>
            <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, letterSpacing: '0.04em' }}>{code}</h1>
          </div>
          {body}
        </section>
      </main>
    </div>
  );
}
