import { HAND_NAMES } from '../engine/evaluator';
import type { GameState } from '../engine/game';
import { HERO_ID, type HeroStats } from './useGame';
import { Icon, MiniCard, fmt } from './parts';

function duration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

function LastHand({ snap }: { snap: GameState }) {
  const sd = snap.showdown;
  if (!sd) return null;
  const mine = sd.hands[HERO_ID];
  const winnerId = sd.winners[0]?.id;
  const theirs = winnerId ? sd.hands[winnerId] : undefined;
  const winner = snap.players.find((p) => p.id === winnerId);
  if (!mine || !theirs || !winner) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <span className="kick" style={{ fontSize: 11 }}>
        POSLEDNÍ RUKA · #{snap.handNo}
      </span>
      {[
        ['Ty', mine],
        [winner.name, theirs],
      ].map(([name, h], i) => {
        const hand = h as typeof mine;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 96, fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name as string}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {hand.cards.map((c, j) => (
                <MiniCard key={j} card={c} size="s34" counted={j < hand.counted} />
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{HAND_NAMES[hand.cat]}</span>
            {i === 1 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'var(--accent)', color: '#fff' }}>
                BERE BANK
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EliminatedDialog({
  game,
  stats,
  onWatch,
  onLeave,
}: {
  game: GameState;
  stats: HeroStats;
  onWatch: () => void;
  onLeave: () => void;
}) {
  const hero = game.players.find((p) => p.id === HERO_ID)!;
  return (
    <>
      <div className="scrim" />
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="lostTitle">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <span className="place">{hero.place}.</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
            <span className="kick">MÍSTO Z {game.players.length} HRÁČŮ</span>
            <h1 id="lostTitle">Došly ti žetony</h1>
          </div>
        </div>
        {stats.lastHand && <LastHand snap={stats.lastHand} />}
        <div className="stats">
          <div className="stat">
            <span>ODEHRÁNO</span>
            <b>{stats.handsPlayed} rukou</b>
          </div>
          <div className="stat">
            <span>NEJVÍC ŽETONŮ</span>
            <b>{fmt(stats.maxStack)}</b>
          </div>
          <div className="stat">
            <span>VE HŘE</span>
            <b>{duration((stats.endedAt ?? Date.now()) - stats.startedAt)}</b>
          </div>
        </div>
        <div className="two">
          <button type="button" className="btn primary" onClick={onWatch} autoFocus>
            {Icon.eye(20)} Dívat se
          </button>
          <button type="button" className="btn ghost" onClick={onLeave}>
            {Icon.exit(20)} Opustit hru
          </button>
        </div>
      </section>
    </>
  );
}

export function SpectatorBar({ place, onLeave }: { place: number | null; onLeave: () => void }) {
  return (
    <div className="specbar">
      <span style={{ color: 'var(--pixel-hot)', flexGrow: 0, display: 'flex' }}>{Icon.eye(20)}</span>
      <b style={{ fontSize: 15 }}>Díváš se</b>
      <span>Tvoje umístění: {place}. místo. Vidíš jen karty, které se otočí na stole.</span>
      <button type="button" className="btn primary" style={{ height: 40, padding: '0 16px', fontSize: 13 }} onClick={onLeave}>
        {Icon.exit(16)} Opustit hru
      </button>
    </div>
  );
}

export function GameOverDialog({
  game,
  stats,
  onRestart,
  onLeave,
}: {
  game: GameState;
  stats: HeroStats;
  onRestart: () => void;
  onLeave: () => void;
}) {
  const winner = game.players.find((p) => p.id === game.winnerId);
  const hero = game.players.find((p) => p.id === HERO_ID)!;
  const iWon = game.winnerId === HERO_ID;
  return (
    <>
      <div className="scrim" />
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="overTitle">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <span className="place" style={iWon ? { color: 'var(--amber)' } : undefined}>
            {iWon ? Icon.trophy(72) : hero.place + '.'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
            <span className="kick">KONEC TURNAJE · {game.players.length} HRÁČŮ</span>
            <h1 id="overTitle">{iWon ? 'Turnaj je tvůj' : `Turnaj vyhrává ${winner?.name ?? ''}`}</h1>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span>RUKOU</span>
            <b>{game.handNo}</b>
          </div>
          <div className="stat">
            <span>NEJVÍC ŽETONŮ</span>
            <b>{fmt(stats.maxStack)}</b>
          </div>
          <div className="stat">
            <span>NEJLEPŠÍ RUKA</span>
            <b>{stats.bestCat >= 0 ? HAND_NAMES[stats.bestCat] : '—'}</b>
          </div>
        </div>
        <div className="two">
          <button type="button" className="btn primary" onClick={onRestart} autoFocus>
            Hrát znovu
          </button>
          <button type="button" className="btn ghost" onClick={onLeave}>
            {Icon.exit(20)} Do lobby
          </button>
        </div>
      </section>
    </>
  );
}
