import { DurableObject } from 'cloudflare:workers';

/**
 * Mỗi tài khoản = 1 Durable Object (idFromName("acc:" + khoá)).
 * Lưu: mật khẩu (PBKDF2-SHA256 + salt), phiên đăng nhập, danh sách phòng gần đây.
 */

export const PBKDF2_ITERATIONS = 10_000;
const MAX_SESSIONS = 10;
const MAX_ROOMS = 8;
const MAX_FAILS = 8;
const LOCK_MS = 5 * 60_000;

export interface AccountRecord {
  username: string;
  key: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: number;
  sessions: { token: string; at: number }[];
  rooms: { code: string; at: number }[];
  fails: number;
  lockedUntil: number;
}

function hex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return hex(b);
}

export async function hashPassword(password: string, saltHex: string, iterations: number) {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMat,
    256,
  );
  return hex(bits);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export class Account extends DurableObject {
  private async load(): Promise<AccountRecord | undefined> {
    return this.ctx.storage.get<AccountRecord>('acc');
  }
  private async save(a: AccountRecord): Promise<void> {
    await this.ctx.storage.put('acc', a);
  }

  private newSession(a: AccountRecord): string {
    const token = `${encodeURIComponent(a.key)}.${randomHex(24)}`;
    a.sessions = [...a.sessions, { token, at: Date.now() }].slice(-MAX_SESSIONS);
    return token;
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? ((await req.json()) as Record<string, string>) : {};
    const a = await this.load();

    switch (url.pathname) {
      case '/register': {
        if (a) return json({ error: 'Biệt danh này đã có người dùng' }, 409);
        const salt = randomHex(16);
        const rec: AccountRecord = {
          username: body.username!,
          key: body.key!,
          salt,
          hash: await hashPassword(body.password!, salt, PBKDF2_ITERATIONS),
          iterations: PBKDF2_ITERATIONS,
          createdAt: Date.now(),
          sessions: [],
          rooms: [],
          fails: 0,
          lockedUntil: 0,
        };
        const token = this.newSession(rec);
        await this.save(rec);
        return json({ token, username: rec.username });
      }
      case '/login': {
        if (!a) return json({ error: 'Sai biệt danh hoặc mật khẩu' }, 401);
        if (a.lockedUntil > Date.now())
          return json({ error: 'Nhập sai quá nhiều lần, thử lại sau 5 phút' }, 429);
        const h = await hashPassword(body.password!, a.salt, a.iterations);
        if (!safeEqual(h, a.hash)) {
          a.fails++;
          if (a.fails >= MAX_FAILS) {
            a.fails = 0;
            a.lockedUntil = Date.now() + LOCK_MS;
          }
          await this.save(a);
          return json({ error: 'Sai biệt danh hoặc mật khẩu' }, 401);
        }
        a.fails = 0;
        const token = this.newSession(a);
        await this.save(a);
        return json({ token, username: a.username });
      }
      case '/verify': {
        if (!a || !a.sessions.some((x) => safeEqual(x.token, body.token ?? '')))
          return json({ error: 'Phiên đăng nhập hết hạn' }, 401);
        return json({ id: a.key, username: a.username, rooms: a.rooms });
      }
      case '/logout': {
        if (a) {
          a.sessions = a.sessions.filter((x) => x.token !== body.token);
          await this.save(a);
        }
        return json({ ok: true });
      }
      case '/addRoom': {
        if (!a) return json({ ok: false });
        a.rooms = [
          { code: body.code!, at: Date.now() },
          ...a.rooms.filter((r) => r.code !== body.code),
        ].slice(0, MAX_ROOMS);
        await this.save(a);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Not found' }, 404);
    }
  }
}
