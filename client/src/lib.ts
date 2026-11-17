import { useEffect, useState } from 'react';
import type { GameState, RoomView } from '@cotyphu/shared';
import { PLAYER_COLORS } from './strings.vi';
import { serverNow, useStore } from './store';

/** Vị trí ô trên lưới 11×11: [hàng, cột] (1-based) */
export function cellOf(index: number): [number, number] {
  if (index <= 10) return [11, 11 - index];
  if (index <= 20) return [11 - (index - 10), 1];
  if (index <= 30) return [1, 1 + (index - 20)];
  return [1 + (index - 30), 11];
}

/** Cạnh của ô: dùng để đặt dải màu hướng vào trong */
export function sideOf(index: number): 'bottom' | 'left' | 'top' | 'right' | 'corner' {
  if (index % 10 === 0) return 'corner';
  if (index < 10) return 'bottom';
  if (index < 20) return 'left';
  if (index < 30) return 'top';
  return 'right';
}

const CORNER = 1.6;
const TOTAL = CORNER * 2 + 9;
function axisCenter(k: number): number {
  // k: 1..11
  if (k === 1) return CORNER / 2;
  if (k === 11) return TOTAL - CORNER / 2;
  return CORNER + (k - 2) + 0.5;
}
/** Tâm ô theo % chiều rộng/cao bàn cờ */
export function centerPct(index: number): { x: number; y: number } {
  const [r, c] = cellOf(index);
  return { x: (axisCenter(c) / TOTAL) * 100, y: (axisCenter(r) / TOTAL) * 100 };
}

export function playerColor(room: RoomView | null, id: string | null | undefined): string {
  if (!room || !id) return '#888';
  const i = room.players.findIndex((p) => p.id === id);
  return PLAYER_COLORS[(i < 0 ? 0 : i) % PLAYER_COLORS.length]!;
}

export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useGame(): {
  room: RoomView | null;
  game: GameState | null;
  me: string | null;
} {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  return { room, game: room?.game ?? null, me };
}

export function nameOf(room: RoomView | null, id: string | null | undefined): string {
  if (id === 'bank') return 'Ngân hàng';
  return room?.players.find((p) => p.id === id)?.name ?? '?';
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

/** Kích thước vùng hiển thị (cập nhật khi xoay màn hình / gập-mở máy gập) */
export function useViewport(): { w: number; h: number } {
  const read = () => ({
    w: Math.round(window.visualViewport?.width ?? window.innerWidth),
    h: Math.round(window.visualViewport?.height ?? window.innerHeight),
  });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  return vp;
}

export interface GameLayout {
  /** 'side': bàn cờ trái + panel phải (máy tính, điện thoại ngang, máy gập mở ngang)
   *  'stack': bàn cờ trên, thông tin dưới, tab ở đáy (điện thoại dọc, máy gập mở dọc) */
  mode: 'side' | 'stack';
  /** Cạnh bàn cờ (px) */
  board: number;
  /** Bề rộng panel bên phải (px, chế độ side) */
  panel: number;
  /** Màn hình thấp: dùng danh sách người chơi gọn */
  compact: boolean;
}

/** Chọn bố cục theo tỉ lệ màn hình, bàn cờ luôn vừa khít không tràn */
export function computeLayout(w: number, h: number): GameLayout {
  const pad = 16;
  if (w / h >= 1.15 && w >= 560) {
    const panel = Math.round(Math.min(400, Math.max(260, w * 0.36)));
    const board = Math.floor(Math.max(240, Math.min(h - pad, w - panel - pad * 2, 900)));
    return { mode: 'side', board, panel, compact: h < 640 };
  }
  // Dọc: chừa chỗ cho thanh trên + người chơi (~150px) và thanh tab ở đáy (~76px)
  const board = Math.floor(Math.max(240, Math.min(w - pad, h - 226, 900)));
  return { mode: 'stack', board, panel: 0, compact: true };
}
