/**
 * Discord widget (https://discord.com/api/guilds/<id>/widget.json).
 * Server phải bật "Server Widget" trong Cài đặt máy chủ → Tiện ích.
 */

/** ID server Discord CLB30 — đổi ở đây nếu dùng server khác */
export const DISCORD_GUILD_ID = '1572067055161835542';

export interface DiscordWidgetRaw {
  id?: string;
  name?: string;
  instant_invite?: string | null;
  presence_count?: number;
  members?: {
    id?: string;
    username?: string;
    status?: string;
    avatar_url?: string;
    game?: { name?: string };
  }[];
  code?: number;
  message?: string;
  retry_after?: number;
}

export interface DiscordSummary {
  ok: boolean;
  name: string;
  invite: string | null;
  online: number;
  members: { name: string; avatar: string | null; status: string; game: string | null }[];
  error?: string;
}

/** Rút gọn dữ liệu widget (thuần, dùng chung client & server) */
export function summarizeWidget(raw: DiscordWidgetRaw | null | undefined): DiscordSummary {
  const fail = (error: string): DiscordSummary => ({
    ok: false,
    name: '',
    invite: null,
    online: 0,
    members: [],
    error,
  });
  if (!raw) return fail('Không đọc được Discord');
  if (raw.code === 50004)
    return fail('Server Discord chưa bật Widget (Cài đặt máy chủ → Tiện ích)');
  if (raw.retry_after !== undefined || /rate limit/i.test(raw.message ?? ''))
    return fail('Discord đang giới hạn lượt truy cập, thử lại sau ít phút nhé');
  if (raw.code || !raw.name) return fail(raw.message || 'Không đọc được Discord');
  const members = (raw.members ?? []).slice(0, 40).map((m) => ({
    name: String(m.username ?? '?').slice(0, 32),
    avatar:
      typeof m.avatar_url === 'string' && m.avatar_url.startsWith('https://') ? m.avatar_url : null,
    status: m.status ?? 'online',
    game: m.game?.name ? String(m.game.name).slice(0, 40) : null,
  }));
  const invite =
    typeof raw.instant_invite === 'string' && raw.instant_invite.startsWith('https://discord.')
      ? raw.instant_invite
      : null;
  return {
    ok: true,
    name: raw.name,
    invite,
    online: raw.presence_count ?? members.length,
    members,
  };
}

export function discordWidgetUrl(guild: string = DISCORD_GUILD_ID): string {
  return `https://discord.com/api/guilds/${guild}/widget.json`;
}
