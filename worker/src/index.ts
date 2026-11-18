import { DurableObject } from 'cloudflare:workers';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LEN,
  accountKey,
  authRequestSchema,
  cryptoRng,
  roomCodeSchema,
  type ServerMessage,
} from '@cotyphu/shared';
import { Account } from './accounts.js';
import { checkGatePassword, gateCookieHeader, hasGateCookie } from './gate.js';
import { DEFAULT_DISCORD_GUILD, fetchDiscord } from './discord.js';
import { RoomCore, newSnapshot, type Conn, type RoomHost, type RoomSnapshot } from './room.js';

export { Account };

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ACCOUNTS: DurableObjectNamespace<Account>;
  ASSETS: Fetcher;
  /** Mật khẩu BÁO DANH (tuỳ chọn, ghi đè mật khẩu mặc định) */
  GATE_PASSWORD?: string;
  /** ID server Discord để hiện widget (mặc định server CLB30) */
  DISCORD_GUILD_ID?: string;
}

interface Attachment {
  id: string;
  playerId: string | null;
  spectator: boolean;
  account: { id: string; name: string; avatarV?: number } | null;
  voice: boolean;
}

function accountStub(env: Env, key: string) {
  return env.ACCOUNTS.get(env.ACCOUNTS.idFromName(`acc:${key}`));
}

interface Verified {
  id: string;
  username: string;
  rooms: { code: string; at: number }[];
  avatarV: number;
}

const AVATAR_MAX = 120_000; // ~90 KB ảnh sau base64

/** Kiểm tra token đăng nhập ("<khoá>.<ngẫu nhiên>") */
async function verifyToken(env: Env, token: string | null): Promise<Verified | null> {
  if (!token || token.length > 400) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  let key: string;
  try {
    key = decodeURIComponent(token.slice(0, dot));
  } catch {
    return null;
  }
  const res = await accountStub(env, key).fetch('https://acc/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return null;
  return (await res.json()) as Verified;
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function randomId(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCode(): string {
  const rng = cryptoRng();
  let s = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++)
    s += ROOM_CODE_ALPHABET[rng.int(0, ROOM_CODE_ALPHABET.length - 1)];
  return s;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// ---------------------------------------------------------------------------
// Durable Object: mỗi phòng một instance
// ---------------------------------------------------------------------------

export class Room extends DurableObject<Env> {
  private core: RoomCore | null = null;
  private closing = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const snap = await ctx.storage.get<RoomSnapshot>('snap');
      if (snap) this.core = new RoomCore(snap, this.makeHost());
    });
    // Trả lời ping mà không đánh thức DO
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    );
  }

  private wrap(ws: WebSocket): Conn {
    const att = (ws.deserializeAttachment() as Attachment | null) ?? {
      id: randomId(8),
      playerId: null,
      spectator: false,
      account: null,
      voice: false,
    };
    const conn: Conn = {
      id: att.id,
      playerId: att.playerId,
      spectator: att.spectator,
      account: att.account ?? null,
      voice: att.voice ?? false,
      send(msg: ServerMessage) {
        try {
          ws.send(JSON.stringify(msg));
        } catch {
          /* socket đã đóng */
        }
      },
      close(code?: number, reason?: string) {
        try {
          ws.close(code, reason);
        } catch {
          /* bỏ qua */
        }
      },
    };
    (conn as Conn & { ws: WebSocket }).ws = ws;
    return conn;
  }

  private makeHost(): RoomHost {
    const ctx = this.ctx;
    return {
      now: () => Date.now(),
      rng: cryptoRng(),
      randomId,
      persist: (snap) => {
        void ctx.storage.put('snap', snap);
      },
      schedule: (at) => {
        if (at === null) void ctx.storage.deleteAlarm();
        else void ctx.storage.setAlarm(Math.max(at, Date.now() + 50));
      },
      conns: () =>
        ctx
          .getWebSockets()
          .map((ws) => this.wrap(ws))
          .filter((c) => !this.closing.has(c.id)),
      attach: (conn) => {
        const ws = (conn as Conn & { ws?: WebSocket }).ws;
        const att: Attachment = {
          id: conn.id,
          playerId: conn.playerId,
          spectator: conn.spectator,
          account: conn.account,
          voice: conn.voice,
        };
        if (ws) ws.serializeAttachment(att);
        else {
          for (const w of ctx.getWebSockets()) {
            const a = w.deserializeAttachment() as Attachment | null;
            if (a?.id === conn.id) w.serializeAttachment(att);
          }
        }
      },
      onSeat: (accountId, code) => {
        void accountStub(this.env, accountId)
          .fetch('https://acc/addRoom', { method: 'POST', body: JSON.stringify({ code }) })
          .catch(() => {});
      },
      destroy: () => {
        this.core = null;
        void ctx.storage.deleteAlarm();
        void ctx.storage.deleteAll();
      },
    };
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/init' && req.method === 'POST') {
      if (this.core) return json({ error: 'exists' }, 409);
      const { code, hostKey } = (await req.json()) as { code: string; hostKey: string };
      const snap = newSnapshot(code, hostKey, Date.now());
      this.core = new RoomCore(snap, this.makeHost());
      await this.ctx.storage.put('snap', snap);
      await this.ctx.storage.setAlarm(Date.now() + 2 * 60 * 60_000);
      return json({ ok: true });
    }
    if (!this.core) return json({ error: 'Phòng không tồn tại hoặc đã đóng' }, 404);
    if (url.pathname === '/info') return json(this.core.publicInfo());
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket')
        return new Response('Cần WebSocket', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server);
      const accId = req.headers.get('x-account-id');
      const accName = req.headers.get('x-account-name');
      server.serializeAttachment({
        id: randomId(8),
        playerId: null,
        spectator: false,
        account:
          accId && accName
            ? {
                id: decodeURIComponent(accId),
                name: decodeURIComponent(accName),
                avatarV: Number(req.headers.get('x-account-avatar') ?? 0) || 0,
              }
            : null,
        voice: false,
      } satisfies Attachment);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.core) {
      ws.send(JSON.stringify({ type: 'error', message: 'Phòng đã đóng', fatal: true }));
      ws.close(4004, 'closed');
      return;
    }
    if (typeof message !== 'string' || message.length > 8192) return;
    this.core.onMessage(this.wrap(ws), message);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    if (!this.core) return;
    const conn = this.wrap(ws);
    this.closing.add(conn.id);
    try {
      this.core.onClose(conn);
    } finally {
      this.closing.delete(conn.id);
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  override async alarm(): Promise<void> {
    if (!this.core) {
      await this.ctx.storage.deleteAll();
      return;
    }
    this.core.tick();
  }
}

// ---------------------------------------------------------------------------
// Worker: định tuyến
// ---------------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/healthz') return json({ ok: true, time: Date.now() });

    // ---- Cổng BÁO DANH (chặn bot): mọi API & WebSocket cần cookie báo danh
    if (path === '/api/gate') {
      if (req.method === 'GET') return json({ ok: await hasGateCookie(req, env.GATE_PASSWORD) });
      if (req.method === 'POST') {
        let pw = '';
        try {
          pw = String(((await req.json()) as { password?: unknown }).password ?? '').slice(0, 100);
        } catch {
          /* bỏ qua */
        }
        if (!(await checkGatePassword(pw, env.GATE_PASSWORD))) {
          // Chậm lại một chút để hạn chế dò mật khẩu
          await new Promise((r) => setTimeout(r, 800));
          return json({ ok: false, error: 'Mật khẩu báo danh không đúng' }, 403);
        }
        const res = json({ ok: true });
        res.headers.set('set-cookie', await gateCookieHeader(req, env.GATE_PASSWORD));
        return res;
      }
    }
    if (
      (path.startsWith('/api/') || path.startsWith('/ws/')) &&
      !(await hasGateCookie(req, env.GATE_PASSWORD))
    )
      return json({ error: 'Bạn cần báo danh trước', gate: true }, 403);

    // ---- Tài khoản
    if ((path === '/api/auth/register' || path === '/api/auth/login') && req.method === 'POST') {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Dữ liệu không hợp lệ' }, 400);
      }
      const parsed = authRequestSchema.safeParse(body);
      if (!parsed.success)
        return json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400);
      const { username, password } = parsed.data;
      const key = accountKey(username);
      const op = path.endsWith('register') ? 'register' : 'login';
      return accountStub(env, key).fetch(`https://acc/${op}`, {
        method: 'POST',
        body: JSON.stringify({ username, key, password }),
      });
    }
    if (path === '/api/auth/logout' && req.method === 'POST') {
      const token = bearer(req);
      const v = await verifyToken(env, token);
      if (v)
        await accountStub(env, v.id).fetch('https://acc/logout', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
      return json({ ok: true });
    }
    if (path === '/api/me') {
      const v = await verifyToken(env, bearer(req));
      if (!v) return json({ error: 'Phiên đăng nhập hết hạn' }, 401);
      return json({ username: v.username, rooms: v.rooms, avatarV: v.avatarV ?? 0, id: v.id });
    }
    // ---- Discord widget (cache 60 giây)
    if (path === '/api/discord' && req.method === 'GET') {
      const guild = /^\d{5,25}$/.test(env.DISCORD_GUILD_ID ?? '') ? env.DISCORD_GUILD_ID! : DEFAULT_DISCORD_GUILD;
      return json(await fetchDiscord(guild));
    }
    // ---- Ảnh đại diện
    if (path === '/api/me/avatar' && (req.method === 'PUT' || req.method === 'DELETE')) {
      const v = await verifyToken(env, bearer(req));
      if (!v) return json({ error: 'Phiên đăng nhập hết hạn' }, 401);
      if (req.method === 'DELETE')
        return accountStub(env, v.id).fetch('https://acc/clearAvatar', { method: 'POST', body: '{}' });
      let data = '';
      try {
        data = String(((await req.json()) as { data?: unknown }).data ?? '');
      } catch {
        /* bỏ qua */
      }
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > AVATAR_MAX)
        return json({ error: 'Ảnh không hợp lệ hoặc quá lớn' }, 400);
      return accountStub(env, v.id).fetch('https://acc/setAvatar', {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
    }
    const av = path.match(/^\/api\/avatar\/([^/]+)$/);
    if (av && req.method === 'GET') {
      let key: string;
      try {
        key = decodeURIComponent(av[1]!);
      } catch {
        return new Response('Not found', { status: 404 });
      }
      return accountStub(env, key).fetch('https://acc/avatar');
    }

    if (path.startsWith('/api/rooms') || path.startsWith('/ws/')) {
      const token = bearer(req) ?? url.searchParams.get('token');
      const v = await verifyToken(env, token);
      if (!v) return json({ error: 'Bạn cần đăng nhập' }, 401);
      const ws = path.match(/^\/ws\/([A-Za-z0-9]+)$/);
      if (ws) {
        const code = ws[1]!.toUpperCase();
        if (!roomCodeSchema.safeParse(code).success)
          return json({ error: 'Mã phòng không hợp lệ' }, 400);
        const fwd = new Request('https://room/ws', req);
        fwd.headers.set('x-account-id', encodeURIComponent(v.id));
        fwd.headers.set('x-account-name', encodeURIComponent(v.username));
        fwd.headers.set('x-account-avatar', String(v.avatarV ?? 0));
        return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(fwd);
      }
    }

    if (path === '/api/rooms' && req.method === 'POST') {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode();
        const hostKey = randomId(16);
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch('https://room/init', {
          method: 'POST',
          body: JSON.stringify({ code, hostKey }),
        });
        if (res.ok) return json({ code, hostKey });
      }
      return json({ error: 'Không tạo được phòng, thử lại nhé' }, 503);
    }

    const info = path.match(/^\/api\/rooms\/([A-Za-z0-9]+)$/);
    if (info && req.method === 'GET') {
      const code = info[1]!.toUpperCase();
      if (!roomCodeSchema.safeParse(code).success)
        return json({ error: 'Mã phòng không hợp lệ' }, 400);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/info');
    }

    if (path.startsWith('/api/')) return json({ error: 'Không tìm thấy' }, 404);
    if (path.startsWith('/logos/') || path.startsWith('/images/')) {
      // Logo/ảnh chưa có file: trả 404 (không trả trang SPA) để client hiện huy hiệu chữ
      const res = await env.ASSETS.fetch(req);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html')) return new Response('Not found', { status: 404 });
      return res;
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
