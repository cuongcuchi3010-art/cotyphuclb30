import { motion } from 'framer-motion';
import { useState } from 'react';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { TokenIcon } from './TokenIcon';

/** Màn hình "BÁO DANH": nhập mật khẩu chung mới được vào (chặn bot) */
export function GateScreen() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [passed, setPassed] = useState(false);

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setPassed(true);
        setTimeout(() => useStore.setState({ gate: true }), 900);
        return;
      }
      setErr(S.gate.wrong);
      setShake((n) => n + 1);
      setPw('');
    } catch {
      setErr('Không kết nối được máy chủ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-5">
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -14, 14, -10, 10, -4, 0] } : {}}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-sm"
      >
        {/* Tấm thẻ báo danh */}
        <div className="relative overflow-hidden rounded-2xl border-[3px] border-son bg-[#FFF8E7] p-1.5 shadow-card dark:bg-[#2a2210]">
          <div className="rounded-xl border border-dashed border-son/60 px-6 pb-7 pt-6 text-center">
            {/* Hoạ tiết trống đồng mờ */}
            <svg
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 opacity-[0.08]"
              viewBox="0 0 100 100"
            >
              {[46, 36, 26, 16].map((r) => (
                <circle
                  key={r}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="#C8102E"
                  strokeWidth="2"
                />
              ))}
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <path
                    key={i}
                    d={`M50 50 L${50 + Math.cos(a - 0.12) * 12} ${50 + Math.sin(a - 0.12) * 12} L${50 + Math.cos(a) * 20} ${50 + Math.sin(a) * 20} L${50 + Math.cos(a + 0.12) * 12} ${50 + Math.sin(a + 0.12) * 12}Z`}
                    fill="#C8102E"
                  />
                );
              })}
            </svg>

            <div className="mb-1 text-xs font-bold uppercase tracking-[0.35em] text-son/80">
              {S.gate.club}
            </div>
            <h1
              className="font-black tracking-[0.18em] text-son"
              style={{ fontSize: 44, lineHeight: 1 }}
            >
              {S.gate.title}
            </h1>
            <div className="mx-auto my-3 flex w-40 items-center gap-2 text-nghe-600">
              <span className="h-px flex-1 bg-current" />
              <span>✦</span>
              <span className="h-px flex-1 bg-current" />
            </div>
            <p className="mb-5 text-sm text-gray-700 dark:text-gray-200">{S.gate.subtitle}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="block text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                {S.gate.label}
              </label>
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full border-0 border-b-2 border-son/60 bg-transparent px-1 py-2 text-center text-xl tracking-widest outline-none focus:border-son"
                placeholder="• • • • • •"
              />
              {err && <div className="mt-2 text-sm font-semibold text-son">{err}</div>}
              <button
                type="submit"
                disabled={!pw || busy || passed}
                className="mt-5 w-full rounded-xl bg-son py-3 text-lg font-extrabold uppercase tracking-widest text-white shadow transition hover:bg-son-600 active:scale-[0.98] disabled:opacity-50"
              >
                ✋ {S.gate.submit}
              </button>
            </form>
            <div className="mt-5 flex justify-center gap-1 opacity-80">
              {(['non-la', 'xe-may', 'hoa-sen', 'ao-dai'] as const).map((t) => (
                <TokenIcon key={t} token={t} size={26} />
              ))}
            </div>
          </div>
        </div>

        {/* Con dấu đỏ */}
        <motion.div
          initial={false}
          animate={
            passed ? { scale: 1, opacity: 1, rotate: -14 } : { scale: 2.4, opacity: 0, rotate: -30 }
          }
          transition={{ type: 'spring', stiffness: 260, damping: 15 }}
          className="pointer-events-none absolute right-4 top-24 flex h-28 w-28 items-center justify-center rounded-full border-[5px] border-son text-center font-black uppercase leading-tight text-son"
          style={{ background: 'rgb(200 16 46 / 0.06)' }}
        >
          <span className="text-[13px] tracking-wider">
            {S.gate.stamp1}
            <br />
            <span className="text-lg">CLB30</span>
            <br />
            {S.gate.stamp2}
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
