import { useEffect, useRef, useState } from 'react';
import { type Action, type GameState, currentBlinds, legalActions, potTotal } from '../engine/game';
import { type PreAction, useHeroId } from './useGame';
import { fmt } from './parts';

interface Props {
  game: GameState;
  now: number;
  act: (a: Action) => void;
  preAction: PreAction;
  setPreAction: (p: PreAction) => void;
}

export function ActionDock({ game, now, act, preAction, setPreAction }: Props) {
  const heroId = useHeroId();
  const hero = game.players.find((p) => p.id === heroId)!;
  const legal = legalActions(game, heroId);
  const myTurn = !!legal;
  const pot = potTotal(game);
  const step = currentBlinds(game).sb; // předvolby zaokrouhlené na small blind
  const [amount, setAmount] = useState(0);
  const turnKey = useRef(0);

  // Nový tah → nastavit částku na minimum.
  useEffect(() => {
    if (legal && turnKey.current !== game.turnStartedAt) {
      turnKey.current = game.turnStartedAt;
      setAmount(legal.minRaiseTo);
    }
  }, [legal, game.turnStartedAt]);

  const clamp = (v: number) => (legal ? Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(v))) : v);
  const to = legal ? clamp(amount || legal.minRaiseTo) : 0;
  const isAllInRaise = legal ? to >= legal.maxRaiseTo : false;

  const presets = legal
    ? ([
        ['Min', legal.minRaiseTo],
        ['½ banku', legal.currentBet + (pot + legal.callAmount) / 2],
        ['¾ banku', legal.currentBet + (pot + legal.callAmount) * 0.75],
        ['Bank', legal.currentBet + pot + legal.callAmount],
      ] as [string, number][]).map(([label, v]) => [label, clamp(Math.round(v / step) * step)] as [string, number])
    : [];

  const doFold = () => legal && act({ type: 'fold' });
  const doCall = () => legal && act(legal.canCheck ? { type: 'check' } : { type: 'call' });
  const doRaise = () => legal?.canRaise && act(isAllInRaise ? { type: 'allin' } : { type: 'raise', to });
  const doAllIn = () => legal && act({ type: 'allin' });

  // Klávesové zkratky F / C / R / A.
  const handlers = useRef({ doFold, doCall, doRaise, doAllIn });
  handlers.current = { doFold, doCall, doRaise, doAllIn };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const h = handlers.current;
      if (k === 'f') h.doFold();
      else if (k === 'c' || k === 'k') h.doCall();
      else if (k === 'r') h.doRaise();
      else if (k === 'a') h.doAllIn();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const elapsed = Math.max(0, now - game.turnStartedAt);
  const secondsLeft = Math.max(0, Math.ceil((game.config.turnSeconds * 1000 - elapsed) / 1000));
  const toActName = game.players.find((p) => p.id === game.toActId)?.name;
  const inHand = hero.inHand && !hero.folded && !hero.allIn && !hero.out;

  let title: string;
  let sub: string;
  if (myTurn && legal) {
    title = 'Jsi na tahu';
    sub = (legal.canCall ? `Dorovnat ${fmt(legal.callAmount)} · ` : '') + `v banku ${fmt(pot)} · ${secondsLeft} s`;
  } else if (hero.out) {
    title = 'Díváš se';
    sub = toActName ? `Na tahu: ${toActName}` : 'Čeká se na další ruku';
  } else if (game.phase === 'handEnd') {
    title = 'Konec ruky';
    sub = 'Další ruka za chvíli';
  } else if (hero.folded) {
    title = 'Karty složeny';
    sub = toActName ? `Na tahu: ${toActName}` : 'Čeká se na další ruku';
  } else if (hero.allIn) {
    title = 'All in';
    sub = 'Karty se dorozdají';
  } else {
    title = toActName ? `Na tahu: ${toActName}` : 'Rozdává se…';
    sub = `V banku ${fmt(pot)}`;
  }

  const raiseLabel = !legal || !legal.canRaise ? 'Navýšit' : isAllInRaise ? 'All in' : (legal.currentBet === 0 ? 'Sázet ' : 'Navýšit na ') + fmt(to);
  const callLabel = !legal ? 'Dorovnat' : legal.canCheck ? 'Check' : legal.callAmount >= hero.stack ? `All in ${fmt(legal.callAmount)}` : `Dorovnat ${fmt(legal.callAmount)}`;

  return (
    <section className="dock" aria-label="Tvůj tah">
      <div className="row1">
        <div className="info">
          <b>{title}</b>
          <span>{sub}</span>
        </div>
        {myTurn && legal?.canRaise ? (
          <>
            {presets.map(([label, v]) => (
              <button key={label} type="button" className={'pre' + (v === to ? ' on' : '')} onClick={() => setAmount(v)}>
                {label} {fmt(v)}
              </button>
            ))}
            <label htmlFor="raiseAmt" className="sr-only">
              Částka navýšení
            </label>
            <input
              id="raiseAmt"
              className="range"
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={Math.max(1, Math.floor(legal.minRaiseTo / 20))}
              value={to}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <input
              className="num"
              type="number"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              value={amount || to}
              onChange={(e) => setAmount(Number(e.target.value))}
              onBlur={() => setAmount(to)}
              aria-label="Částka navýšení"
            />
          </>
        ) : (
          !myTurn &&
          inHand &&
          game.phase === 'betting' && (
            <>
              <label className="prechk">
                <input type="checkbox" checked={preAction === 'checkfold'} onChange={(e) => setPreAction(e.target.checked ? 'checkfold' : null)} />
                Check / Fold
              </label>
              <label className="prechk">
                <input type="checkbox" checked={preAction === 'callany'} onChange={(e) => setPreAction(e.target.checked ? 'callany' : null)} />
                Dorovnat cokoli
              </label>
            </>
          )
        )}
      </div>
      <div className="btns">
        <button type="button" className="btn ghost" disabled={!myTurn} onClick={doFold}>
          Fold <kbd>F</kbd>
        </button>
        <button type="button" className="btn" disabled={!myTurn} onClick={doCall}>
          {callLabel} <kbd>C</kbd>
        </button>
        <button type="button" className="btn primary" disabled={!myTurn || !legal?.canRaise} onClick={doRaise}>
          {raiseLabel} <kbd>R</kbd>
        </button>
        <button type="button" className="btn allin" disabled={!myTurn} onClick={doAllIn}>
          All in {fmt(hero.stack + hero.bet)} <kbd>A</kbd>
        </button>
      </div>
    </section>
  );
}
