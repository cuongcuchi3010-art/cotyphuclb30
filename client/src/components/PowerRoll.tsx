import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib';
import { S } from '../strings.vi';

/** Thời gian thanh lực chạy 0 → 100 (và 100 → 0) */
const SWEEP_MS = 2000;
/** Bấm nhanh hơn mức này coi như chạm nhẹ: tung ngẫu nhiên */
const TAP_MS = 180;

/** Lực tại thời điểm `t` ms kể từ lúc nhấn: 0→100 trong 2 giây, rồi 100→0; null = đã về 0 */
function powerAt(t: number): number | null {
  if (t <= SWEEP_MS) return (t / SWEEP_MS) * 100;
  if (t <= SWEEP_MS * 2) return 100 - ((t - SWEEP_MS) / SWEEP_MS) * 100;
  return null;
}

/**
 * Nút tung xúc xắc canh lực: nhấn giữ để thanh lực chạy, buông tay để tung theo lực.
 * Chạm nhẹ hoặc giữ tới khi thanh chạy về 0 → tung ngẫu nhiên.
 */
export function PowerRollButton({
  onRoll,
  children,
  className,
  variant = 'primary',
}: {
  onRoll: (power?: number) => void;
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [power, setPower] = useState<number | null>(null);
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const fired = useRef(false);

  const stop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    start.current = null;
    setPower(null);
  };
  useEffect(() => stop, []);

  const fire = (p?: number) => {
    if (fired.current) return;
    fired.current = true;
    stop();
    onRoll(p);
  };

  const tick = () => {
    if (start.current === null) return;
    const p = powerAt(performance.now() - start.current);
    if (p === null) {
      fire(); // về 0 mà chưa buông: tung ngẫu nhiên
      return;
    }
    setPower(p);
    raf.current = requestAnimationFrame(tick);
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 || start.current !== null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    fired.current = false;
    start.current = performance.now();
    setPower(0);
    raf.current = requestAnimationFrame(tick);
  };
  const up = () => {
    if (start.current === null) return;
    const t = performance.now() - start.current;
    const p = powerAt(t);
    if (t < TAP_MS || p === null) fire();
    else fire(Math.max(1, Math.min(100, Math.round(p))));
  };

  const charging = power !== null;
  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fired.current = false;
          fire();
        }
      }}
      className={cx(
        'relative inline-flex select-none flex-col items-center justify-center overflow-hidden rounded-xl font-semibold text-white shadow transition [-webkit-touch-callout:none] [touch-action:none]',
        variant === 'primary' ? 'bg-son hover:bg-son-600' : 'bg-ngoc hover:bg-ngoc-600',
        charging && 'scale-[0.98]',
        className,
      )}
    >
      {/* Thanh lực */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-nghe/80"
        style={{ width: `${power ?? 0}%`, transition: charging ? 'none' : 'width 0.2s' }}
      />
      <span className="relative z-[1] flex items-center gap-1.5">
        {charging ? `💪 ${S.power.label} ${Math.round(power)}%` : children}
      </span>
      {!charging && (
        <span className="relative z-[1] text-[10px] font-normal leading-none opacity-80">
          {S.power.hint}
        </span>
      )}
    </button>
  );
}
