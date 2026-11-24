import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CASINO_NAMES,
  casinoKindAt,
  square,
  type Card,
  type GameState,
  type RoomView,
} from '@cotyphu/shared';
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
/** Cạnh bàn cờ theo đơn vị ô thường (ô góc = 1,6) */
export const BOARD_UNITS = TOTAL;

/** Toạ độ 3D (x, z) của tâm ô, gốc ở giữa bàn; hàng dưới (ô 0–10) ở phía +z */
export function boardXZ(index: number): [number, number] {
  const [r, c] = cellOf(index);
  return [axisCenter(c) - TOTAL / 2, axisCenter(r) - TOTAL / 2];
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

/** URL ảnh đại diện của người chơi (null = dùng quân cờ) */
export function photoOf(room: RoomView | null, id: string | null | undefined): string | null {
  return room?.players.find((p) => p.id === id)?.avatar ?? null;
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
/** Đang gõ trong ô nhập (bàn phím ảo có thể đang mở) */
function typing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const t = (el as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(t);
}

/**
 * Kích thước màn hình để chọn bố cục.
 * Khi bàn phím ảo bật (đang gõ, chỉ chiều cao giảm) thì GIỮ NGUYÊN kích thước cũ:
 * nếu không, màn hình gần vuông (Z Fold mở trong) sẽ bị coi là nằm ngang → đổi bố cục →
 * ô nhập bị dựng lại, mất focus và bàn phím tắt ngay.
 */
export function useViewport(): { w: number; h: number } {
  // Máy có chuột (Windows): innerWidth/innerHeight tính cả thanh cuộn, để thanh cuộn hiện/ẩn
  // không làm bố cục đổi qua lại. Điện thoại / máy tính bảng: KHÔNG dùng innerWidth vì trình
  // duyệt di động nới innerWidth theo nội dung tràn ngang → bàn cờ to ra, lệch khỏi màn hình;
  // dùng visualViewport (thanh cuộn trên di động nổi, không chiếm chỗ).
  const read = () => {
    const fine = window.matchMedia?.('(pointer: fine)').matches ?? false;
    const vv = window.visualViewport;
    if (fine || !vv) return { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) };
    return {
      w: Math.round(Math.min(vv.width * (vv.scale || 1), document.documentElement.clientWidth)),
      h: Math.round(vv.height * (vv.scale || 1)),
    };
  };
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => {
      const next = read();
      setVp((prev) => {
        if (next.w === prev.w && next.h < prev.h && typing()) return prev;
        return next.w === prev.w && next.h === prev.h ? prev : next;
      });
    };
    // Gõ xong (bàn phím đóng): đọc lại kích thước thật
    const onBlur = () => setTimeout(on, 300);
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    window.visualViewport?.addEventListener('resize', on);
    document.addEventListener('focusout', onBlur);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      window.visualViewport?.removeEventListener('resize', on);
      document.removeEventListener('focusout', onBlur);
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
export function computeLayout(w: number, h: number, reserved = 226, sideW = 0): GameLayout {
  const pad = 16;
  if (w / h >= 1.15 && w >= 560) {
    const panel = Math.round(Math.min(400, Math.max(260, w * 0.36)));
    // Chừa thêm vài px để làm tròn điểm ảnh (Windows phóng 125%/150%) không gây tràn trang
    const board = Math.floor(Math.max(240, Math.min(h - pad - 4, w - panel - pad * 2 - 20, 900)));
    return { mode: 'side', board, panel, compact: h < 640 };
  }
  // Dọc: chừa đúng chiều cao thật của phần dưới bàn cờ (thanh trên, người chơi, thanh tab)
  // Chuột (máy tính): trang dọc có thể có thanh cuộn ~17px, chừa sẵn để không tràn ngang
  const bar =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches ? 18 : 0;
  const board = Math.floor(Math.max(240, Math.min(w - pad - bar - sideW, h - reserved, 900)));
  return { mode: 'stack', board, panel: 0, compact: true };
}

/** Đo chiều cao thật của một phần tử (cập nhật khi nội dung đổi) */
export function useMeasuredHeight<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    setH(Math.ceil(el.getBoundingClientRect().height));
    return () => ro.disconnect();
  }, []);
  return [ref, h];
}

/** Tên ô theo ván (Freestyle: ô 12 / 28 là Sòng Bạc) */
export function squareName(game: GameState | null | undefined, pos: number, short = false): string {
  const ck = game ? casinoKindAt(game, pos) : null;
  if (ck) return CASINO_NAMES[ck];
  if (game?.rules.mode === 'freestyle' && pos === 20) return 'Lễ Hội';
  const sq = square(pos);
  return short ? (sq.short ?? sq.name) : sq.name;
}

/**
 * Hình biểu trưng của ô (SVG trong /tiles), dùng chung cho bàn 2D và mặt ô 3D.
 * Ô công ty (METUB, EVN…) giữ logo thật nên trả null.
 */
export function tileIconUrl(game: GameState | null | undefined, pos: number): string | null {
  const ck = game ? casinoKindAt(game, pos) : null;
  if (ck) return `/tiles/casino-${ck}.svg`;
  if (pos === 20 && (game?.rules.mode === 'freestyle' || !!game?.rules.festivalSquare))
    return '/tiles/festival.svg';
  const sq = square(pos);
  switch (sq.kind) {
    case 'street':
      return `/tiles/${pos}.svg`;
    case 'tax':
      return `/tiles/tax-${pos}.svg`;
    case 'go':
    case 'chest':
    case 'chance':
    case 'jail':
    case 'parking':
    case 'goToJail':
      return `/tiles/${sq.kind}.svg`;
    default:
      return null;
  }
}

/** Chữ trên thẻ theo luật ván: tiền Khởi Hành, hệ số tiền Freestyle, thẻ tiện ích → Sòng Bạc */
export function cardText(game: GameState | null | undefined, card: Card): string {
  if (!game) return card.text;
  const free = game.rules.mode === 'freestyle';
  if (free && card.effect.type === 'nearestUtility')
    return 'Đi tới Sòng Bạc gần nhất phía trước và mở bàn cược như khi dừng ở ô.';
  const go = game.rules.goSalary ?? 200;
  const mult = free ? (game.rules.feeMult ?? 2) : 1;
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('vi-VN')} tỷ` : `${n} tr`);
  return card.text.replace(/(\d+) tr/g, (m, n: string) => {
    const v = Number(n);
    // "200 tr" đi kèm Khởi Hành là tiền lương; còn lại là tiền thẻ
    if (v === 200 && /Khởi Hành/.test(card.text)) return fmt(go);
    return mult === 1 ? m : fmt(Math.round(v * mult));
  });
}
