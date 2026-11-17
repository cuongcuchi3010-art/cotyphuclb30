import type { Rng } from './types.js';

/** RNG có seed (mulberry32) — dùng cho test và mô phỏng */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

/** RNG mật mã (Web Crypto) — dùng ở server, không lệch (rejection sampling) */
export function cryptoRng(): Rng {
  return {
    int(min, max) {
      const range = max - min + 1;
      const limit = Math.floor(0x100000000 / range) * range;
      const buf = new Uint32Array(1);
      for (;;) {
        crypto.getRandomValues(buf);
        if (buf[0]! < limit) return min + (buf[0]! % range);
      }
    },
  };
}

/** RNG phát lại dãy số cho trước (test) */
export function scriptedRng(values: number[], fallback: Rng = seededRng(1)): Rng {
  const q = values.slice();
  return {
    int(min, max) {
      const v = q.shift();
      if (v === undefined) return fallback.int(min, max);
      if (v < min || v > max) throw new Error(`scriptedRng: ${v} ngoài [${min},${max}]`);
      return v;
    },
  };
}
