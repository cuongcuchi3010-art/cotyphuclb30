import { useState } from 'react';
import { NAME_MAX, type AuthResponse } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { api, saveAuth } from '../store';
import { Btn, Panel } from './ui';
import { TokenIcon } from './TokenIcon';
import { LegalNotice } from './LegalNotice';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (mode === 'register' && password !== password2) {
      setErr(S.auth.mismatch);
      return;
    }
    setBusy(true);
    try {
      const r = await api<AuthResponse & { error?: string }>(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok || !r.data.token) {
        setErr(r.data.error ?? 'Có lỗi xảy ra, thử lại nhé');
        return;
      }
      saveAuth({ token: r.data.token, username: r.data.username });
    } catch {
      setErr('Không kết nối được máy chủ');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'mt-1 min-h-[48px] w-full rounded-xl border border-black/10 bg-white px-3 text-base font-normal dark:border-white/20 dark:bg-black/30';

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
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{S.auth.why}</p>
      </div>

      <Panel className="p-5">
        <div className="mb-4 flex gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErr('');
              }}
              className={
                'flex-1 rounded-lg py-2 text-sm font-semibold ' +
                (mode === m ? 'bg-white shadow dark:bg-gray-800' : 'text-gray-500')
              }
            >
              {m === 'login' ? S.auth.login : S.auth.register}
            </button>
          ))}
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="block text-sm font-semibold">
            {S.auth.username}
            <input
              value={username}
              maxLength={NAME_MAX}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              className={input}
              placeholder="Ví dụ: Lan"
            />
            {mode === 'register' && (
              <span className="mt-1 block text-xs font-normal text-gray-500">
                {S.auth.usernameHint}
              </span>
            )}
          </label>
          <label className="block text-sm font-semibold">
            {S.auth.password}
            <input
              type="password"
              value={password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
          </label>
          {mode === 'register' && (
            <label className="block text-sm font-semibold">
              {S.auth.password2}
              <input
                type="password"
                value={password2}
                autoComplete="new-password"
                onChange={(e) => setPassword2(e.target.value)}
                className={input}
              />
            </label>
          )}
          {err && <div className="text-center text-sm text-son">{err}</div>}
          <Btn
            big
            type="submit"
            className="w-full text-lg"
            disabled={busy || !username.trim() || !password}
          >
            {mode === 'login' ? S.auth.submitLogin : S.auth.submitRegister}
          </Btn>
        </form>
      </Panel>
      <LegalNotice />
    </div>
  );
}
