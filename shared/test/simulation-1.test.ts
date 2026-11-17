import { expect, it } from 'vitest';
import { runSimulation } from './sim.js';

// Mô phỏng 500 ván (chia 4 file chạy song song): ván 0–124
const TOTAL = Number(process.env.SIM_GAMES ?? 500);
const PER = Math.ceil(TOTAL / 4);

for (let chunk = 0; chunk < PER; chunk += 25) {
  const from = 0 * PER + chunk;
  const count = Math.min(25, PER - chunk);
  it(`mô phỏng ván ${from}–${from + count - 1}: giữ invariant, không lặp vô hạn`, () => {
    const r = runSimulation(from, count);
    expect(r.finished + r.capped).toBe(count);
  }, 120_000);
}
