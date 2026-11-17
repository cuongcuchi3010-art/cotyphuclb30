/**
 * Cổng "BÁO DANH": phải nhập đúng mật khẩu chung mới dùng được API / WebSocket.
 * - Mật khẩu mặc định chỉ lưu dạng SHA-256 (không lộ trên GitHub).
 * - Đổi mật khẩu: đặt biến/secret GATE_PASSWORD trên Cloudflare (Settings → Variables and Secrets).
 * - Nhập đúng → cookie HttpOnly 30 ngày. Đổi mật khẩu thì mọi cookie cũ hết hiệu lực.
 */

/** SHA-256 của mật khẩu mặc định */
const DEFAULT_GATE_HASH = '7179cd74a47992a7b4c02930ea2260401d475d7876838dc92f113c0834997c6a';
export const GATE_COOKIE = 'cotyphu_gate';
const MAX_AGE = 30 * 24 * 60 * 60;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function passwordHash(envPassword: string | undefined): Promise<string> {
  return envPassword ? sha256(envPassword) : DEFAULT_GATE_HASH;
}

/** Giá trị cookie hợp lệ (đổi khi mật khẩu đổi) */
async function cookieValue(envPassword: string | undefined): Promise<string> {
  return sha256(`cotyphu-gate:${await passwordHash(envPassword)}`);
}

export async function checkGatePassword(input: string, envPassword: string | undefined) {
  return safeEqual(await sha256(input), await passwordHash(envPassword));
}

export async function hasGateCookie(
  req: Request,
  envPassword: string | undefined,
): Promise<boolean> {
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${GATE_COOKIE}=([a-f0-9]{64})`));
  return !!m && safeEqual(m[1]!, await cookieValue(envPassword));
}

export async function gateCookieHeader(req: Request, envPassword: string | undefined) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${GATE_COOKIE}=${await cookieValue(envPassword)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}
