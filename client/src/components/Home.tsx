import { useEffect, useState } from 'react';
import { ROOM_CODE_LEN, type Profile } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { navigate } from '../router';
import { api, saveAuth, useStore } from '../store';
import { Btn, Panel } from './ui';
import { AvatarEditor } from './AvatarEditor';
import { DiscordButton } from './DiscordButton';
import { TokenIcon } from './TokenIcon';

export function Home() {
  const auth = useStore((s) => s.auth);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rooms, setRooms] = useState<Profile['rooms']>([]);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    void api<Profile>('/api/me').then((r) => {
      if (r.ok) {
        setRooms(r.data.rooms ?? []);
        if (r.data.avatarV && r.data.id)
          setAvatar(`/api/avatar/${encodeURIComponent(r.data.id)}?v=${r.data.avatarV}`);
      }
    });
  }, []);

  const removeRoom = async (code?: string) => {
    if (!code && !window.confirm(S.home.confirmClear)) return;
    const prev = rooms;
    setRooms(code ? rooms.filter((r) => r.code !== code) : []);
    const r = await api<{ rooms?: Profile['rooms'] }>(
      code ? `/api/me/rooms/${encodeURIComponent(code)}` : '/api/me/rooms',
      { method: 'DELETE' },
    );
    if (r.ok && r.data.rooms) setRooms(r.data.rooms);
    else if (!r.ok) setRooms(prev);
  };

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ code?: string; hostKey?: string; error?: string }>('/api/rooms', {
        method: 'POST',
      });
      if (!r.ok || !r.data.code) throw new Error(r.data.error ?? 'Lỗi');
      try {
        sessionStorage.setItem(`cotyphu:hostKey:${r.data.code}`, r.data.hostKey ?? '');
      } catch {
        /* bỏ qua */
      }
      navigate(`/r/${r.data.code}`);
    } catch (e) {
      setErr((e as Error).message || 'Không tạo được phòng');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    saveAuth(null);
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

      <div className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm shadow dark:bg-white/10">
        <span className="min-w-0 flex-1 truncate">{S.auth.hello(auth?.username ?? '')}</span>
        <DiscordButton full />
        <button
          type="button"
          className="font-semibold text-son underline"
          onClick={() => void logout()}
        >
          {S.auth.logout}
        </button>
      </div>

      <Panel className="p-4">
        <div className="mb-2 text-sm font-bold">{S.avatar.title}</div>
        <AvatarEditor current={avatar} onChange={setAvatar} />
      </Panel>

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

      {rooms.length > 0 && (
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold">{S.home.recent}</div>
            <button
              type="button"
              onClick={() => void removeRoom()}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-son hover:bg-son/10"
            >
              🗑 {S.home.clearRooms}
            </button>
          </div>
          <div className="space-y-1.5">
            {rooms.map((r) => (
              <div
                key={r.code}
                className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5"
              >
                <span className="font-mono text-lg tracking-widest">{r.code}</span>
                <span className="text-xs text-gray-500">
                  {new Date(r.at).toLocaleString('vi-VN')}
                </span>
                <div className="flex items-center gap-1">
                  <Btn variant="secondary" onClick={() => navigate(`/r/${r.code}`)}>
                    {S.home.rejoin}
                  </Btn>
                  <button
                    type="button"
                    aria-label={S.home.removeRoom}
                    title={S.home.removeRoom}
                    onClick={() => void removeRoom(r.code)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-son/10 hover:text-son"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <p className="text-center text-sm text-gray-500">{S.home.how}</p>
    </div>
  );
}
