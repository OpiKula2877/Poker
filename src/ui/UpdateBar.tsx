import { useRegisterSW } from 'virtual:pwa-register/react';

/** Lišta „je k dispozici nová verze“ – obnoví stránku až na pokyn hráče. */
export function UpdateBar() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Kontrola nové verze každou hodinu, i když stránka zůstane otevřená.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="updatebar" role="status">
      <span>Je připravená nová verze hry.</span>
      <button type="button" className="btn primary" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={() => void updateServiceWorker(true)}>
        Obnovit
      </button>
      <button type="button" className="tb" style={{ height: 36 }} onClick={() => setNeedRefresh(false)}>
        Později
      </button>
    </div>
  );
}
