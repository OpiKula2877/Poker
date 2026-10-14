import type { Advice, Hint } from '../bots/hints';

const ADVICE: Record<Advice, string> = { fold: 'FOLD', check: 'CHECK', call: 'DOROVNAT', raise: 'NAVÝŠIT' };
const pct = (x: number) => Math.round(x * 100) + ' %';

/** Trénink: šance na výhru, pot odds, outy a doporučený tah. */
export function HintPanel({ hint }: { hint: Hint }) {
  return (
    <aside className="hintbar" aria-label="Nápověda">
      <span className="kick">NÁPOVĚDA</span>
      <div className="row">
        <span>Šance na výhru</span>
        <b>{hint.equity === null ? '?' : pct(hint.equity)}</b>
      </div>
      {hint.potOdds > 0 && (
        <div className="row">
          <span>Potřebná šance (pot odds)</span>
          <b>{pct(hint.potOdds)}</b>
        </div>
      )}
      {hint.outs !== null && (
        <div className="row">
          <span>Outy na další kartě</span>
          <b>{hint.outs}</b>
        </div>
      )}
      <div className="row" style={{ alignItems: 'center' }}>
        <span>Doporučení</span>
        <span className="adv">{ADVICE[hint.advice]}</span>
      </div>
      <span className="tx">{hint.text}</span>
    </aside>
  );
}
