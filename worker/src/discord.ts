/**
 * Discord widget: đọc https://discord.com/api/guilds/<id>/widget.json (server phải bật
 * "Server Widget" trong Cài đặt máy chủ → Tiện ích) và rút gọn cho client.
 */

export const DEFAULT_DISCORD_GUILD = '1572067055161835542';

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
}

export interface DiscordSummary {
  ok: boolean;
  name: string;
  invite: string | null;
  online: number;
  members: { name: string; avatar: string | null; status: string; game: string | null }[];
  error?: string;
}

/** Rút gọn dữ liệu widget (thuần, dễ test) */
export function summarizeWidget(raw: DiscordWidgetRaw): DiscordSummary {
  if (!raw || raw.code || !raw.name) {
    return {
      ok: false,
      name: '',
      invite: null,
      online: 0,
      members: [],
      error:
        raw?.code === 50004
          ? 'Server Discord chưa bật Widget'
          : raw?.message || 'Không đọc được Discord',
    };
  }
  const members = (raw.members ?? []).slice(0, 40).map((m) => ({
    name: String(m.username ?? '?').slice(0, 32),
    avatar: typeof m.avatar_url === 'string' && m.avatar_url.startsWith('https://') ? m.avatar_url : null,
    status: m.status ?? 'online',
    game: m.game?.name ? String(m.game.name).slice(0, 40) : null,
  }));
  const invite =
    typeof raw.instant_invite === 'string' && raw.instant_invite.startsWith('https://discord.')
      ? raw.instant_invite
      : null;
  return { ok: true, name: raw.name, invite, online: raw.presence_count ?? members.length, members };
}

export async function fetchDiscord(guild: string): Promise<DiscordSummary> {
  const url = `https://discord.com/api/guilds/${guild}/widget.json`;
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(url);
  if (hit) return (await hit.json()) as DiscordSummary;
  let summary: DiscordSummary;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'CoTyPhuCLB30 (widget)' } });
    summary = summarizeWidget((await res.json()) as DiscordWidgetRaw);
  } catch {
    summary = { ok: false, name: '', invite: null, online: 0, members: [], error: 'Không kết nối được Discord' };
  }
  await cache.put(
    url,
    new Response(JSON.stringify(summary), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
    }),
  );
  return summary;
}
