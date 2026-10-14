import { useState } from 'react';
import { BOT_LEVEL_NAMES } from '../bots/bot';
import { HOST_PLAYER_ID, type HostRoom } from '../net/host';
import { joinLink } from '../net/protocol';
import { EVENTS } from '../engine/events';
import { type GameVariant, type PlayMode, type Settings, VARIANT_NAMES, effectiveSettings } from '../settings';
import { useSubscribe } from './controllers';
import { ChipStack, Icon, fmt } from './parts';
import { AvatarPicker, NumField } from './LobbyFields';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStartLocal: () => void;
  host: HostRoom | null;
  onCreateRoom: () => void;
  onCloseRoom: () => void;
  onStartHost: () => void;
}

const DIFFS: [number, string][] = [
  [0, 'Lehcí'],
  [1, 'Střední'],
  [2, 'Těžší'],
  [-1, 'Mix'],
];

export function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    /* schránka nedostupná */
  }
}

interface SeatRow {
  name: string;
  sub: string;
  dot: string;
  me?: boolean;
}

function SeatList({ rows }: { rows: SeatRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map((r, i) => (
        <div key={i} className={'wrow' + (r.me ? ' me' : '')} style={{ animationDelay: i * 0.03 + 's' }}>
          <span style={{ width: 18, fontSize: 12, color: 'var(--muted)' }}>{i + 1}</span>
          <span className={'st ' + r.dot} />
          <span className="wn" style={r.dot === '' ? { fontWeight: 400, color: 'var(--muted)' } : undefined}>
            {r.name}
          </span>
          <span className="ws">{r.sub}</span>
        </div>
      ))}
    </div>
  );
}

function HostPanel({ host, st, set, onCreateRoom, onCloseRoom, onStartHost }: { host: HostRoom | null; st: Settings; set: (p: Partial<Settings>) => void } & Pick<Props, 'onCreateRoom' | 'onCloseRoom' | 'onStartHost'>) {
  useSubscribe(host);
  const [copied, setCopied] = useState(false);
  const botName = (i: number) => BOT_LEVEL_NAMES[st.botLevel < 0 ? i % 3 : st.botLevel].toLowerCase();

  if (!host || host.status === 'closed') {
    return (
      <>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>
          Vytvoř stůl a pošli odkaz ostatním. Hra běží v tvém prohlížeči, takže ho během hry nezavírej.
        </p>
        <button type="button" className="btn primary" style={{ height: 56 }} onClick={onCreateRoom}>
          {Icon.link(20)} Vytvořit stůl
        </button>
        <div className="note">Hra přes odkaz potřebuje internet. Spojení se naváže přes veřejný server PeerJS, karty pak jdou přímo mezi prohlížeči.</div>
      </>
    );
  }
  if (host.status === 'opening') return <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Otevírám stůl…</p>;
  if (host.status === 'error') {
    return (
      <>
        <div className="note" style={{ color: 'var(--pixel-hot)', borderColor: 'var(--pixel-mid)' }}>
          {host.error}
        </div>
        <button type="button" className="btn primary" onClick={onCreateRoom}>
          Zkusit znovu
        </button>
      </>
    );
  }

  const info = host.roomInfo();
  const rows: SeatRow[] = info.players.map((p) => ({
    name: p.name,
    sub: p.isHost ? 'hostitel' : p.connected ? 'online' : 'bez spojení',
    dot: p.connected ? 'on' : 'away',
    me: p.id === HOST_PLAYER_ID,
  }));
  const humans = info.players.filter((p) => p.connected).length;
  for (let i = 1; rows.length < st.seats; i++) {
    rows.push(st.fillBots ? { name: 'Bot ' + i, sub: botName(i), dot: 'on' } : { name: 'Volné místo', sub: 'čeká', dot: '' });
  }
  const total = st.fillBots ? Math.max(st.seats, humans) : humans;
  const link = joinLink(host.code);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Pošli odkaz ostatním · kód stolu <b style={{ color: 'var(--text)', letterSpacing: '0.1em' }}>{host.code}</b>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="linkbox" title={link}>
            {link}
          </div>
          <button
            type="button"
            className="seg on"
            onClick={() => {
              copyText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Zkopírováno' : 'Kopírovat'}
          </button>
        </div>
      </div>
      <label className="prechk" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={st.fillBots} onChange={(e) => set({ fillBots: e.target.checked })} />
        Volná místa doplnit boty
      </label>
      <SeatList rows={rows} />
      <button type="button" className="btn primary" style={{ height: 56 }} disabled={total < 2} onClick={onStartHost}>
        {st.variant === "cash" ? "Spustit hru" : "Spustit turnaj"} ({total} {total >= 5 ? 'hráčů' : 'hráči'})
      </button>
      <button type="button" className="tb" style={{ alignSelf: 'center' }} onClick={onCloseRoom}>
        Zavřít stůl
      </button>
    </>
  );
}

const VARIANT_HINTS: Record<GameVariant, string> = {
  tournament: 'Klasický turnaj: blindy rostou, kdo přijde o žetony, vypadává. Vyhrává poslední u stolu.',
  sitngo: 'Rychlý turnaj na zhruba 20 minut: 1 500 žetonů, blindy 10/20 a nový level každé 3 minuty.',
  cash: 'Bez vyřazování: blindy nerostou a kdo přijde o žetony, může si dokoupit. Hraje se, dokud chcete.',
};

const GC_CHANCES: [number, string][] = [
  [1, 'Každá ruka'],
  [0.5, 'Často'],
  [0.25, 'Občas'],
];

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="swrow" onClick={onToggle}>
      <span className={'sw' + (on ? ' on' : '')}>
        <i />
      </span>
      {label}
    </button>
  );
}

export function Lobby({ settings: raw, onChange, onStartLocal, host, onCreateRoom, onCloseRoom, onStartHost }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...raw, ...patch });
  const seg = (on: boolean) => 'seg' + (on ? ' on' : '');
  // Sit & Go má pevné hodnoty – ukazují se, ale nejdou měnit.
  const st = effectiveSettings(raw);
  const fixed = raw.variant === 'sitngo';
  const cash = raw.variant === 'cash';
  const bb = st.startBb;
  const botLevelName = (i: number) => BOT_LEVEL_NAMES[st.botLevel < 0 ? i % 3 : st.botLevel].toLowerCase();
  const setMode = (mode: PlayMode) => {
    if (mode === 'bots' && host) onCloseRoom();
    set({ mode });
  };

  return (
    <div className="lobby">
      <header className="topbar" style={{ position: 'relative' }}>
        <div className="brand" style={{ flexGrow: 1 }}>
          <span className="sq" />
          <b>POKER</b>
          <span>Nový turnaj</span>
        </div>
      </header>

      <main>
        <div style={{ flex: 1.35, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)' }}>
              TEXAS HOLD'EM · {VARIANT_NAMES[st.variant].toUpperCase()}
              {st.gameChanger ? ' · GAME CHANGER' : ''}
            </span>
            <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.05, letterSpacing: '-0.02em' }}>Založit stůl</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="lab">KDE SE HRAJE</p>
            <div role="radiogroup" aria-label="Kde se hraje" style={{ display: 'flex', gap: 12 }}>
              <button type="button" role="radio" aria-checked={st.mode === 'bots'} className={'mode' + (st.mode === 'bots' ? ' on' : '')} onClick={() => setMode('bots')}>
                <span className="mt">{Icon.cpu(20)} Proti botům</span>
                <span className="md">Jen v prohlížeči. Hraje se i bez internetu.</span>
              </button>
              <button type="button" role="radio" aria-checked={st.mode === 'link'} className={'mode' + (st.mode === 'link' ? ' on' : '')} onClick={() => setMode('link')}>
                <span className="mt">{Icon.link(20)} Přes odkaz</span>
                <span className="md">Hostitelem je tvůj prohlížeč, ostatní přijdou přes odkaz.</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="lab">HERNÍ MÓD</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(Object.keys(VARIANT_NAMES) as GameVariant[]).map((v) => (
                <button key={v} type="button" className={seg(st.variant === v)} onClick={() => set({ variant: v })} title={VARIANT_HINTS[v]}>
                  {VARIANT_NAMES[v]}
                </button>
              ))}
              <span style={{ flexGrow: 1 }} />
              {st.mode === 'bots' && (
                <Switch on={st.hints} onToggle={() => set({ hints: !st.hints })} label="Trénink s nápovědou" />
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{VARIANT_HINTS[st.variant]}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="lab">GAME CHANGER</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch on={st.gameChanger} onToggle={() => set({ gameChanger: !st.gameChanger })} label={st.gameChanger ? 'Zapnuto' : 'Vypnuto'} />
              <span style={{ width: 12 }} />
              {GC_CHANCES.map(([v, label]) => (
                <button key={v} type="button" className={seg(st.gcChance === v)} disabled={!st.gameChanger} onClick={() => set({ gcChance: v })}>
                  {label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Před rukou se vylosuje karta, která na jedno kolo změní pravidla: obrácené pořadí kombinací, šestá karta na stole, Omaha, prohození
              žetonů… celkem {EVENTS.length} karet.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="lab" htmlFor="pname">
                TVOJE JMÉNO
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AvatarPicker value={raw.avatar} onChange={(avatar) => set({ avatar })} name={st.name} />
                <input id="pname" className="field" type="text" maxLength={14} value={st.name} onChange={(e) => set({ name: e.target.value })} style={{ flexGrow: 1, minWidth: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">POČET MÍST</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" className="step" aria-label="Méně míst" onClick={() => set({ seats: Math.max(2, st.seats - 1) })}>
                  −
                </button>
                <span style={{ width: 28, textAlign: 'center', fontSize: 22, fontWeight: 700 }}>{st.seats}</span>
                <button type="button" className="step" aria-label="Více míst" onClick={() => set({ seats: Math.min(9, st.seats + 1) })}>
                  +
                </button>
                <div aria-hidden="true" style={{ display: 'flex', gap: 5, marginLeft: 6 }}>
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className={'dot' + (i < st.seats ? ' on' : '')} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="lab">POČÁTEČNÍ ŽETONY PRO KAŽDÉHO</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NumField value={st.startStack} min={10} max={10_000_000} disabled={fixed} width={120} label="Vlastní počet žetonů" onCommit={(v) => set({ startStack: v })} />
              <div style={{ flexGrow: 1 }} />
              <ChipStack amount={st.startStack} />
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>= {Math.floor(st.startStack / bb)} BB</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">BLINDY NA ZAČÁTKU</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumField value={st.startBb} min={2} max={1_000_000} disabled={fixed} unit="BB" width={72} label="Vlastní big blind" onCommit={(v) => set({ startBb: v })} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                small blind {fmt(Math.max(1, Math.floor(st.startBb / 2)))} · big blind {fmt(st.startBb)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">{cash ? "BLINDY NEROSTOU (CASH GAME)" : "ZVÝŠENÍ BLINDŮ KAŽDÝCH"}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumField value={st.levelMinutes} min={1} max={240} disabled={fixed || cash} unit="min" width={56} label="Vlastní délka levelu" onCommit={(v) => set({ levelMinutes: v })} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">ČAS NA TAH</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumField value={st.turnSeconds} min={5} max={300} unit="s" width={56} label="Vlastní čas na tah" onCommit={(v) => set({ turnSeconds: v })} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">SÍLA BOTŮ</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {DIFFS.map(([v, label]) => (
                  <button key={v} type="button" className={seg(st.botLevel === v)} onClick={() => set({ botLevel: v })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside
          style={{
            flex: 1,
            minWidth: 0,
            alignSelf: 'flex-start',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{st.mode === 'link' ? 'Čekárna' : 'U stolu'}</h2>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{st.seats} míst</span>
          </div>

          {st.mode === 'link' ? (
            <HostPanel host={host} st={st} set={set} onCreateRoom={onCreateRoom} onCloseRoom={onCloseRoom} onStartHost={onStartHost} />
          ) : (
            <>
              <SeatList
                rows={Array.from({ length: st.seats }, (_, i) =>
                  i === 0 ? { name: st.name || 'Ty', sub: 'ty', dot: 'on', me: true } : { name: 'Bot ' + i, sub: botLevelName(i), dot: 'on' },
                )}
              />
              <button type="button" className="btn primary" style={{ height: 56 }} onClick={onStartLocal} autoFocus>
                {cash ? "Spustit hru" : "Spustit turnaj"}
              </button>
            </>
          )}
          <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            {fmt(st.startStack)} žetonů · blindy {bb / 2}/{bb} · {cash ? "blindy nerostou" : `+1 level po ${st.levelMinutes} min`}{st.gameChanger ? " · Game Changer" : ""}
          </span>
        </aside>
      </main>
    </div>
  );
}
