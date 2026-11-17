import { describe, expect, it } from 'vitest';
import { seededRng, type ClientMessage, type RoomView, type ServerMessage } from '@cotyphu/shared';
import {
  OFFLINE_GRACE_MS,
  RoomCore,
  newSnapshot,
  type Conn,
  type RoomHost,
  type RoomSnapshot,
} from '../src/room.js';

class FakeClient implements Conn {
  playerId: string | null = null;
  spectator = false;
  voice = false;
  account: { id: string; name: string } | null;
  inbox: ServerMessage[] = [];
  open = true;
  constructor(
    public id: string,
    private env: FakeEnv,
    name?: string,
  ) {
    this.account = name ? { id: name.toLowerCase(), name } : null;
  }
  send(msg: ServerMessage) {
    this.inbox.push(msg);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.env.disconnect(this);
  }
  msg(m: ClientMessage) {
    this.env.core.onMessage(this, JSON.stringify(m));
  }
  get room(): RoomView {
    const r = [...this.inbox].reverse().find((m) => m.type === 'room');
    if (!r || r.type !== 'room') throw new Error('chưa có room');
    return r.room;
  }
  get lastError(): string | undefined {
    const e = [...this.inbox].reverse().find((m) => m.type === 'error');
    return e && e.type === 'error' ? e.message : undefined;
  }
}

class FakeEnv implements RoomHost {
  t = 1_000_000;
  rng = seededRng(7);
  clients: FakeClient[] = [];
  alarm: number | null = null;
  saved: RoomSnapshot | null = null;
  destroyed = false;
  core: RoomCore;
  private n = 0;
  constructor() {
    this.core = new RoomCore(newSnapshot('ABC234', 'hostkey', this.t), this);
  }
  now = () => this.t;
  randomId = (bytes: number) => `id${++this.n}`.padEnd(bytes, 'x');
  persist = (snap: RoomSnapshot) => {
    this.saved = structuredClone(snap);
  };
  schedule = (at: number | null) => {
    this.alarm = at;
  };
  conns = () => this.clients.filter((c) => c.open);
  attach = () => {};
  destroy = () => {
    this.destroyed = true;
  };
  connect(name?: string): FakeClient {
    const c = new FakeClient(`c${this.clients.length}`, this, name);
    this.clients.push(c);
    this.core.onOpen(c);
    return c;
  }
  disconnect(c: FakeClient) {
    this.core.onClose(c);
  }
  /** Tua thời gian, chạy các alarm tới hạn */
  advance(ms: number) {
    const end = this.t + ms;
    for (let guard = 0; guard < 1000; guard++) {
      if (this.alarm === null || this.alarm > end) break;
      this.t = Math.max(this.t, this.alarm);
      this.alarm = null;
      this.core.tick();
    }
    this.t = end;
  }
  /** Mô phỏng restart server: dựng lại core từ snapshot đã lưu */
  restart() {
    this.core = new RoomCore(structuredClone(this.saved!), this);
  }
}

function setup3() {
  const env = new FakeEnv();
  const a = env.connect('Lan');
  a.msg({ type: 'join', token: 'xe-may', hostKey: 'hostkey' });
  const b = env.connect('Minh');
  b.msg({ type: 'join', token: 'non-la' });
  const c = env.connect('Hùng');
  c.msg({ type: 'join', token: 'banh-mi' });
  return { env, a, b, c };
}

describe('Phòng chơi', () => {
  it('tạo phòng, vào phòng, host là người có hostKey', () => {
    const { a, b, c } = setup3();
    expect(a.room.players.map((p) => p.name)).toEqual(['Lan', 'Minh', 'Hùng']);
    expect(a.room.hostId).toBe(a.playerId);
    expect(c.room.players.every((p) => p.online)).toBe(true);
    expect(b.playerId).toBeTruthy();
  });

  it('không trùng quân cờ, validate sai schema', () => {
    const { env } = setup3();
    const d = env.connect('Tú');
    d.msg({ type: 'join', token: 'xe-may' });
    expect(d.lastError).toMatch('Quân cờ');
    env.core.onMessage(d, '{"type":"join","token":"khong-co"}');
    expect(d.lastError).toBeTruthy();
    const anon = env.connect();
    anon.msg({ type: 'join', token: 'hoa-sen' });
    expect(anon.lastError).toMatch('đăng nhập');
    env.core.onMessage(d, 'not json');
    expect(d.lastError).toMatch('không hợp lệ');
  });

  it('chỉ host được đổi luật và bắt đầu; cần ≥ 2 người', () => {
    const env = new FakeEnv();
    const a = env.connect('Lan');
    a.msg({ type: 'join', token: 'xe-may', hostKey: 'hostkey' });
    a.msg({ type: 'start' });
    expect(a.lastError).toMatch('ít nhất 2');
    const b = env.connect('Minh');
    b.msg({ type: 'join', token: 'non-la' });
    b.msg({ type: 'start' });
    expect(b.lastError).toMatch('chủ phòng');
    a.msg({
      type: 'setRules',
      rules: {
        startingCash: 2000,
        jackpot: true,
        doubleGo: false,
        auctions: true,
        timeLimitMinutes: 0,
        turnTimerSec: 60,
        buildRule: 'landing',
        houseStock: 48,
        hotelStock: 16,
      },
    });
    a.msg({ type: 'start' });
    expect(b.room.status).toBe('playing');
    expect(b.room.game!.players[0]!.cash).toBe(2000);
    expect(b.room.game!.rules.buildRule).toBe('landing');
    expect(b.room.game!.bank).toEqual({ houses: 48, hotels: 16 });
  });

  it('mật khẩu phòng', () => {
    const env = new FakeEnv();
    const a = env.connect('Lan');
    a.msg({ type: 'join', token: 'xe-may', hostKey: 'hostkey' });
    a.msg({ type: 'setPassword', password: 'bimat' });
    const b = env.connect('Minh');
    b.msg({ type: 'join', token: 'non-la', password: 'sai' });
    expect(b.lastError).toMatch('Sai mật khẩu');
    b.msg({ type: 'join', token: 'non-la', password: 'bimat' });
    expect(b.playerId).toBeTruthy();
  });

  it('chơi vài lượt, không đúng lượt thì bị từ chối', () => {
    const { env, a, b, c } = setup3();
    a.msg({ type: 'start' });
    const byId = new Map([a, b, c].map((x) => [x.playerId!, x]));
    for (let k = 0; k < 6; k++) {
      const g = a.room.game!;
      const cur = byId.get(g.players[g.current]!.id)!;
      const other = [a, b, c].find((x) => x !== cur)!;
      other.msg({ type: 'action', action: { type: 'roll' } });
      expect(other.lastError).toBeTruthy();
      // Người hiện tại: tung → từ chối mua (nếu có) → kết thúc
      for (let guard = 0; guard < 10; guard++) {
        const ph = a.room.game!.phase;
        const gg = a.room.game!;
        if (gg.players[gg.current]!.id !== cur.playerId) break;
        if (ph.kind === 'awaitRoll') cur.msg({ type: 'action', action: { type: 'roll' } });
        else if (ph.kind === 'awaitBuy') cur.msg({ type: 'action', action: { type: 'buy' } });
        else if (ph.kind === 'auction') env.advance(11_000);
        else if (ph.kind === 'awaitEnd') cur.msg({ type: 'action', action: { type: 'endTurn' } });
        else if (ph.kind === 'raiseFunds') env.advance(121_000);
      }
    }
    expect(a.room.game!.turn).toBeGreaterThan(5);
    expect(a.room.log.length).toBeGreaterThan(5);
  });

  it('hết giờ lượt: server tự tung / tự kết thúc', () => {
    const { env, a } = setup3();
    a.msg({ type: 'start' });
    const turn0 = a.room.game!.turn;
    env.advance(91_000); // tự tung
    expect(a.room.game!.lastDice).not.toBeNull();
    env.advance(5 * 91_000);
    expect(a.room.game!.turn).toBeGreaterThan(turn0);
  });

  it('mất kết nối: tự chơi thay, đăng nhập thiết bị khác vào lại đúng ghế', () => {
    const { env, a, b, c } = setup3();
    a.msg({ type: 'start' });
    const g = a.room.game!;
    const cur = [a, b, c].find((x) => x.playerId === g.players[g.current]!.id)!;
    const watcher = [a, b, c].find((x) => x !== cur)!;
    const { playerId } = cur;
    const accName = cur.account!.name;
    cur.close();
    expect(watcher.room.players.find((p) => p.id === playerId)!.online).toBe(false);
    env.advance(4_000); // tự tung sau 3 giây
    expect(watcher.room.game!.lastDice).not.toBeNull();
    env.advance(20_000);
    // Vào lại
    const again = env.connect(accName);
    again.msg({ type: 'resume' });
    expect(again.playerId).toBe(playerId);
    expect(watcher.room.players.find((p) => p.id === playerId)!.online).toBe(true);
    // Tài khoản khác không lấy được ghế
    const other = env.connect('Người lạ');
    other.msg({ type: 'resume' });
    expect(other.playerId).toBeNull();
  });

  it('mất kết nối quá 3 phút: host chọn thay bằng bot hoặc cho phá sản', () => {
    const { env, a, b, c } = setup3();
    a.msg({ type: 'start' });
    c.close();
    env.advance(OFFLINE_GRACE_MS + 5_000);
    const seat = a.room.players.find((p) => p.id === c.playerId)!;
    expect(seat.awaitingHostDecision).toBe(true);
    b.msg({ type: 'disconnectChoice', playerId: c.playerId!, choice: 'bot' });
    expect(b.lastError).toMatch('chủ phòng');
    a.msg({ type: 'disconnectChoice', playerId: c.playerId!, choice: 'bankrupt' });
    expect(a.room.game!.players.find((p) => p.id === c.playerId)!.bankrupt).toBe(true);
  });

  it('bot thay người chơi tự đi', () => {
    const { env, a, c } = setup3();
    a.msg({ type: 'start' });
    c.close();
    env.advance(OFFLINE_GRACE_MS + 5_000);
    a.msg({ type: 'disconnectChoice', playerId: c.playerId!, choice: 'bot' });
    expect(a.room.players.find((p) => p.id === c.playerId)!.isBot).toBe(true);
    const before = a.room.game!.turn;
    env.advance(30 * 60_000);
    expect(a.room.game!.turn).toBeGreaterThan(before);
  });

  it('restart server không mất ván', () => {
    const { env, a } = setup3();
    a.msg({ type: 'start' });
    env.advance(91_000);
    const before = env.saved!.game!;
    env.restart();
    expect(env.core.snap.game).toEqual(before);
    a.msg({ type: 'chat', text: 'còn đó không?' });
    expect(env.core.snap.chat.at(-1)!.text).toBe('còn đó không?');
  });

  it('chat: giới hạn độ dài, bỏ ký tự điều khiển', () => {
    const { a } = setup3();
    a.msg({ type: 'chat', text: 'x'.repeat(301) });
    expect(a.lastError).toBeTruthy();
    a.msg({ type: 'chat', text: 'xin\u0007 chào <b>' });
    const m = [...a.inbox].reverse().find((x) => x.type === 'chat');
    expect(m && m.type === 'chat' && m.message.text).toBe('xin chào <b>');
  });

  it('chống spam: giới hạn tốc độ tin nhắn', () => {
    const { a } = setup3();
    for (let i = 0; i < 40; i++) a.msg({ type: 'ping' });
    expect(a.lastError).toMatch('quá nhanh');
  });

  it('khán giả xem được, không thao tác được', () => {
    const { env, a } = setup3();
    a.msg({ type: 'start' });
    const s = env.connect('Tú');
    s.msg({ type: 'join', token: 'hoa-sen' });
    expect(s.lastError).toMatch('vào xem');
    s.msg({ type: 'spectate' });
    expect(s.room.status).toBe('playing');
    s.msg({ type: 'action', action: { type: 'roll' } });
    expect(s.lastError).toMatch('chưa vào phòng');
    expect(a.room.spectators).toBe(1);
  });

  it('kick ở sảnh; chơi lại sau khi kết thúc', () => {
    const { a, b, c } = setup3();
    a.msg({ type: 'kick', playerId: c.playerId! });
    expect(a.room.players).toHaveLength(2);
    expect(c.inbox.some((m) => m.type === 'kicked')).toBe(true);
    a.msg({ type: 'start' });
    b.msg({ type: 'action', action: { type: 'resign' } });
    expect(a.room.status).toBe('ended');
    a.msg({ type: 'playAgain' });
    expect(a.room.status).toBe('lobby');
    expect(a.room.players).toHaveLength(2);
  });

  it('phòng không hoạt động 2 giờ thì bị xoá', () => {
    const { env } = setup3();
    env.advance(2 * 60 * 60_000 + 1000);
    expect(env.destroyed).toBe(true);
  });

  it('voice chat: chuyển tín hiệu WebRTC giữa người đang bật voice', () => {
    const { a, b, c } = setup3();
    a.msg({ type: 'voice', on: true });
    b.msg({ type: 'voice', on: true });
    expect(c.room.players.filter((p) => p.voice)).toHaveLength(2);
    a.msg({ type: 'rtc', to: b.playerId!, data: { sdp: 'offer' } });
    const got = b.inbox.find((m) => m.type === 'rtc');
    expect(got && got.type === 'rtc' && got.from).toBe(a.playerId);
    // c chưa bật voice: không nhận
    a.msg({ type: 'rtc', to: c.playerId!, data: { sdp: 'offer' } });
    expect(c.inbox.some((m) => m.type === 'rtc')).toBe(false);
    // Tín hiệu rtc không bị giới hạn tốc độ
    for (let i = 0; i < 60; i++) a.msg({ type: 'rtc', to: b.playerId!, data: { candidate: i } });
    expect(b.inbox.filter((m) => m.type === 'rtc').length).toBe(61);
  });
});
