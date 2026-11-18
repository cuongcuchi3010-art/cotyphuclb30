import { describe, expect, it } from 'vitest';
import { summarizeWidget } from '../src/discord.js';

describe('Discord widget', () => {
  it('rút gọn dữ liệu widget.json', () => {
    const s = summarizeWidget({
      id: '1',
      name: 'CLB30',
      instant_invite: 'https://discord.com/invite/abc',
      presence_count: 7,
      members: [
        {
          id: '0',
          username: 'Lan',
          status: 'online',
          avatar_url: 'https://cdn.discordapp.com/widget-avatars/x',
          game: { name: 'Cờ Tỷ Phú' },
        },
        { id: '1', username: 'Minh', status: 'idle', avatar_url: 'javascript:alert(1)' },
      ],
    });
    expect(s).toMatchObject({
      ok: true,
      name: 'CLB30',
      invite: 'https://discord.com/invite/abc',
      online: 7,
    });
    expect(s.members[0]).toEqual({
      name: 'Lan',
      avatar: 'https://cdn.discordapp.com/widget-avatars/x',
      status: 'online',
      game: 'Cờ Tỷ Phú',
    });
    expect(s.members[1]!.avatar).toBeNull();
  });
  it('widget chưa bật', () => {
    const s = summarizeWidget({ code: 50004, message: 'Widget Disabled' });
    expect(s.ok).toBe(false);
    expect(s.error).toMatch('chưa bật');
  });
  it('bị Discord giới hạn: báo tiếng Việt', () => {
    const s = summarizeWidget({ message: 'You are being rate limited.', retry_after: 30 });
    expect(s.ok).toBe(false);
    expect(s.error).toMatch('giới hạn');
  });
  it('link mời lạ bị bỏ', () => {
    expect(
      summarizeWidget({ name: 'X', instant_invite: 'https://evil.example' }).invite,
    ).toBeNull();
  });
});
