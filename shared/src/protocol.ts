import { z } from 'zod';
import type { GameEvent } from './actions.js';
import { TOKENS, type GameState, type PlayerId, type Rules, type TokenId } from './types.js';

export const NAME_MAX = 20;
export const CHAT_MAX = 300;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ 0/O, 1/I
export const ROOM_CODE_LEN = 6;
export const MAX_PLAYERS = 6;

export const roomCodeSchema = z
  .string()
  .length(ROOM_CODE_LEN)
  .regex(/^[A-HJ-NP-Z2-9]+$/);

const pos = z.number().int().min(0).max(39);
const money = z.number().int().min(0).max(1_000_000);

const tradeSide = z.object({
  cash: money,
  properties: z.array(pos).max(28),
  jailCards: z.number().int().min(0).max(2),
});

export const playerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('roll') }),
  z.object({ type: z.literal('payBail') }),
  z.object({ type: z.literal('useJailCard') }),
  z.object({ type: z.literal('buy') }),
  z.object({ type: z.literal('decline') }),
  z.object({ type: z.literal('bid'), amount: money }),
  z.object({ type: z.literal('build'), pos }),
  z.object({ type: z.literal('sell'), pos }),
  z.object({ type: z.literal('mortgage'), pos }),
  z.object({ type: z.literal('unmortgage'), pos }),
  z.object({ type: z.literal('mortgageChoice'), pos, redeem: z.boolean() }),
  z.object({ type: z.literal('endTurn') }),
  z.object({ type: z.literal('payDebt') }),
  z.object({ type: z.literal('declareBankruptcy') }),
  z.object({
    type: z.literal('proposeTrade'),
    to: z.string().min(1).max(40),
    give: tradeSide,
    take: tradeSide,
    counterOf: z.string().max(20).optional(),
  }),
  z.object({ type: z.literal('acceptTrade'), id: z.string().max(20) }),
  z.object({ type: z.literal('rejectTrade'), id: z.string().max(20) }),
  z.object({ type: z.literal('cancelTrade'), id: z.string().max(20) }),
  z.object({ type: z.literal('resign') }),
  z.object({ type: z.literal('bankLoan'), amount: money }),
  z.object({ type: z.literal('repayLoan'), id: z.string().max(20) }),
  z.object({
    type: z.literal('proposeLoan'),
    to: z.string().min(1).max(40),
    lend: z.boolean(),
    amount: money,
    repay: money,
    turns: z.number().int().min(1).max(50),
  }),
  z.object({ type: z.literal('acceptLoan'), id: z.string().max(20) }),
  z.object({ type: z.literal('rejectLoan'), id: z.string().max(20) }),
  z.object({ type: z.literal('cancelLoan'), id: z.string().max(20) }),
]);

export const rulesSchema = z.object({
  startingCash: z.number().int().min(500).max(5000),
  jackpot: z.boolean(),
  doubleGo: z.boolean(),
  auctions: z.boolean(),
  timeLimitMinutes: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(90)]),
  turnTimerSec: z
    .number()
    .int()
    .refine((v) => v === 0 || (v >= 30 && v <= 300), {
      message: 'Đồng hồ lượt từ 30–300 giây hoặc tắt',
    }),
  houseStock: z.number().int().min(4).max(200).default(32),
  hotelStock: z.number().int().min(1).max(100).default(12),
  showStandings: z.boolean().default(false),
  buildRule: z.enum(['monopoly', 'landing']).default('monopoly'),
});

/** Biệt danh = tên đăng nhập: chữ (có dấu), số, khoảng trắng, . _ - */
export const usernameSchema = z
  .string()
  .transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(2, 'Biệt danh tối thiểu 2 ký tự')
      .max(NAME_MAX, `Biệt danh tối đa ${NAME_MAX} ký tự`)
      .regex(/^[\p{L}\p{N} ._-]+$/u, 'Biệt danh chỉ gồm chữ, số, khoảng trắng và . _ -'),
  );

export const passwordSchema = z
  .string()
  .min(6, 'Mật khẩu tối thiểu 6 ký tự')
  .max(64, 'Mật khẩu tối đa 64 ký tự');

export const authRequestSchema = z.object({ username: usernameSchema, password: passwordSchema });

/** Khoá tài khoản: không phân biệt hoa/thường */
export function accountKey(username: string): string {
  return username.normalize('NFC').trim().toLocaleLowerCase('vi');
}

export interface AuthResponse {
  token: string;
  username: string;
}

export interface Profile {
  username: string;
  rooms: { code: string; at: number }[];
}

const tokenSchema = z.enum(TOKENS);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    token: tokenSchema,
    password: z.string().max(40).optional(),
    /** Khoá chủ phòng do API tạo phòng trả về */
    hostKey: z.string().max(80).optional(),
  }),
  /** Vào lại ghế của tài khoản (đổi thiết bị / tải lại trang) */
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('spectate'), password: z.string().max(40).optional() }),
  z.object({ type: z.literal('setProfile'), token: tokenSchema }),
  z.object({ type: z.literal('setRules'), rules: rulesSchema }),
  z.object({ type: z.literal('setPassword'), password: z.string().max(40) }),
  z.object({ type: z.literal('kick'), playerId: z.string().max(40) }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('action'), action: playerActionSchema }),
  z.object({ type: z.literal('chat'), text: z.string().min(1).max(CHAT_MAX) }),
  z.object({
    type: z.literal('disconnectChoice'),
    playerId: z.string().max(40),
    choice: z.enum(['wait', 'bot', 'bankrupt']),
  }),
  z.object({ type: z.literal('playAgain') }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('voice'), on: z.boolean() }),
  z.object({
    type: z.literal('rtc'),
    to: z.string().max(40),
    data: z.record(z.unknown()),
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface RoomPlayer {
  id: PlayerId;
  name: string;
  token: TokenId;
  online: boolean;
  isBot: boolean;
  /** epoch ms lúc mất kết nối (nếu đang offline) */
  offlineSince: number | null;
  /** Đã quá 3 phút mất kết nối, chờ host quyết định */
  awaitingHostDecision: boolean;
  /** Đang tham gia voice chat */
  voice: boolean;
}

export interface ChatMessage {
  id: number;
  from: string;
  name: string;
  text: string;
  at: number;
}

export interface LogEntry {
  id: number;
  text: string;
}

export interface RoomView {
  code: string;
  hostId: PlayerId | null;
  status: 'lobby' | 'playing' | 'ended';
  players: RoomPlayer[];
  spectators: number;
  rules: Rules;
  hasPassword: boolean;
  game: GameState | null;
  /** epoch ms: hạn chót của người đang phải hành động (null = không giới hạn) */
  deadline: number | null;
  /** epoch ms: hết giờ ván (chế độ giới hạn thời gian) */
  gameEndsAt: number | null;
  log: LogEntry[];
  chat: ChatMessage[];
  serverNow: number;
}

export type ServerMessage =
  | { type: 'welcome'; playerId: PlayerId | null; spectator: boolean }
  | { type: 'rtc'; from: PlayerId; data: Record<string, unknown> }
  | { type: 'room'; room: RoomView; events?: GameEvent[] }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'error'; message: string; fatal?: boolean }
  | { type: 'kicked' }
  | { type: 'pong' };
