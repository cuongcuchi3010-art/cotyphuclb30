import { describe, expect, it } from 'vitest';
import { cellOf, centerPct, fmtClock, sideOf } from '../src/lib';

describe('Hình học bàn cờ', () => {
  it('40 ô nằm đúng viền lưới 11×11, không trùng nhau', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const [r, c] = cellOf(i);
      expect(r === 1 || r === 11 || c === 1 || c === 11).toBe(true);
      seen.add(`${r},${c}`);
    }
    expect(seen.size).toBe(40);
    expect(cellOf(0)).toEqual([11, 11]);
    expect(cellOf(10)).toEqual([11, 1]);
    expect(cellOf(20)).toEqual([1, 1]);
    expect(cellOf(30)).toEqual([1, 11]);
  });
  it('cạnh và tâm ô', () => {
    expect(sideOf(5)).toBe('bottom');
    expect(sideOf(15)).toBe('left');
    expect(sideOf(25)).toBe('top');
    expect(sideOf(35)).toBe('right');
    expect(sideOf(20)).toBe('corner');
    const c = centerPct(20);
    expect(c.x).toBeCloseTo(c.y);
    expect(c.x).toBeLessThan(10);
  });
  it('đồng hồ', () => {
    expect(fmtClock(9_000)).toBe('9s');
    expect(fmtClock(90_000)).toBe('1:30');
    expect(fmtClock(-5)).toBe('0s');
  });
});
