import { useEffect, useState } from 'react';
import { RARITY_NAME, eventById } from '../engine/events';
import type { GameState } from '../engine/game';

/** Velká karta uprostřed stolu, když ruka dostane Game Changer; pak malý odznak. */
export function GameChangerLayer({ game }: { game: GameState }) {
  const ev = eventById(game.rules.eventId);
  const [shownHand, setShownHand] = useState<number | null>(null);
  const handNo = game.handNo;
  const revealMs = game.config.revealMs ?? 2600;
  const fresh = !!ev && Date.now() - game.handStartedAt < revealMs;

  useEffect(() => {
    if (!ev || !fresh) return;
    setShownHand(handNo);
    const t = setTimeout(() => setShownHand(null), Math.max(600, revealMs - (Date.now() - game.handStartedAt)));
    return () => clearTimeout(t);
  }, [handNo, ev?.id]);

  if (!ev) return null;
  const open = shownHand === handNo;
  return (
    <>
      {open ? (
        <button type="button" className={'gcreveal ' + ev.rarity} onClick={() => setShownHand(null)} aria-label={'Game Changer: ' + ev.name}>
          <div className="face">
            <span className="kick">GAME CHANGER · {RARITY_NAME[ev.rarity].toUpperCase()}</span>
            <h2>{ev.name}</h2>
            <p>{ev.desc}</p>
            <span className="mark" aria-hidden="true">
              ?
            </span>
            <span className="skip">Platí jen pro tuto ruku · klikni pro zavření</span>
          </div>
        </button>
      ) : (
        <div className="gcbadge" title={ev.desc}>
          <span className="k">GAME CHANGER</span>
          {ev.name}
        </div>
      )}
    </>
  );
}
