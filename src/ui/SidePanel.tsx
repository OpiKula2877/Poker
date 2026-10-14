import { useEffect, useMemo, useRef, useState } from 'react';
import { parseCards } from '../engine/cards';
import { HAND_NAMES, type HandValue, describeHand } from '../engine/evaluator';
import type { GameState } from '../engine/game';
import { useHeroId } from './useGame';
import type { ChatMsg } from '../net/protocol';
import { Icon, MiniCard, fmt } from './parts';

/** Příklad ke každé kombinaci: karty a kolik prvních z nich se počítá. */
const EXAMPLES: [string, number, string][] = [
  ['As Jd 8c 6h 2s', 1, 'nic se neshoduje, rozhoduje nejvyšší karta, pak další v pořadí.'],
  ['Qh Qc 9s 5d 3c', 2, 'dvě karty stejné hodnoty.'],
  ['Js Jd 7c 7h Ad', 4, 'dva různé páry; při shodě rozhoduje pátá karta.'],
  ['8s 8h 8d Kc 4s', 3, 'tři karty stejné hodnoty.'],
  ['9c 8d 7s 6h 5c', 5, 'pět karet po sobě v libovolných barvách; A může být i nejnižší (A-2-3-4-5).'],
  ['Ad Jd 9d 6d 3d', 5, 'pět karet stejné barvy, nemusí jít po sobě.'],
  ['Ts Th Tc 4d 4s', 5, 'trojice a pár dohromady.'],
  ['7s 7h 7d 7c Qh', 4, 'čtyři karty stejné hodnoty.'],
  ['9h 8h 7h 6h 5h', 5, 'pět karet po sobě ve stejné barvě.'],
  ['As Ks Qs Js Ts', 5, '10, J, Q, K, A ve stejné barvě. Nejsilnější ruka.'],
];

function RankingPanel({ heroHand, emptyText, onHide }: { heroHand: HandValue | null; emptyText: string; onHide: () => void }) {
  const cur = heroHand?.cat ?? -1;
  const [sel, setSel] = useState<number | null>(null);
  const shown = sel ?? (cur >= 0 ? cur : 0);
  const rows = useMemo(() => EXAMPLES.map(([c, n, d]) => ({ cards: parseCards(c), counted: n, desc: d })), []);

  return (
    <section className="ranks" aria-label="Pořadí kombinací">
      <div className="head">
        <span>POŘADÍ KOMBINACÍ</span>
        <button type="button" className="tb" style={{ height: 28, fontSize: 12 }} onClick={onHide}>
          Skrýt {Icon.chevron(14)}
        </button>
      </div>
      <div className="myhand">
        <div className="t">
          <span className="k">TVOJE RUKA</span>
          <span className="n">{heroHand ? describeHand(heroHand) : emptyText}</span>
        </div>
        <div className="cs">
          {heroHand?.cards.map((c, i) => <MiniCard key={i} card={c} size="s34" counted={i < heroHand.counted} hit />)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((r, i) => (
          <button
            type="button"
            key={i}
            className={'rrow' + (i === shown ? ' sel' : '') + (i === cur ? ' cur' : '')}
            aria-pressed={i === shown}
            onClick={() => setSel(i)}
          >
            <span className="rn">{String(i + 1).padStart(2, '0')}</span>
            <span className="rname">{HAND_NAMES[i]}</span>
            <span className="rcards">
              {r.cards.map((c, j) => <MiniCard key={j} card={c} size="xs" counted={j < r.counted} />)}
            </span>
          </button>
        ))}
      </div>
      <p className="rdesc">
        <b>{HAND_NAMES[shown]}</b> — {rows[shown].desc}
      </p>
    </section>
  );
}

function heroEmptyText(game: GameState, heroId: string): string {
  const hero = game.players.find((p) => p.id === heroId);
  if (!hero || hero.out) return 'Mimo hru';
  if (hero.folded) return 'Karty složeny';
  return 'Čeká se na rozdání';
}

type Tab = 'log' | 'players' | 'chat';

interface Chat {
  messages: ChatMsg[];
  send: (text: string) => void;
}

function ChatBox({ chat }: { chat: Chat }) {
  const [text, setText] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    chat.send(text);
    setText('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
      {chat.messages.length === 0 && <span style={{ color: 'var(--muted)' }}>Zatím žádné zprávy.</span>}
      {chat.messages.map((m) => (
        <div key={m.n} className="logl">
          <b>{m.from}</b>
          <span style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>{m.text}</span>
        </div>
      ))}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <input
          className="field"
          style={{ flexGrow: 1, minWidth: 0, height: 36, fontSize: 13 }}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder="Napiš zprávu…"
          aria-label="Zpráva do chatu"
        />
        <button type="submit" className="tb">
          Poslat
        </button>
      </form>
    </div>
  );
}

export function SidePanel({ game, heroHand, chat }: { game: GameState; heroHand: HandValue | null; chat?: Chat }) {
  const heroId = useHeroId();
  const [tab, setTab] = useState<Tab>('log');
  const [ranksOpen, setRanksOpen] = useState(true);
  const [seenChat, setSeenChat] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const chatCount = chat?.messages.length ?? 0;
  const lastChatN = chat?.messages[chatCount - 1]?.n ?? 0;
  const unread = tab === 'chat' ? 0 : chat ? chat.messages.filter((m) => m.n > seenChat).length : 0;

  useEffect(() => {
    if (tab === 'chat') setSeenChat(lastChatN);
  }, [tab, lastChatN]);

  useEffect(() => {
    const el = logRef.current;
    if (el && tab !== 'players') el.scrollTop = el.scrollHeight;
  }, [game.log.length, chatCount, tab]);

  const log = game.log.slice(-80);
  const max = Math.max(1, ...game.players.map((p) => p.stack + p.committed));
  const standing = [...game.players].sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1;
    if (a.out) return (a.place ?? 99) - (b.place ?? 99);
    return b.stack + b.committed - (a.stack + a.committed);
  });

  return (
    <aside className="side">
      <div className="tabs" role="tablist" aria-label="Postranní panel">
        {(
          [['log', 'Průběh'], ['players', 'Hráči'], ...(chat ? [['chat', 'Chat']] : [])] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            {label}
            {id === 'chat' && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
      </div>

      <div className="tabbody" ref={logRef}>
        {tab === 'log' &&
          log.map((l) =>
            l.kind === 'street' ? (
              <div key={l.n} className="logl street">
                {l.text.toUpperCase()}
              </div>
            ) : (
              <div key={l.n} className={'logl ' + l.kind}>
                <b>{l.who ?? ''}</b>
                <span>{l.text}</span>
              </div>
            ),
          )}
        {tab === 'players' &&
          standing.map((p, i) => (
            <div key={p.id} className={'prow' + (p.id === heroId ? ' me' : '') + (p.out ? ' out' : '')}>
              <span style={{ width: 24, color: 'var(--muted)' }}>{p.out ? p.place + '.' : i + 1 + '.'}</span>
              <span style={{ width: 78, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              {p.out ? (
                <span style={{ flex: 1 }}>mimo hru</span>
              ) : (
                <>
                  <div className="bar">
                    <i style={{ width: ((p.stack + p.committed) / max) * 100 + '%' }} />
                  </div>
                  <span style={{ width: 70, textAlign: 'right', fontWeight: 700 }}>{fmt(p.stack + p.committed)}</span>
                </>
              )}
            </div>
          ))}
        {tab === 'chat' && chat && <ChatBox chat={chat} />}
      </div>

      {ranksOpen ? (
        <RankingPanel heroHand={heroHand} emptyText={heroEmptyText(game, heroId)} onHide={() => setRanksOpen(false)} />
      ) : (
        <button type="button" className="ranksbtn" onClick={() => setRanksOpen(true)} aria-label="Zobrazit pořadí kombinací">
          <span>?</span>
          Kombinace
        </button>
      )}
    </aside>
  );
}
