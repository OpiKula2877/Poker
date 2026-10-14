import { useEffect } from 'react';
import { RARITY_NAME, eventById } from '../engine/events';
import type { GameState } from '../engine/game';
import { useHeroId } from './useGame';

/**
 * Game Changer karta: dokud ji všichni lidé u stolu nepotvrdí, hra stojí
 * (karta s tlačítkem OK uprostřed stolu). Pak zůstane malý odznak.
 */
export function GameChangerLayer({ game, onAck }: { game: GameState; onAck: () => void }) {
  const heroId = useHeroId();
  const ev = eventById(game.rules.eventId);
  const reading = game.phase === 'reveal';
  const mine = reading && game.pendingAcks.includes(heroId);

  // Enter = OK
  useEffect(() => {
    if (!mine) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onAck();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mine, onAck]);

  if (!ev) return null;
  if (!reading) {
    return (
      <div className="gcbadge" title={ev.desc}>
        <span className="k">GAME CHANGER</span>
        {ev.name}
      </div>
    );
  }

  const waiting = game.pendingAcks
    .filter((id) => id !== heroId)
    .map((id) => game.players.find((p) => p.id === id)?.name)
    .filter(Boolean);

  return (
    <>
      <div className="gcscrim" />
      <div className={'gcreveal ' + ev.rarity} role="dialog" aria-modal="true" aria-labelledby="gcTitle">
        <div className="face">
          <span className="kick">GAME CHANGER · {RARITY_NAME[ev.rarity].toUpperCase()}</span>
          <h2 id="gcTitle">{ev.name}</h2>
          <p>{ev.desc}</p>
          <span className="mark" aria-hidden="true">
            ?
          </span>
          {mine ? (
            <button type="button" className="btn primary" style={{ height: 48 }} onClick={onAck} autoFocus>
              OK, hrajeme
            </button>
          ) : (
            <span className="skip">Čeká se, až kartu potvrdí: {waiting.join(', ') || '…'}</span>
          )}
          {mine && waiting.length > 0 && <span className="skip">Potvrdit musí ještě: {waiting.join(', ')}</span>}
          <span className="skip">Platí jen pro tuto ruku</span>
        </div>
      </div>
    </>
  );
}
