import { type Settings } from './useGame';
import { BOT_LEVEL_NAMES } from '../bots/bot';
import { ChipStack, Icon, fmt } from './parts';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
}

const STACKS = [1500, 5000, 10000, 25000];
const BLINDS: [number, number][] = [
  [10, 20],
  [25, 50],
  [50, 100],
];
const LEVELS = [3, 5, 10, 15, 20];
const TURNS = [10, 20, 30];
const DIFFS: [number, string][] = [
  [0, 'Lehcí'],
  [1, 'Střední'],
  [2, 'Těžší'],
  [-1, 'Mix'],
];

export function Lobby({ settings: st, onChange, onStart }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...st, ...patch });
  const seg = (on: boolean) => 'seg' + (on ? ' on' : '');
  const bb = st.startBb;
  const botLevelName = (i: number) => BOT_LEVEL_NAMES[st.botLevel < 0 ? i % 3 : st.botLevel].toLowerCase();

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
        <div style={{ flex: 1.35, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)' }}>TEXAS HOLD'EM · TURNAJ</span>
            <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em' }}>Založit stůl</h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
              Nastav pravidla a začni. Vyhrává ten, kdo zůstane u stolu poslední.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="lab">KDE SE HRAJE</p>
            <div role="radiogroup" aria-label="Kde se hraje" style={{ display: 'flex', gap: 12 }}>
              <button type="button" role="radio" aria-checked="true" className="mode on">
                <span className="mt">{Icon.cpu(20)} Proti botům</span>
                <span className="md">Jen v prohlížeči. Hraje se i bez internetu.</span>
              </button>
              <button type="button" role="radio" aria-checked="false" className="mode" disabled>
                <span className="mt">
                  {Icon.link(20)} Přes odkaz <span className="soon">BRZY</span>
                </span>
                <span className="md">Hostitelem je tvůj prohlížeč, ostatní přijdou přes odkaz.</span>
              </button>
              <button type="button" role="radio" aria-checked="false" className="mode" disabled>
                <span className="mt">
                  {Icon.server(20)} Vlastní server <span className="soon">BRZY</span>
                </span>
                <span className="md">Server běží u tebe doma nebo v síti, ostatní se připojí na adresu.</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="lab" htmlFor="pname">
                TVOJE JMÉNO
              </label>
              <input id="pname" className="field" type="text" maxLength={14} value={st.name} onChange={(e) => set({ name: e.target.value })} />
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
              {STACKS.map((v) => (
                <button key={v} type="button" className={seg(st.startStack === v)} onClick={() => set({ startStack: v })}>
                  {fmt(v)}
                </button>
              ))}
              <input
                className="field"
                type="number"
                min={100}
                step={100}
                value={st.startStack}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) set({ startStack: Math.min(10_000_000, Math.floor(v)) });
                }}
                aria-label="Vlastní počet žetonů"
                style={{ width: 120, textAlign: 'right', fontWeight: 700 }}
              />
              <div style={{ flexGrow: 1 }} />
              <ChipStack amount={st.startStack} />
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>= {Math.floor(st.startStack / bb)} BB</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">BLINDY NA ZAČÁTKU</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {BLINDS.map(([s, b]) => (
                  <button key={b} type="button" className={seg(st.startBb === b)} onClick={() => set({ startBb: b })}>
                    {s} / {b}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">ZVÝŠENÍ BLINDŮ KAŽDÝCH</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {LEVELS.map((m) => (
                  <button key={m} type="button" className={seg(st.levelMinutes === m)} onClick={() => set({ levelMinutes: m })}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="lab">ČAS NA TAH</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {TURNS.map((s) => (
                  <button key={s} type="button" className={seg(st.turnSeconds === s)} onClick={() => set({ turnSeconds: s })}>
                    {s} s
                  </button>
                ))}
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
            <h2 style={{ margin: 0, fontSize: 22 }}>U stolu</h2>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {st.seats} / {st.seats} míst
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Array.from({ length: st.seats }, (_, i) => (
              <div key={i} className={'wrow' + (i === 0 ? ' me' : '')} style={{ animationDelay: i * 0.03 + 's' }}>
                <span style={{ width: 18, fontSize: 12, color: 'var(--muted)' }}>{i + 1}</span>
                <span className="st on" />
                <span className="wn">{i === 0 ? st.name || 'Ty' : 'Bot ' + i}</span>
                <span className="ws">{i === 0 ? 'ty' : botLevelName(i)}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn primary" style={{ height: 56 }} onClick={onStart} autoFocus>
            Spustit turnaj
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            {fmt(st.startStack)} žetonů · blindy {bb / 2}/{bb} · +1 level po {st.levelMinutes} min
          </span>
        </aside>
      </main>
    </div>
  );
}
