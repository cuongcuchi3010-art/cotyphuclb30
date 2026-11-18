import { useRef, useState } from 'react';
import { S } from '../strings.vi';
import { api } from '../store';
import { Btn } from './ui';

/** Bộ biểu tượng có sẵn để làm ảnh đại diện */
const PRESETS = [
  '😎',
  '🐯',
  '🐼',
  '🦊',
  '🐸',
  '🐵',
  '🦁',
  '🐧',
  '🐲',
  '🦄',
  '👑',
  '🔥',
  '🌸',
  '⚽',
  '🎮',
  '🍜',
];
const PRESET_BG = ['#FDE68A', '#FBCFE8', '#BFDBFE', '#BBF7D0', '#DDD6FE', '#FED7AA'];

const SIZE = 160;

/** Cắt ảnh vuông ở giữa, thu nhỏ còn 160×160, nén JPEG (khoảng 10–20 KB) */
async function photoToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d')!;
    g.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emojiToDataUrl(emoji: string, bg: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, SIZE, SIZE);
  g.font = `${SIZE * 0.62}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, SIZE / 2, SIZE / 2 + SIZE * 0.04);
  return c.toDataURL('image/png');
}

export function AvatarEditor({
  current,
  onChange,
}: {
  current: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = async (data: string | null) => {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ avatarV?: number; error?: string }>('/api/me/avatar', {
        method: data ? 'PUT' : 'DELETE',
        body: data ? JSON.stringify({ data }) : undefined,
      });
      if (!r.ok) throw new Error(r.data.error ?? 'Lỗi');
      onChange(data);
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message || 'Không lưu được ảnh');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5 ring-2 ring-son dark:bg-white/10">
          {current ? (
            <img src={current} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-gray-500">{S.avatar.token}</span>
          )}
        </span>
        <div className="flex flex-1 flex-wrap gap-2">
          <Btn variant="secondary" disabled={busy} onClick={() => file.current?.click()}>
            📷 {S.avatar.upload}
          </Btn>
          <Btn variant="ghost" disabled={busy} onClick={() => setOpen(!open)}>
            😎 {S.avatar.presets}
          </Btn>
          {current && (
            <Btn variant="ghost" disabled={busy} onClick={() => void save(null)}>
              {S.avatar.reset}
            </Btn>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await save(await photoToDataUrl(f));
            } catch {
              setErr(S.avatar.bad);
            }
          }}
        />
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {PRESETS.map((e, i) => (
            <button
              key={e}
              type="button"
              disabled={busy}
              onClick={() => void save(emojiToDataUrl(e, PRESET_BG[i % PRESET_BG.length]!))}
              className="flex aspect-square items-center justify-center rounded-full text-2xl hover:scale-110"
              style={{ background: PRESET_BG[i % PRESET_BG.length] }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      {err && <div className="mt-2 text-sm text-son">{err}</div>}
      <div className="mt-2 text-xs text-gray-500">{S.avatar.hint}</div>
    </div>
  );
}
