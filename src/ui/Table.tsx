import { useMemo, useState } from 'react';
import { type Card, cardId, createRng } from '../engine/cards';
import { computeHint } from '../bots/hints';
import { HAND_NAMES, bestHandFor } from '../engine/evaluator';
import { GameChangerLayer } from './GameChanger';
import { HintPanel } from './HintPanel';
import { type GameState, type PlayerState, canBuyCard, currentBlinds, isCash, potTotal, turnSecondsOf, visibleBoard } from '../engine/game';
import { boardTotal } from '../engine/rules';
import { ExchangeBar } from './ExchangeBar';
import { ActionDock } from './ActionDock';
import { EliminatedDialog, GameOverDialog, RebuyDialog, SpectatorBar } from './Overlays';
import { SidePanel } from './SidePanel';
import { HeroContext } from './useGame';
import type { GameController } from './controllers';
import { joinLink } from '../net/protocol';
import { CardBack, CardFace, ChipStack, Icon, fmt, useNow } from './parts';

const CX = 540;
const CY = 392;
const RX = 455;
const RY = 250;

function seatPoint(rel: number, n: number) {
  const a = ((90 + (rel * 360) / n) * Math.PI) / 180;
  return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
}

function statusClass(label: string | null): string {
  if (!label) return '';
  if (label.startsWith('Vyhrává') || label.startsWith('+')) return 'win';
  if (label.startsWith('Sází') || label.startsWith('Na ') || label === 'All in') return 'bet';
  if (label === 'Call' || label === 'Check') return 'call';
  return '';
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ name, src, me }: { name: string; src?: string | null; me?: boolean }) {
  return (
    <div className={'av' + (me && !src ? ' me' : '')}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </div>
  );
}

interface SeatProps {
  p: PlayerState;
  x: number;
  y: number;
  game: GameState;
  hits: Set<string>;
  winAmount?: number;
  away: boolean;
  avatar?: string;
}

function Seat({ p, x, y, game, hits, winAmount, away, avatar }: SeatProps) {
  if (p.out) {
    return (
      <div className="seat" style={{ left: x, top: y }}>
        <div className="plate empty">
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.place}. místo · mimo hru</span>
        </div>
      </div>
    );
  }
  const active = game.toActId === p.id && game.phase === 'betting';
  // Otevřené karty (Game Changer) – všichni vidí všechno.
  const showOpen = (p.showCards || game.rules.openHands) && p.hole.length > 0 && p.hole[0].r > 0;
  const dark = game.rules.dark && game.phase !== 'handEnd';
  // Odhalená karta (Game Changer): karty se položí vedle sebe, aby byla vidět celá.
  const anyFace = showOpen || (game.rules.revealFirst && p.hole[0]?.r > 0);
  const label = winAmount ? '+' + fmt(winAmount) : p.lastAction;
  const pos = p.id === game.sbId ? 'SB' : p.id === game.bbId ? 'BB' : null;
  return (
    <div className={'seat' + (p.folded ? ' folded' : '')} style={{ left: x, top: y }}>
      <div className={'holes' + (anyFace ? ' open' : '')}>
        {p.inHand &&
          !p.folded &&
          p.hole.map((c, i) =>
            showOpen || (game.rules.revealFirst && i === 0 && c.r > 0) ? (
              <CardFace key={cardId(c) + i} card={c} size="sm" hit={showOpen && hits.has(cardId(c))} className="flipIn" />
            ) : (
              <CardBack key={i} size="sm" />
            ),
          )}
      </div>
      <div className={'plate' + (active ? ' active' : '') + (winAmount ? ' winner' : '')}>
        <Avatar name={p.name} src={avatar} />
        <div className="pm">
          <div className="pn">
            <span className="nm">{p.name}</span>
            {p.isBot && <span className="tag">BOT</span>}
            {away && <span className="tag away">PRYČ</span>}
            {pos && <span className="tag">{pos}</span>}
          </div>
          <div className="ps">{dark ? '???' : fmt(p.stack)}</div>
        </div>
        {game.dealerId === p.id && (
          <div className="dbtn" title="Dealer">
            D
          </div>
        )}
        {active && (
          <div className="timer">
            <i
              key={game.turnStartedAt}
              style={{
                animationDuration: (p.isBot ? 1.5 : turnSecondsOf(game)) + 's',
                animationDelay: p.isBot ? '0s' : -(Date.now() - game.turnStartedAt) / 1000 + 's',
              }}
            />
          </div>
        )}
      </div>
      <div className="srow">
        {!dark && <ChipStack amount={p.stack} />}
        {label && <span className={'status ' + statusClass(label)}>{label}</span>}
      </div>
    </div>
  );
}

function HeroSeat({
  p,
  game,
  hits,
  heroHandName,
  winAmount,
  avatar,
  picked,
  onPick,
}: {
  p: PlayerState;
  game: GameState;
  hits: Set<string>;
  heroHandName: string | null;
  winAmount?: number;
  avatar?: string;
  /** Draw: vybrané karty k výměně. */
  picked: number[];
  onPick?: (i: number) => void;
}) {
  const active = game.toActId === p.id && game.phase === 'betting';
  const label = winAmount ? '+' + fmt(winAmount) : p.lastAction;
  const pos = p.id === game.sbId ? 'SB' : p.id === game.bbId ? 'BB' : null;
  // Naslepo: vlastní karty jsou před flopem otočené rubem (u hosta online je ani nemá).
  const hidden = game.rules.hideOwnPreflop && game.street === 'preflop' && game.phase !== 'handEnd' && !p.showCards;
  const n = p.hole.length;
  const fan = (i: number) => ({ transform: `rotate(${(i - (n - 1) / 2) * (n > 2 ? 5 : 8)}deg)`, marginLeft: i && n > 2 ? -22 : 0 });
  return (
    <div className="hero">
      <div className="hcards">
        {p.inHand &&
          p.hole.map((c, i) =>
            hidden || c.r === 0 ? (
              <CardBack key={'b' + i + game.handNo} size="lg" style={fan(i)} />
            ) : (
              <CardFace
                key={cardId(c) + game.handNo}
                card={c}
                size="lg"
                hit={hits.has(cardId(c))}
                dim={p.folded}
                className={'deal' + (onPick ? ' pickable' : '') + (picked.includes(i) ? ' picked' : '') + (game.rules.catCard === cardId(c) ? ' cat' : '')}
                style={fan(i)}
                onClick={onPick ? () => onPick(i) : undefined}
              />
            ),
          )}
        {p.inHand && !hidden && p.hole.length === 0 && <span className="handtag">Karty přijdou po sázení</span>}
        {hidden && p.inHand && <span className="handtag">Naslepo</span>}
        {heroHandName && !p.folded && !hidden && <span className="handtag">{heroHandName}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
        {label && <span className={'status ' + statusClass(label)} style={{ marginBottom: 14 }}>{label}</span>}
        <div className={'plate' + (active ? ' active' : '') + (winAmount ? ' winner' : '')} style={{ width: 188 }}>
          <Avatar name={p.name} src={avatar} me />
          <div className="pm">
            <div className="pn">
              <span className="nm">{p.name}</span>
              {pos && <span className="tag">{pos}</span>}
            </div>
            <div className="ps">{fmt(p.stack)}</div>
          </div>
          {game.dealerId === p.id && <div className="dbtn">D</div>}
          {active && (
            <div className="timer">
              <i
                key={game.turnStartedAt}
                style={{ animationDuration: turnSecondsOf(game) + 's', animationDelay: -(Date.now() - game.turnStartedAt) / 1000 + 's' }}
              />
            </div>
          )}
        </div>
        <div style={{ paddingBottom: 6 }}>
          <ChipStack amount={p.stack} />
        </div>
      </div>
    </div>
  );
}

function Board({ game, hits, fadeOthers }: { game: GameState; hits: Set<string>; fadeOthers: boolean }) {
  const r = game.rules;
  const total = boardTotal(r);
  const done = game.phase === 'handEnd' || game.phase === 'gameOver';
  const gap = total > 6 ? 6 : 10;
  const width = total * 64 + (total - 1) * gap;
  const label = (i: number) => (i < 3 ? 'FLOP' : i === 3 ? 'TURN' : i === 4 ? 'RIVER' : i + 1 + '.');
  // Zemětřesení: karty se rozsypou (stabilně podle čísla ruky).
  const shake = (i: number) => {
    if (!r.quake) return {};
    const k = Math.sin((game.handNo + 1) * 9.7 + i * 3.1);
    const dx = Math.round(k * 14);
    const dy = Math.round(Math.cos(i * 2.3 + game.handNo) * 18);
    return { transform: `translate(${dx}px, ${dy}px) rotate(${Math.round(k * 16)}deg)` };
  };
  return (
    <>
      <div className={'board' + (r.quake ? ' quaked' : '')} style={{ left: 540 - width / 2, gap }}>
        {Array.from({ length: total }, (_, i) => {
          const c: Card | undefined = game.board[i];
          if (!c) return <div key={'slot' + i} className="slot" style={shake(i)}>{label(i)}</div>;
          const jackpot = r.jackpotIndex === i;
          if (c.r === 0 || (!done && r.hiddenBoard.includes(i))) {
            return (
              <div key={'h' + i + game.handNo} className="bslot" style={shake(i)}>
                <CardBack size="md" className="deal" />
                <span className="blabel">SKRYTÁ</span>
              </div>
            );
          }
          const id = cardId(c);
          return (
            <div key={id + game.handNo} className="bslot" style={shake(i)}>
              <CardFace
                card={c}
                size="md"
                hit={hits.has(id)}
                dim={fadeOthers && !hits.has(id)}
                className={'deal' + (jackpot ? ' jackpot' : '')}
                style={{ animationDelay: (i < 3 ? i * 0.1 : 0) + 's' }}
              />
              {jackpot && <span className="blabel gold">JACKPOT</span>}
            </div>
          );
        })}
      </div>
      {game.board2.length > 0 && (
        <div className="board board2" style={{ left: 540 - width / 2, gap }}>
          <span className="b2label">DRUHÝ STŮL</span>
          {game.board2.map((c, i) => (
            <CardFace key={cardId(c) + 'b2'} card={c} size="md" className="deal" style={{ animationDelay: i * 0.08 + 's' }} />
          ))}
        </div>
      )}
    </>
  );
}

export function GameScreen({ ctl, onExit }: { ctl: GameController & { game: GameState }; onExit: () => void }) {
  const { game, act, paused, togglePause, preAction, setPreAction, stats, restart, heroId, away } = ctl;
  const now = useNow(500);
  const [spectating, setSpectating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sideOpen, setSideOpen] = useState(() => {
    try {
      return localStorage.getItem('poker.side') !== 'closed';
    } catch {
      return true;
    }
  });
  const toggleSide = () => {
    setSideOpen((o) => {
      try {
        localStorage.setItem('poker.side', o ? 'closed' : 'open');
      } catch {
        /* nevadí */
      }
      return !o;
    });
  };

  const n = game.players.length;
  const hero = game.players.find((p) => p.id === heroId)!;
  const blinds = currentBlinds(game);
  const pot = potTotal(game);
  const bets = game.players.reduce((s, p) => s + p.bet, 0);
  const sd = game.showdown;
  const winAmounts = new Map(sd?.winners.map((w) => [w.id, w.amount]) ?? []);

  const heroHidden = game.rules.hideOwnPreflop && game.street === 'preflop' && game.phase !== 'handEnd';
  // Karty na stole, které hráč opravdu vidí (bez skryté river).
  const shownBoard = useMemo(() => visibleBoard(game).filter((c) => c.r > 0), [game]);
  const heroHand = useMemo(
    () =>
      hero.inHand && !hero.folded && hero.hole.length && !heroHidden && hero.hole[0].r > 0
        ? bestHandFor(hero.hole, shownBoard, game.rules)
        : null,
    [hero.inHand, hero.folded, hero.hole, shownBoard, game.rules, heroHidden],
  );
  // Draw: výběr karet k výměně.
  const picking = game.phase === 'exchange' && game.pendingExchange.includes(heroId);
  const [picked, setPicked] = useState<number[]>([]);
  const pickKey = game.handNo + ':' + game.phase;
  const [lastPickKey, setLastPickKey] = useState(pickKey);
  if (lastPickKey !== pickKey) {
    setLastPickKey(pickKey);
    setPicked([]);
  }
  const togglePick = (i: number) => setPicked((x) => (x.includes(i) ? x.filter((y) => y !== i) : x.length >= 2 ? x : [...x, i]));
  const cash = isCash(game);
  const betsHidden = game.rules.hiddenBets && game.phase !== 'handEnd' && game.phase !== 'gameOver';

  // Trénink: nápověda se počítá jednou za tah.
  const myTurn = game.phase === 'betting' && game.toActId === heroId;
  const hint = useMemo(
    () => (ctl.hints && myTurn ? computeHint(game, heroId, createRng(game.turnStartedAt >>> 0)) : null),
    [ctl.hints, myTurn, game.turnStartedAt, game.handNo],
  );

  // Které karty zvýraznit: při showdownu vítěznou kombinaci, jinak tvou.
  const { hits, fadeOthers } = useMemo(() => {
    if (sd && !sd.uncontested && sd.winners.length) {
      const h = sd.hands[sd.winners[0].id];
      return { hits: new Set(h ? h.cards.slice(0, h.counted).map(cardId) : []), fadeOthers: true };
    }
    if (heroHand && game.board.length) {
      return { hits: new Set(heroHand.cards.slice(0, heroHand.counted).map(cardId)), fadeOthers: false };
    }
    return { hits: new Set<string>(), fadeOthers: false };
  }, [sd, heroHand, game.board.length]);

  const resultText = useMemo(() => {
    if (!sd || !sd.winners.length) return null;
    const names = sd.winners.map((w) => game.players.find((p) => p.id === w.id)!.name);
    const total = sd.winners.reduce((s, w) => s + w.amount, 0);
    const h = sd.hands[sd.winners[0].id];
    return `${names.join(' a ')} ${names.length > 1 ? 'berou' : 'bere'} ${fmt(total)}` + (h && !sd.uncontested ? ` · ${h.name}` : '');
  }, [sd, game.players]);

  const levelLeft = Math.max(0, game.levelEndsAt - now);
  const mm = String(Math.floor(levelLeft / 60000)).padStart(2, '0');
  const ss = String(Math.floor((levelLeft % 60000) / 1000)).padStart(2, '0');
  const next = game.config.blinds[Math.min(game.level + 1, game.config.blinds.length - 1)];
  const left = game.players.filter((p) => !p.out).length;
  const heroPlace = hero.place;

  const copyLink = () => {
    if (!ctl.online) return;
    copyText(joinLink(ctl.online.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <HeroContext.Provider value={heroId}>
      <header className="topbar">
        <div className="brand">
          <span className="sq" />
          <b>POKER</b>
          <span>
            {ctl.online ? `Online · stůl ${ctl.online.code}` : "Texas Hold'em"} · {cash ? 'cash game' : 'turnaj'}
          </span>
        </div>
        <div className="tinfo">
          {!cash && (
            <div>
              <span>Level</span>
              <b>{game.level + 1}</b>
            </div>
          )}
          <div>
            <span>Blindy</span>
            <b>
              {fmt(blinds.sb)} / {fmt(blinds.bb)}
              {blinds.ante ? ` (ante ${fmt(blinds.ante)})` : ''}
            </b>
          </div>
          {!cash && (
            <div>
              <span>
                Další {fmt(next.sb)} / {fmt(next.bb)} za
              </span>
              <b style={{ color: 'var(--amber)' }}>{paused ? 'pauza' : `${mm}:${ss}`}</b>
            </div>
          )}
          {cash && hero && (
            <div>
              <span>Tvůj zisk</span>
              <b style={{ color: profit(hero, game) >= 0 ? 'var(--success)' : 'var(--pixel-hot)' }}>
                {(profit(hero, game) >= 0 ? '+' : '') + fmt(profit(hero, game))}
              </b>
            </div>
          )}
          <div>
            <span>Hráči</span>
            <b>
              {left} / {n}
            </b>
          </div>
          <div>
            <span>Ruka</span>
            <b>#{game.handNo}</b>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ctl.online && (
            <button type="button" className="tb" onClick={copyLink}>
              {Icon.link(16)} {copied ? 'Zkopírováno' : 'Odkaz'}
            </button>
          )}
          <button type="button" className="tb" onClick={toggleSide} aria-pressed={sideOpen} title={sideOpen ? 'Skrýt pravý panel' : 'Ukázat pravý panel'}>
            {Icon.sidebar(16)} {sideOpen ? 'Skrýt panel' : 'Panel'}
          </button>
          {togglePause ? (
            <button type="button" className="tb" onClick={togglePause} aria-pressed={paused}>
              {paused ? Icon.play(16) : Icon.pause(16)} {paused ? 'Pokračovat' : 'Pauza'}
            </button>
          ) : (
            paused && <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 700 }}>Hostitel dal pauzu</span>
          )}
          <button type="button" className="tb" onClick={onExit}>
            {Icon.exit(16)} Opustit
          </button>
        </div>
      </header>

      <div
        className={'tablearea' + (game.rules.dark && game.phase !== 'handEnd' ? ' dark' : '') + (game.rules.quake ? ' quake' : '')}
        style={{ transform: sideOpen ? 'none' : 'translateX(180px)' }}
      >
      <div className="rail">
        <div className="felt">
          <div className="feltmark" aria-hidden="true">
            TEXAS HOLD'EM · NO LIMIT
          </div>
        </div>
      </div>

      <div className="deck">
        <div className="pile">
          <CardBack size="sm" />
          <CardBack size="sm" style={{ left: -2, top: -2 }} />
          <CardBack size="sm" style={{ left: -4, top: -4 }} />
        </div>
        <span>{game.deck.length} karet</span>
      </div>

      {pot > 0 && game.phase !== 'handEnd' && game.phase !== 'gameOver' && (
        <div className="pot">
          {!betsHidden && <ChipStack amount={pot - bets} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="lbl">BANK</span>
            <span className="amt">{betsHidden ? '?' : fmt(pot - bets > 0 ? pot - bets : pot)}</span>
            {!betsHidden && bets > 0 && pot - bets > 0 && <span className="sub">se sázkami {fmt(pot)}</span>}
          </div>
        </div>
      )}

      <Board game={game} hits={hits} fadeOthers={fadeOthers} />
      {resultText && game.phase !== 'betting' && (
        <div className="result" key={game.handNo}>
          {resultText}
        </div>
      )}

      {game.players.map((p) => {
        if (p.bet <= 0) return null;
        const rel = (p.seat - hero.seat + n) % n;
        const pt = seatPoint(rel, n);
        const bx = rel === 0 ? CX : CX + (pt.x - CX) * 0.66;
        const by = rel === 0 ? 488 : CY + (pt.y - CY) * 0.66;
        return (
          <div key={p.id + '-bet-' + game.street} className="bet" style={{ left: bx, top: by }}>
            {!(betsHidden && p.id !== heroId) && <ChipStack amount={p.bet} />}
            <span className="betamt">{betsHidden && p.id !== heroId ? '?' : fmt(p.bet)}</span>
          </div>
        );
      })}

      {game.players.map((p) => {
        if (p.id === heroId) return null;
        const rel = (p.seat - hero.seat + n) % n;
        const pt = seatPoint(rel, n);
        return <Seat key={p.id} p={p} x={pt.x} y={pt.y} game={game} hits={hits} winAmount={winAmounts.get(p.id)} away={away.has(p.id)} avatar={ctl.avatars[p.id]} />;
      })}

      {!hero.out && (
        <HeroSeat
          p={hero}
          game={game}
          hits={hits}
          winAmount={winAmounts.get(heroId)}
          avatar={ctl.avatars[heroId]}
          heroHandName={heroHand && (shownBoard.length || heroHand.cat > 0) ? HAND_NAMES[heroHand.cat] : null}
          picked={picked}
          onPick={picking ? togglePick : undefined}
        />
      )}

      <GameChangerLayer game={game} onAck={ctl.ack} />
      {picking ? (
        <ExchangeBar
          picked={picked.length}
          seconds={Math.max(0, Math.ceil((turnSecondsOf(game) * 1000 - (now - game.turnStartedAt)) / 1000))}
          onExchange={() => ctl.exchange(picked)}
          onKeep={() => ctl.exchange([])}
        />
      ) : (
        <ActionDock
          game={game}
          now={now}
          act={act}
          preAction={preAction}
          setPreAction={setPreAction}
          advice={hint?.advice ?? null}
          onBuyCard={canBuyCard(game, heroId) ? ctl.buyCard : undefined}
        />
      )}
      </div>
      {sideOpen && <SidePanel game={game} heroHand={heroHand} chat={ctl.chat} top={ctl.hints && hint ? <HintPanel hint={hint} /> : null} />}

      {paused && !togglePause && <div className="pausemark">PAUZA</div>}
      {hero.out && spectating && game.phase !== 'gameOver' && (
        <SpectatorBar place={heroPlace} onLeave={onExit} onRebuy={cash && ctl.rebuy ? () => (setSpectating(false), ctl.rebuy!()) : undefined} />
      )}
      {hero.out && !spectating && !cash && game.phase !== 'gameOver' && (
        <EliminatedDialog game={game} stats={stats} onWatch={() => setSpectating(true)} onLeave={onExit} />
      )}
      {hero.out && !spectating && cash && ctl.rebuy && (
        <RebuyDialog game={game} onRebuy={ctl.rebuy} onWatch={() => setSpectating(true)} onLeave={onExit} />
      )}
      {game.phase === 'gameOver' && (
        <GameOverDialog
          game={game}
          stats={stats}
          onRestart={
            restart
              ? () => {
                  setSpectating(false);
                  restart();
                }
              : undefined
          }
          onLeave={onExit}
        />
      )}
    </HeroContext.Provider>
  );
}

/** Cash game: kolik má hráč víc (nebo míň), než za kolik nakoupil. */
export function profit(p: PlayerState, game: GameState): number {
  return p.stack + p.committed - p.buyIns * game.config.startStack;
}

function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    /* schránka nedostupná */
  }
}
