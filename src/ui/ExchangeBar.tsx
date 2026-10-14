/** Draw poker: místo běžného ovládání lišta s výběrem karet k výměně. */
export function ExchangeBar({ picked, seconds, onExchange, onKeep }: { picked: number; seconds: number; onExchange: () => void; onKeep: () => void }) {
  return (
    <section className="dock" aria-label="Výměna karet">
      <div className="row1">
        <div className="info">
          <b>Výměna karet</b>
          <span>Klikni na karty, které chceš vyměnit (nejvýš 2) · {seconds} s</span>
        </div>
      </div>
      <div className="btns" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" className="btn ghost" onClick={onKeep}>
          Nechat si karty
        </button>
        <button type="button" className="btn primary" disabled={!picked} onClick={onExchange}>
          {picked ? `Vyměnit ${picked} ${picked === 1 ? 'kartu' : 'karty'}` : 'Vyber karty'}
        </button>
      </div>
    </section>
  );
}
