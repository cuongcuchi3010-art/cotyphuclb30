import { DurableObject } from 'cloudflare:workers';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LEN,
  cryptoRng,
  roomCodeSchema,
  type ServerMessage,
} from '@cotyphu/shared';
import { RoomCore, newSnapshot, type Conn, type RoomHost, type RoomSnapshot } from './room.js';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

interface Attachment {
  id: string;
  playerId: string | null;
  spectator: boolean;
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
    };
    const conn: Conn = {
      id: att.id,
      playerId: att.playerId,
      spectator: att.spectator,
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
        const att: Attachment = { id: conn.id, playerId: conn.playerId, spectator: conn.spectator };
        if (ws) ws.serializeAttachment(att);
        else {
          for (const w of ctx.getWebSockets()) {
            const a = w.deserializeAttachment() as Attachment | null;
            if (a?.id === conn.id) w.serializeAttachment(att);
          }
        }
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
      server.serializeAttachment({
        id: randomId(8),
        playerId: null,
        spectator: false,
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

    const ws = path.match(/^\/ws\/([A-Za-z0-9]+)$/);
    if (ws) {
      const code = ws[1]!.toUpperCase();
      if (!roomCodeSchema.safeParse(code).success)
        return json({ error: 'Mã phòng không hợp lệ' }, 400);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request('https://room/ws', req));
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
