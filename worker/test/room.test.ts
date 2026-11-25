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

/** Mọi người chơi bốc thăm thứ tự (mỗi người một lá khác nhau) */
function drawAll(env: FakeEnv) {
  env.clients
    .filter((c) => c.open && c.playerId)
    .forEach((c, k) => c.msg({ type: 'action', action: { type: 'drawLot', card: k } }));
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
        houseStock: 48,
        hotelStock: 16,
        showStandings: true,
        buildRule: 'landing',
        festivalSquare: true,
        maxFestivals: 4,
        mode: 'classic',
        goSalary: 500,
        rentMult: 1.5,
        feeMult: 3,
        casinoMaxBet: 500,
        firstBuildMax: 2,
        bankruptcyMode: 'bankBuyout',
        mercy: false,
        devilCards: true,
      },
    });
    a.msg({ type: 'start' });
    expect(b.room.status).toBe('playing');
    expect(b.room.game!.players[0]!.cash).toBe(2000);
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
    drawAll(env);
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
    drawAll(env);
    const turn0 = a.room.game!.turn;
    env.advance(91_000); // tự tung
    expect(a.room.game!.lastDice).not.toBeNull();
    // Đủ lâu để qua hết lượt kể cả khi người đầu tung đôi nhiều lần
    env.advance(15 * 91_000);
    expect(a.room.game!.turn).toBeGreaterThan(turn0);
  });

  it('mất kết nối: tự chơi thay, đăng nhập thiết bị khác vào lại đúng ghế', () => {
    const { env, a, b, c } = setup3();
    a.msg({ type: 'start' });
    drawAll(env);
    const g = a.room.game!;
    const cur = [a, b, c].find((x) => x.playerId === g.players[g.current]!.id)!;
    const watcher = [a, b, c].find((x) => x !== cur)!;
    const { playerId } = cur;
    const accName = cur.account!.name;
    cur.close();
    expect(watcher.room.players.find((p) => p.id === playerId)!.online).toBe(false);
    env.advance(4_000); // F5 vài giây: chưa đi thay
    expect(watcher.room.game!.lastDice).toBeNull();
    env.advance(18_000); // quá 20 giây: bot chơi thay
    expect(watcher.room.players.find((p) => p.id === playerId)!.isBot).toBe(true);
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

  it('mất kết nối khi đang gom tiền: bot trả nợ thay, không phá sản', () => {
    const { env, a, b, c } = setup3();
    a.msg({ type: 'start' });
    drawAll(env);
    const g = a.room.game!;
    const cur = [a, b, c].find((x) => x.playerId === g.players[g.current]!.id)!;
    // Đưa người đang tới lượt vào pha gom tiền với một khoản nợ lớn
    const st = env.core.snap.game!;
    st.phase = { kind: 'raiseFunds', debtor: cur.playerId! } as never;
    st.debts = [{ from: cur.playerId!, to: 'bank', amount: 100, reason: 'tax' }] as never;
    cur.close();
    env.advance(60_000);
    const p = env.core.snap.game!.players.find((x) => x.id === cur.playerId)!;
    expect(p.bankrupt).toBe(false);
  });

  it('mất kết nối lâu: bot chơi thay, không phá sản; vào lại thì lấy lại ghế', () => {
    const { env, a, c } = setup3();
    a.msg({ type: 'start' });
    drawAll(env);
    const pid = c.playerId!;
    const accName = c.account!.name;
    c.close();
    env.advance(OFFLINE_GRACE_MS + 5 * 60_000);
    const seat = a.room.players.find((p) => p.id === pid)!;
    expect(seat.isBot).toBe(true);
    expect(seat.awaitingHostDecision).toBe(false);
    expect(a.room.game!.players.find((p) => p.id === pid)!.bankrupt).toBe(false);
    const again = env.connect(accName);
    again.msg({ type: 'resume' });
    expect(again.playerId).toBe(pid);
    expect(a.room.players.find((p) => p.id === pid)!.isBot).toBe(false);
  });

  it('Đấu Trí Toán: 10 giây vào chơi, 5 giây chuẩn bị, 20 giây trả lời rồi chia quỹ', () => {
    const { env, a, b, c } = setup3();
    a.msg({ type: 'start' });
    drawAll(env);
    const g = env.core.snap.game!;
    g.rules.mode = 'freestyle';
    const ids = [a, b, c].map((x) => x.playerId!);
    g.phase = { kind: 'quiz' };
    g.quiz = {
      pos: 28,
      opener: ids[0]!,
      stake: 300,
      stage: 'join',
      eligible: ids,
      joined: [],
      passed: [],
      pot: 0,
      question: null,
      answered: [],
      correct: [],
    };
    a.msg({ type: 'action', action: { type: 'quizJoin' } });
    b.msg({ type: 'action', action: { type: 'quizJoin' } });
    expect(a.room.game!.quiz!.pot).toBe(600);
    env.advance(10_500); // hết 10 giây: c chưa quyết → không chơi
    expect(a.room.game!.quiz!.stage).toBe('ready');
    env.advance(5_500); // hết 5 giây chuẩn bị → ra câu hỏi
    const q = a.room.game!.quiz!;
    expect(q.stage).toBe('question');
    const right =
      q.question!.op === '+'
        ? q.question!.a + q.question!.b
        : q.question!.op === '-'
          ? q.question!.a - q.question!.b
          : q.question!.a * q.question!.b;
    const before = a.room.game!.players.find((p) => p.id === ids[1])!.cash;
    expect(q.question!.options).toContain(right);
    b.msg({ type: 'action', action: { type: 'quizAnswer', value: right } });
    env.advance(21_000); // hết 20 giây: chỉ b đúng → ăn cả quỹ
    expect(a.room.game!.quiz ?? null).toBeNull();
    expect(a.room.game!.players.find((p) => p.id === ids[1])!.cash).toBe(before + 600);
    void c;
  });

  it('bot thay người chơi tự đi', () => {
    const { env, a, c } = setup3();
    a.msg({ type: 'start' });
    drawAll(env);
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
    drawAll(env);
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
    drawAll(env);
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
    const { env, a, b, c } = setup3();
    a.msg({ type: 'kick', playerId: c.playerId! });
    expect(a.room.players).toHaveLength(2);
    expect(c.inbox.some((m) => m.type === 'kicked')).toBe(true);
    a.msg({ type: 'start' });
    drawAll(env);
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

  it('bốc thăm thứ tự: mọi người bốc xong mới vào ván; hết 30 giây máy bốc hộ', () => {
    const { env, a, b } = setup3();
    a.msg({ type: 'start' });
    expect(a.room.game!.phase.kind).toBe('drawOrder');
    a.msg({ type: 'action', action: { type: 'drawLot', card: 0 } });
    b.msg({ type: 'action', action: { type: 'drawLot', card: 0 } });
    expect(b.lastError).toMatch('đã có người');
    expect(a.room.game!.phase.kind).toBe('drawOrder');
    env.advance(31_000);
    const g = a.room.game!;
    expect(g.phase.kind).toBe('awaitRoll');
    expect(Object.keys(g.lots!.picks)).toHaveLength(3);
    expect(a.room.log.some((l) => l.text.startsWith('Thứ tự đi'))).toBe(true);
  });
});
