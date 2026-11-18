import {
  DISCORD_GUILD_ID,
  discordWidgetUrl,
  summarizeWidget,
  type DiscordSummary,
} from '@cotyphu/shared';

/** Dự phòng khi trình duyệt không gọi thẳng được Discord. */
export const DEFAULT_DISCORD_GUILD = DISCORD_GUILD_ID;
export { summarizeWidget };

// Cache trong RAM của Worker (Cache API không hoạt động trên *.workers.dev)
const OK_TTL = 120_000;
const ERR_TTL = 20_000;
const mem = new Map<string, { at: number; data: DiscordSummary }>();

export async function fetchDiscord(guild: string): Promise<DiscordSummary> {
  const hit = mem.get(guild);
  if (hit && Date.now() - hit.at < (hit.data.ok ? OK_TTL : ERR_TTL)) return hit.data;
  let data: DiscordSummary;
  try {
    const res = await fetch(discordWidgetUrl(guild), {
      headers: { 'user-agent': 'CoTyPhuCLB30 (widget)', accept: 'application/json' },
    });
    const text = await res.text();
    let raw: unknown = null;
    try {
      raw = JSON.parse(text);
    } catch {
      raw =
        res.status === 429 || /rate limit/i.test(text)
          ? { message: 'rate limited', retry_after: 60 }
          : null;
    }
    data = summarizeWidget(raw as never);
  } catch {
    data = summarizeWidget(null);
  }
  // Lỗi nhưng còn dữ liệu tốt cũ (< 10 phút) thì dùng lại dữ liệu cũ
  if (!data.ok && hit?.data.ok && Date.now() - hit.at < 600_000) return hit.data;
  mem.set(guild, { at: Date.now(), data });
  return data;
}
