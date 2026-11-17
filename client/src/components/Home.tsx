import { useState } from 'react';
import { ROOM_CODE_LEN } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { navigate } from '../router';
import { Btn, Panel } from './ui';
import { TokenIcon } from './TokenIcon';

export function Home() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      const data = (await res.json()) as { code?: string; hostKey?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? 'Lỗi');
      try {
        sessionStorage.setItem(`cotyphu:hostKey:${data.code}`, data.hostKey ?? '');
      } catch {
        /* bỏ qua */
      }
      navigate(`/r/${data.code}`);
    } catch (e) {
      setErr((e as Error).message || 'Không tạo được phòng');
    } finally {
      setBusy(false);
    }
  };

  const clean = (v: string) =>
    v
      .toUpperCase()
      .replace(/[^A-HJ-NP-Z2-9]/g, '')
      .slice(0, ROOM_CODE_LEN);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-5 p-5">
      <div className="text-center">
        <div className="mb-3 flex justify-center gap-1">
          {(['xe-may', 'non-la', 'banh-mi', 'ca-phe', 'hoa-sen', 'ao-dai'] as const).map((t, i) => (
            <span
              key={t}
              className="animate-bounce-slow"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <TokenIcon token={t} size={36} />
            </span>
          ))}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-son dark:text-nghe">
          Cờ Tỷ Phú <span className="rounded-lg bg-nghe px-2 text-son-700">CLB30</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">{S.tagline}</p>
      </div>

      <Panel className="space-y-4 p-5">
        <Btn big className="w-full text-lg" disabled={busy} onClick={create}>
          {busy ? S.home.creating : `🎲 ${S.home.create}`}
        </Btn>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-current" />
          hoặc
          <span className="h-px flex-1 bg-current" />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length !== ROOM_CODE_LEN) {
              setErr(S.home.invalidCode);
              return;
            }
            navigate(`/r/${code}`);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(clean(e.target.value))}
            placeholder={S.home.codePlaceholder}
            autoCapitalize="characters"
            className="min-h-[48px] w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 text-center font-mono text-xl tracking-[0.3em] dark:border-white/20 dark:bg-black/30"
          />
          <Btn big variant="secondary" type="submit">
            {S.home.join}
          </Btn>
        </form>
        {err && <div className="text-center text-sm text-son">{err}</div>}
      </Panel>
      <p className="text-center text-sm text-gray-500">{S.home.how}</p>
    </div>
  );
}
