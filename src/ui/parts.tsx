import { type ReactNode, useEffect, useState } from 'react';
import { type Card as CardT, SUIT_SYMBOL, isRed, rankLabel } from '../engine/cards';

export const fmt = (n: number) => n.toLocaleString('cs-CZ');

// ---------- žetony ----------

export const DENOMINATIONS: [number, string][] = [
  [100000, 'c100k'],
  [50000, 'c50k'],
  [10000, 'c10k'],
  [5000, 'c5k'],
  [1000, 'c1k'],
  [500, 'c500'],
  [100, 'c100'],
  [50, 'c50'],
  [10, 'c10'],
  [5, 'c5'],
  [1, 'c1'],
];

/** Rozklad částky na sloupce žetonů: největší hodnoty, max 4 sloupce po 5. */
export function chipColumns(amount: number): { cls: string; count: number }[] {
  const cols: { cls: string; count: number }[] = [];
  let rest = amount;
  for (const [d, cls] of DENOMINATIONS) {
    const n = Math.floor(rest / d);
    if (n > 0) {
      cols.push({ cls, count: Math.min(n, 5) });
      rest -= n * d;
    }
    if (cols.length === 4) break;
  }
  return cols;
}

export function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="stack" aria-hidden="true">
      {chipColumns(amount).map((c, i) => (
        <div className="col" key={i}>
          {Array.from({ length: c.count }, (_, j) => (
            <div key={j} className={'pc ' + c.cls} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- karty ----------

type CardSize = 'lg' | 'md' | 'sm';

export function CardFace({
  card,
  size,
  hit,
  dim,
  className = '',
  style,
  onClick,
}: {
  card: CardT;
  size: CardSize;
  hit?: boolean;
  dim?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const sym = SUIT_SYMBOL[card.s];
  const cls = ['card', size, isRed(card) ? 'red' : '', hit ? 'hit' : '', dim ? 'faded' : '', className].filter(Boolean).join(' ');
  const click = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <div className={cls} style={style} aria-label={rankLabel(card.r) + ' ' + sym} {...click}>
      <span className="ix">
        <b>{rankLabel(card.r)}</b>
        <i>{sym}</i>
      </span>
      <span className="pip">{sym}</span>
    </div>
  );
}

/** Malá karta jen s hodnotou a barvou (přehled kombinací, souhrn ruky). */
export function MiniCard({ card, size, counted, hit }: { card: CardT; size: 'xs' | 's34'; counted: boolean; hit?: boolean }) {
  const cls = ['card', size, counted ? (isRed(card) ? 'red' : '') : 'dim', hit && counted ? 'hit' : ''].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <b>{rankLabel(card.r)}</b>
      <i>{SUIT_SYMBOL[card.s]}</i>
    </span>
  );
}

export function CardBack({ size, className = '', style }: { size: CardSize; className?: string; style?: React.CSSProperties }) {
  return <div className={'card back ' + size + ' ' + className} style={style} aria-hidden="true" />;
}

// ---------- ikony (obrysové, tah 2 px) ----------

function Svg({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const Icon = {
  exit: (s?: number) => (
    <Svg size={s}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  ),
  eye: (s?: number) => (
    <Svg size={s}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  chevron: (s?: number) => (
    <Svg size={s}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  link: (s?: number) => (
    <Svg size={s}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </Svg>
  ),
  cpu: (s?: number) => (
    <Svg size={s}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </Svg>
  ),
  server: (s?: number) => (
    <Svg size={s}>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </Svg>
  ),
  pause: (s?: number) => (
    <Svg size={s}>
      <path d="M8 5v14M16 5v14" />
    </Svg>
  ),
  play: (s?: number) => (
    <Svg size={s}>
      <path d="M7 5l12 7-12 7z" />
    </Svg>
  ),
  sidebar: (s?: number) => (
    <Svg size={s}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </Svg>
  ),
  trophy: (s?: number) => (
    <Svg size={s}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4" />
    </Svg>
  ),
};

// ---------- plocha 1440×900 zmenšená do okna ----------

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1440, window.innerHeight / 900));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** Aktuální čas, obnovovaný po sekundě (odpočty). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
