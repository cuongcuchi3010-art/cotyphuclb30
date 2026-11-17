import { describe, expect, it } from 'vitest';
import { checkGatePassword, gateCookieHeader, hasGateCookie } from '../src/gate.js';

describe('Cổng BÁO DANH', () => {
  it('mật khẩu mặc định đúng / sai', async () => {
    expect(await checkGatePassword('Clb30maidinh.', undefined)).toBe(true);
    expect(await checkGatePassword('clb30maidinh.', undefined)).toBe(false);
    expect(await checkGatePassword('', undefined)).toBe(false);
  });
  it('GATE_PASSWORD ghi đè mật khẩu mặc định', async () => {
    expect(await checkGatePassword('moi123', 'moi123')).toBe(true);
    expect(await checkGatePassword('Clb30maidinh.', 'moi123')).toBe(false);
  });
  it('cookie hợp lệ chỉ khi đúng mật khẩu hiện tại', async () => {
    const req = new Request('https://x.workers.dev/api/gate');
    const header = await gateCookieHeader(req, undefined);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    const cookie = header.split(';')[0]!;
    const withCookie = new Request('https://x/api/me', { headers: { cookie } });
    expect(await hasGateCookie(withCookie, undefined)).toBe(true);
    expect(await hasGateCookie(withCookie, 'doi-mat-khau')).toBe(false);
    expect(await hasGateCookie(new Request('https://x/api/me'), undefined)).toBe(false);
  });
});
