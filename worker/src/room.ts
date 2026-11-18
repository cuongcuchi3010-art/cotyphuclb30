import {
  CHAT_MAX,
  DEFAULT_RULES,
  MAX_PLAYERS,
  actingPlayer,
  applyAction,
  botDecision,
  clientMessageSchema,
  createGame,
  currentPlayer,
  describeEvent,
  timeoutAction,
  type Action,
  type Actor,
  type ChatMessage,
  type ClientMessage,
  type GameEvent,
  type GameState,
  type LogEntry,
  type PlayerAction,
  type Rng,
  type RoomView,
  type Rules,
  type ServerMessage,
  type TokenId,
} from '@cotyphu/shared';

export const OFFLINE_GRACE_MS = 3 * 60_000;
export const OFFLINE_AUTOPLAY_MS = 3_000;
export const BOT_DELAY_MS = 1_200;
export const AUCTION_MS = 10_000;
export const DRAW_MS = 30_000;
export const RAISE_FUNDS_MS = 120_000;
export const INACTIVE_MS = 2 * 60 * 60_000;
const LOG_KEEP = 200;
const CHAT_KEEP = 100;
const RATE_PER_SEC = 8;
const RATE_BURST = 20;

export interface Conn {
  id: string;
  /** null = khán giả / chưa vào */
  playerId: string | null;
  spectator: boolean;
  /** Tài khoản đã đăng nhập của kết nối này */
  account: { id: string; name: string; avatarV?: number } | null;
  /** Đang bật voice chat */
  voice: boolean;
  send(msg: ServerMessage): void;
  close(code?: number, reason?: string): void;
}

export interface RoomHost {
  now(): number;
  rng: Rng;
  randomId(bytes: number): string;
  /** Lưu snapshot (DO storage) */
  persist(snap: RoomSnapshot): void;
  /** Đặt lịch gọi tick() (null = huỷ) */
  schedule(at: number | null): void;
  /** Liệt kê kết nối đang mở */
  conns(): Conn[];
  /** Ghi lại thông tin kết nối (DO hibernation attachment) */
  attach(conn: Conn): void;
  /** Xoá phòng hoàn toàn */
  destroy(): void;
  /** Báo cho tài khoản biết đang ở phòng này (để vào lại từ thiết bị khác) */
  onSeat?(accountId: string, code: string): void;
}

export interface SeatRecord {
  id: string;
  name: string;
  token: TokenId;
  /** Tài khoản sở hữu ghế */
  accountId: string;
  /** Phiên bản ảnh đại diện của tài khoản (0 = dùng quân cờ) */
  avatarV?: number;
  isBot: boolean;
  offlineSince: number | null;
  awaitingHostDecision: boolean;
}

export interface RoomSnapshot {
  v: 1;
  code: string;
  hostKey: string;
  hostId: string | null;
  status: 'lobby' | 'playing' | 'ended';
  seats: SeatRecord[];
  rules: Rules;
  password: string;
  game: GameState | null;
  deadline: number | null;
  deadlineKey: string;
  gameEndsAt: number | null;
  /** Lần tự động hành động tiếp theo (bot / người mất kết nối) */
  autoAt: number | null;
  log: LogEntry[];
  chat: ChatMessage[];
  logSeq: number;
  chatSeq: number;
  lastActivity: number;
}

export function newSnapshot(code: string, hostKey: string, now: number): RoomSnapshot {
  return {
    v: 1,
    code,
    hostKey,
    hostId: null,
    status: 'lobby',
    seats: [],
    rules: { ...DEFAULT_RULES },
    password: '',
    game: null,
    deadline: null,
    deadlineKey: '',
    gameEndsAt: null,
    autoAt: null,
    log: [],
    chat: [],
    logSeq: 0,
    chatSeq: 0,
    lastActivity: now,
  };
}

class UserError extends Error {}

/** Toàn bộ logic một phòng chơi (không phụ thuộc Cloudflare) */
export class RoomCore {
  private buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    public snap: RoomSnapshot,
    private host: RoomHost,
  ) {}

  // ------------------------------------------------------------------ kết nối

  isOnline(playerId: string): boolean {
    return this.host.conns().some((c) => c.playerId === playerId);
  }

  onOpen(_conn: Conn): void {
    // Chờ tin nhắn join/resume/spectate
  }

  onClose(conn: Conn): void {
    const pid = conn.playerId;
    this.buckets.delete(conn.id);
    if (!pid) {
      this.broadcast();
      return;
    }
    const stillOnline = this.host.conns().some((c) => c.id !== conn.id && c.playerId === pid);
    if (stillOnline) return;
    const seat = this.seat(pid);
    if (!seat) return;
    if (this.snap.status === 'lobby') {
      // Ở sảnh: giữ chỗ, đánh dấu offline (đóng tab rồi mở lại vẫn vào được)
      seat.offlineSince = this.host.now();
    } else {
      seat.offlineSince = this.host.now();
    }
    this.afterChange([], conn.id);
  }

  onMessage(conn: Conn, raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      conn.send({ type: 'error', message: 'Tin nhắn không hợp lệ' });
      return;
    }
    const isRtc = (data as { type?: unknown } | null)?.type === 'rtc';
    if (!isRtc && !this.rateOk(conn)) {
      conn.send({ type: 'error', message: 'Bạn thao tác quá nhanh, chậm lại chút nhé' });
      return;
    }
    const parsed = clientMessageSchema.safeParse(data);
    if (!parsed.success) {
      if (isRtc) return;
      conn.send({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Tin nhắn không hợp lệ',
      });
      return;
    }
    try {
      this.handle(conn, parsed.data);
    } catch (e) {
      if (e instanceof UserError || (e as Error).name === 'GameError') {
        conn.send({ type: 'error', message: (e as Error).message });
      } else {
        console.error(e);
        conn.send({ type: 'error', message: 'Lỗi máy chủ' });
      }
    }
  }

  private rateOk(conn: Conn): boolean {
    const now = this.host.now();
    const b = this.buckets.get(conn.id) ?? { tokens: RATE_BURST, at: now };
    b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.at) / 1000) * RATE_PER_SEC);
    b.at = now;
    if (b.tokens < 1) {
      this.buckets.set(conn.id, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(conn.id, b);
    return true;
  }

  private seat(id: string | null): SeatRecord | undefined {
    return id ? this.snap.seats.find((s) => s.id === id) : undefined;
  }

  private requireSeat(conn: Conn): SeatRecord {
    const s = this.seat(conn.playerId);
    if (!s) throw new UserError('Bạn chưa vào phòng');
    return s;
  }

  private requireHost(conn: Conn): void {
    if (!conn.playerId || conn.playerId !== this.snap.hostId)
      throw new UserError('Chỉ chủ phòng mới làm được việc này');
  }

  private checkPassword(pw: string | undefined): void {
    if (this.snap.password && pw !== this.snap.password) throw new UserError('Sai mật khẩu phòng');
  }

  // ------------------------------------------------------------------ xử lý tin nhắn

  handle(conn: Conn, m: ClientMessage): void {
    const snap = this.snap;
    switch (m.type) {
      case 'ping':
        conn.send({ type: 'pong' });
        return;
      case 'join': {
        if (!conn.account) throw new UserError('Bạn cần đăng nhập');
        if (conn.playerId) throw new UserError('Bạn đã ở trong phòng');
        const existing = snap.seats.find((x) => x.accountId === conn.account!.id);
        if (existing) {
          this.resumeSeat(conn, existing);
          return;
        }
        if (snap.status !== 'lobby') throw new UserError('Ván đã bắt đầu — bạn có thể vào xem');
        const isHostKey = m.hostKey !== undefined && m.hostKey === snap.hostKey;
        if (!isHostKey) this.checkPassword(m.password);
        if (snap.seats.length >= MAX_PLAYERS) throw new UserError('Phòng đã đủ 6 người');
        if (snap.seats.some((s) => s.token === m.token))
          throw new UserError('Quân cờ này đã có người chọn');
        const seat: SeatRecord = {
          id: this.host.randomId(6),
          name: conn.account.name,
          token: m.token,
          accountId: conn.account.id,
          avatarV: conn.account.avatarV ?? 0,
          isBot: false,
          offlineSince: null,
          awaitingHostDecision: false,
        };
        snap.seats.push(seat);
        if (isHostKey || !snap.hostId) snap.hostId = seat.id;
        this.bindConn(conn, seat.id);
        conn.send({ type: 'welcome', playerId: seat.id, spectator: false });
        this.host.onSeat?.(seat.accountId, snap.code);
        this.addLog(`${seat.name} vào phòng`);
        this.afterChange([]);
        return;
      }
      case 'resume': {
        const seat = conn.account
          ? snap.seats.find((x) => x.accountId === conn.account!.id)
          : undefined;
        if (!seat) {
          conn.send({ type: 'welcome', playerId: null, spectator: false });
          return;
        }
        this.resumeSeat(conn, seat);
        return;
      }
      case 'voice': {
        this.requireSeat(conn);
        conn.voice = m.on;
        this.host.attach(conn);
        this.broadcast();
        return;
      }
      case 'rtc': {
        if (!conn.playerId || !conn.voice) return;
        for (const c of this.host.conns()) {
          if (c.playerId === m.to && c.voice)
            c.send({ type: 'rtc', from: conn.playerId, data: m.data });
        }
        return;
      }
      case 'spectate': {
        this.checkPassword(m.password);
        conn.spectator = true;
        conn.playerId = null;
        this.host.attach(conn);
        conn.send({ type: 'welcome', playerId: null, spectator: true });
        this.broadcast();
        return;
      }
      case 'setProfile': {
        const seat = this.requireSeat(conn);
        if (snap.status !== 'lobby') throw new UserError('Chỉ đổi được ở sảnh');
        if (m.token !== seat.token) {
          if (snap.seats.some((s) => s.token === m.token))
            throw new UserError('Quân cờ này đã có người chọn');
          seat.token = m.token;
        }
        this.afterChange([]);
        return;
      }
      case 'setRules':
        this.requireHost(conn);
        if (snap.status !== 'lobby') throw new UserError('Chỉ đổi luật ở sảnh');
        snap.rules = { ...m.rules };
        this.afterChange([]);
        return;
      case 'setPassword':
        this.requireHost(conn);
        snap.password = m.password;
        this.afterChange([]);
        return;
      case 'kick': {
        this.requireHost(conn);
        if (m.playerId === snap.hostId) throw new UserError('Không thể tự kick mình');
        const seat = this.seat(m.playerId);
        if (!seat) throw new UserError('Không tìm thấy người chơi');
        this.removeOrBankrupt(seat, `${seat.name} bị mời ra khỏi phòng`);
        for (const c of this.host.conns()) {
          if (c.playerId === seat.id) {
            c.send({ type: 'kicked' });
            c.close(4001, 'kicked');
          }
        }
        return;
      }
      case 'start': {
        this.requireHost(conn);
        if (snap.status !== 'lobby') throw new UserError('Ván đã bắt đầu');
        if (snap.seats.length < 2) throw new UserError('Cần ít nhất 2 người chơi');
        const { state, events } = createGame(
          snap.seats.map((s) => ({ id: s.id, name: s.name, token: s.token })),
          snap.rules,
          this.host.rng,
        );
        snap.game = state;
        snap.status = 'playing';
        snap.log = [];
        snap.gameEndsAt =
          snap.rules.timeLimitMinutes > 0
            ? this.host.now() + snap.rules.timeLimitMinutes * 60_000
            : null;
        snap.deadlineKey = '';
        this.afterChange(events);
        return;
      }
      case 'action': {
        const seat = this.requireSeat(conn);
        if (!snap.game || snap.status !== 'playing') throw new UserError('Ván chưa bắt đầu');
        this.apply(seat.id, m.action);
        return;
      }
      case 'chat': {
        const seat = this.seat(conn.playerId);
        const name = seat?.name ?? 'Khán giả';
        const text = sanitizeChat(m.text);
        if (!text) return;
        const msg: ChatMessage = {
          id: ++snap.chatSeq,
          from: seat?.id ?? 'spectator',
          name,
          text,
          at: this.host.now(),
        };
        snap.chat.push(msg);
        if (snap.chat.length > CHAT_KEEP) snap.chat.splice(0, snap.chat.length - CHAT_KEEP);
        snap.lastActivity = this.host.now();
        this.host.persist(snap);
        for (const c of this.host.conns()) c.send({ type: 'chat', message: msg });
        return;
      }
      case 'disconnectChoice': {
        this.requireHost(conn);
        const seat = this.seat(m.playerId);
        if (!seat || !snap.game) throw new UserError('Không tìm thấy người chơi');
        if (m.choice === 'wait') {
          seat.awaitingHostDecision = false;
          if (seat.offlineSince) seat.offlineSince = this.host.now();
          this.afterChange([]);
        } else if (m.choice === 'bot') {
          seat.isBot = true;
          seat.awaitingHostDecision = false;
          this.addLog(`${seat.name} được thay bằng bot`);
          this.afterChange([]);
        } else {
          seat.awaitingHostDecision = false;
          this.apply('system', { type: 'forceBankrupt', playerId: seat.id });
        }
        return;
      }
      case 'playAgain': {
        this.requireHost(conn);
        if (snap.status !== 'ended') throw new UserError('Ván chưa kết thúc');
        snap.status = 'lobby';
        snap.game = null;
        snap.deadline = null;
        snap.gameEndsAt = null;
        snap.autoAt = null;
        snap.seats = snap.seats.filter((s) => !s.isBot || this.isOnline(s.id));
        for (const s of snap.seats) s.isBot = false;
        this.addLog('Chủ phòng mở ván mới');
        this.afterChange([]);
        return;
      }
      case 'leave': {
        const seat = this.requireSeat(conn);
        this.removeOrBankrupt(seat, `${seat.name} rời phòng`);
        conn.playerId = null;
        this.host.attach(conn);
        return;
      }
    }
  }

  private resumeSeat(conn: Conn, seat: SeatRecord): void {
    this.bindConn(conn, seat.id);
    if (conn.account) seat.avatarV = conn.account.avatarV ?? 0;
    seat.offlineSince = null;
    seat.awaitingHostDecision = false;
    if (seat.isBot && this.snap.status === 'playing') {
      seat.isBot = false;
      this.addLog(`${seat.name} quay lại, thay cho bot`);
    }
    conn.send({ type: 'welcome', playerId: seat.id, spectator: false });
    this.afterChange([]);
  }

  private bindConn(conn: Conn, playerId: string): void {
    conn.playerId = playerId;
    conn.spectator = false;
    this.host.attach(conn);
  }

  private removeOrBankrupt(seat: SeatRecord, msg: string): void {
    const snap = this.snap;
    this.addLog(msg);
    if (snap.status === 'playing' && snap.game) {
      const p = snap.game.players.find((x) => x.id === seat.id);
      seat.isBot = false;
      seat.offlineSince = seat.offlineSince ?? this.host.now();
      if (p && !p.bankrupt) {
        this.apply('system', { type: 'forceBankrupt', playerId: seat.id });
        return;
      }
      this.afterChange([]);
      return;
    }
    snap.seats = snap.seats.filter((s) => s !== seat);
    if (snap.hostId === seat.id) snap.hostId = snap.seats[0]?.id ?? null;
    this.afterChange([]);
  }

  // ------------------------------------------------------------------ game

  private apply(by: Actor, action: Action): void {
    const snap = this.snap;
    if (!snap.game) return;
    const { state, events } = applyAction(snap.game, by, action, this.host.rng);
    snap.game = state;
    this.afterChange(events);
  }

  private addLog(text: string): void {
    this.snap.log.push({ id: ++this.snap.logSeq, text });
    if (this.snap.log.length > LOG_KEEP) this.snap.log.splice(0, this.snap.log.length - LOG_KEEP);
  }

  /** Cập nhật đồng hồ, lịch tự động, lưu và broadcast */
  private afterChange(events: GameEvent[], _skipConn?: string): void {
    const snap = this.snap;
    const now = this.host.now();
    snap.lastActivity = now;
    if (snap.game) {
      for (const ev of events) {
        const t = describeEvent(ev, snap.game);
        if (t) this.addLog(t);
      }
      if (snap.game.phase.kind === 'gameOver') {
        snap.status = 'ended';
        snap.deadline = null;
        snap.autoAt = null;
        snap.gameEndsAt = null;
      } else {
        this.updateDeadline(now);
        this.updateAutoplay(now);
      }
    }
    this.host.persist(snap);
    this.reschedule();
    this.broadcast(events);
  }

  private deadlineKeyFor(g: GameState): string {
    const actor = actingPlayer(g) ?? '-';
    return `${g.phase.kind}:${actor}:${g.turn}:${g.doublesCount}:${g.rolled}:${g.auction?.seq ?? ''}:${g.auction?.pos ?? ''}`;
  }

  private updateDeadline(now: number): void {
    const snap = this.snap;
    const g = snap.game!;
    const key = this.deadlineKeyFor(g);
    if (key === snap.deadlineKey) return;
    snap.deadlineKey = key;
    const turnMs = snap.rules.turnTimerSec * 1000;
    switch (g.phase.kind) {
      case 'auction':
        snap.deadline = now + AUCTION_MS;
        break;
      case 'raiseFunds':
        snap.deadline = turnMs > 0 ? now + RAISE_FUNDS_MS : null;
        break;
      case 'drawOrder':
        // Bốc thăm: luôn giới hạn 30 giây, hết giờ máy bốc hộ
        snap.deadline = now + DRAW_MS;
        break;
      default:
        snap.deadline = turnMs > 0 ? now + turnMs : null;
    }
  }

  /** Bot / người mất kết nối: lên lịch hành động tự động */
  private updateAutoplay(now: number): void {
    const snap = this.snap;
    const g = snap.game!;
    snap.autoAt = null;
    const needsAuto = this.autoPlan(g) !== null;
    if (needsAuto) snap.autoAt = now + (this.hasBotPlan(g) ? BOT_DELAY_MS : OFFLINE_AUTOPLAY_MS);
  }

  private hasBotPlan(g: GameState): boolean {
    return this.snap.seats.some((s) => s.isBot && botDecision(g, s.id) !== null);
  }

  /** Kế hoạch tự động hiện tại (bot trước, rồi người offline) */
  private autoPlan(g: GameState): { by: Actor; action: Action } | null {
    if (g.phase.kind === 'gameOver') return null;
    for (const s of this.snap.seats) {
      if (!s.isBot) continue;
      const plan = botDecision(g, s.id);
      if (plan) return plan;
    }
    if (g.phase.kind === 'auction') return null; // người offline không trả giá; chờ hết giờ
    const actor = actingPlayer(g);
    if (!actor) return null;
    const seat = this.seat(actor);
    if (seat && !seat.isBot && !this.isOnline(actor)) {
      return timeoutAction(g);
    }
    return null;
  }

  private reschedule(): void {
    const snap = this.snap;
    const times = [snap.deadline, snap.autoAt, snap.gameEndsAt, snap.lastActivity + INACTIVE_MS];
    if (snap.status === 'playing') {
      for (const s of snap.seats) {
        if (s.offlineSince && !s.awaitingHostDecision && !s.isBot)
          times.push(s.offlineSince + OFFLINE_GRACE_MS);
      }
    }
    const next = Math.min(...times.filter((t): t is number => t !== null));
    this.host.schedule(Number.isFinite(next) ? next : null);
  }

  /** Gọi khi tới giờ hẹn (DO alarm) */
  tick(): void {
    const snap = this.snap;
    const now = this.host.now();
    if (now >= snap.lastActivity + INACTIVE_MS) {
      for (const c of this.host.conns()) {
        c.send({ type: 'error', message: 'Phòng đã đóng do không hoạt động', fatal: true });
        c.close(4000, 'inactive');
      }
      this.host.destroy();
      return;
    }
    if (snap.status !== 'playing' || !snap.game) {
      this.reschedule();
      return;
    }
    try {
      if (snap.gameEndsAt && now >= snap.gameEndsAt) {
        this.apply('system', { type: 'timeUp' });
        return;
      }
      // Mất kết nối quá 3 phút → chờ host quyết định
      let changed = false;
      for (const s of snap.seats) {
        const p = snap.game.players.find((x) => x.id === s.id);
        if (
          s.offlineSince &&
          !s.isBot &&
          !s.awaitingHostDecision &&
          p &&
          !p.bankrupt &&
          now >= s.offlineSince + OFFLINE_GRACE_MS
        ) {
          s.awaitingHostDecision = true;
          this.addLog(`${s.name} mất kết nối quá 3 phút — chờ chủ phòng quyết định`);
          changed = true;
        }
      }
      if (snap.autoAt && now >= snap.autoAt) {
        const plan = this.autoPlan(snap.game);
        snap.autoAt = null;
        if (plan) {
          this.applySafe(plan.by, plan.action);
          return;
        }
      }
      if (snap.deadline && now >= snap.deadline) {
        const plan = timeoutAction(snap.game);
        snap.deadline = null;
        if (plan) {
          this.applySafe(plan.by, plan.action);
          return;
        }
      }
      if (changed) this.afterChange([]);
      else this.reschedule();
    } catch (e) {
      console.error('tick', e);
      this.reschedule();
    }
  }

  private applySafe(by: Actor, action: Action): void {
    try {
      this.apply(by, action);
    } catch (e) {
      // Kế hoạch tự động không hợp lệ (vd: endTurn khi đang nợ) → dùng hành động hết giờ
      const g = this.snap.game!;
      const fallback = timeoutAction(g);
      if (fallback && JSON.stringify(fallback.action) !== JSON.stringify(action)) {
        this.apply(fallback.by, fallback.action);
      } else {
        console.error('autoplay', e);
        this.snap.deadlineKey = '';
        this.afterChange([]);
      }
    }
  }

  // ------------------------------------------------------------------ view

  view(): RoomView {
    const snap = this.snap;
    return {
      code: snap.code,
      hostId: snap.hostId,
      status: snap.status,
      players: snap.seats.map((s) => ({
        id: s.id,
        name: s.name,
        token: s.token,
        online: this.isOnline(s.id),
        isBot: s.isBot,
        offlineSince: s.offlineSince,
        awaitingHostDecision: s.awaitingHostDecision,
        voice: this.host.conns().some((c) => c.playerId === s.id && c.voice),
        avatar: s.avatarV ? `/api/avatar/${encodeURIComponent(s.accountId)}?v=${s.avatarV}` : null,
      })),
      spectators: this.host.conns().filter((c) => c.spectator).length,
      rules: snap.rules,
      hasPassword: snap.password.length > 0,
      game: snap.game,
      deadline: snap.deadline,
      gameEndsAt: snap.gameEndsAt,
      log: snap.log.slice(-80),
      chat: snap.chat.slice(-50),
      serverNow: this.host.now(),
    };
  }

  broadcast(events?: GameEvent[]): void {
    const room = this.view();
    for (const c of this.host.conns()) {
      if (c.playerId || c.spectator) c.send({ type: 'room', room, events });
    }
  }

  /** Thông tin công khai trước khi vào phòng */
  publicInfo() {
    const snap = this.snap;
    return {
      code: snap.code,
      status: snap.status,
      hasPassword: snap.password.length > 0,
      takenTokens: snap.seats.map((s) => s.token),
      players: snap.seats.map((s) => s.name),
      full: snap.seats.length >= MAX_PLAYERS,
    };
  }
}

export function sanitizeChat(text: string): string {
  // Bỏ ký tự điều khiển; React tự escape HTML khi hiển thị
  return text
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .trim()
    .slice(0, CHAT_MAX);
}

export type { PlayerAction };
export { currentPlayer };
