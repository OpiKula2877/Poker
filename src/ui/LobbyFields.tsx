import { useEffect, useRef, useState } from 'react';
import { AVATAR_MAX } from '../net/protocol';
import { Avatar } from './Table';

/** Číslo s vlastní hodnotou: píše se volně, uloží se (a ořízne do mezí) po opuštění pole nebo Enteru. */
export function NumField({
  value,
  min,
  max,
  unit,
  label,
  disabled,
  width = 84,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  label: string;
  disabled?: boolean;
  width?: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Math.floor(Number(text.replace(/\s/g, '')));
    if (!Number.isFinite(v) || v <= 0) {
      setText(String(value));
      return;
    }
    const c = Math.min(max, Math.max(min, v));
    setText(String(c));
    if (c !== value) onCommit(c);
  };
  return (
    <span className="numfield">
      <input
        className="field"
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-label={label}
        title={`${label} (${min}–${max.toLocaleString('cs-CZ')})`}
        onChange={(e) => setText(e.target.value.replace(/[^\d\s]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        style={{ width, textAlign: 'right', fontWeight: 700 }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

/** Zmenší obrázek na čtverec 96×96 (ořez na střed) a vrátí JPEG data URL. */
async function toAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Obrázek nejde načíst.'));
      i.src = url;
    });
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    for (const q of [0.85, 0.7, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', q);
      if (data.length <= AVATAR_MAX) return data;
    }
    throw new Error('Obrázek je moc velký.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Profilový obrázek: náhled, nahrání a odebrání. */
export function AvatarPicker({ value, onChange, name }: { value: string | null; onChange: (v: string | null) => void; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return (
    <span className="avpick">
      <button type="button" className="avbtn" onClick={() => input.current?.click()} title="Nahrát profilový obrázek" aria-label="Nahrát profilový obrázek">
        <Avatar name={name || 'Ty'} src={value} me />
        <span className="edit" aria-hidden="true">
          +
        </span>
      </button>
      {value && (
        <button type="button" className="tb" style={{ height: 32, padding: '0 8px', fontSize: 11 }} onClick={() => onChange(null)}>
          Odebrat
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setError('');
            onChange(await toAvatar(f));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--error-text, #ff6b7a)' }}>{error}</span>}
    </span>
  );
}
