import { useEffect, useState } from 'react';
import { S } from '../strings.vi';
import { api } from '../store';
import { cx } from '../lib';
import { Btn, Modal } from './ui';

interface DiscordSummary {
  ok: boolean;
  name: string;
  invite: string | null;
  online: number;
  members: { name: string; avatar: string | null; status: string; game: string | null }[];
  error?: string;
}

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-amber-400',
  dnd: 'bg-red-500',
};

/** Logo Discord (vẽ đơn giản, không dùng file) */
function DiscordMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M20 4.6A19 19 0 0 0 15.3 3l-.6 1.2a17.6 17.6 0 0 0-5.4 0L8.7 3A19 19 0 0 0 4 4.6C1 9.1.2 13.4.6 17.7a19.2 19.2 0 0 0 5.8 2.9l1.2-1.9c-.7-.2-1.3-.5-1.9-.9l.5-.4a13.6 13.6 0 0 0 11.6 0l.5.4c-.6.4-1.2.7-1.9.9l1.2 1.9a19.1 19.1 0 0 0 5.8-2.9c.5-5-.8-9.3-3.4-13.1ZM8.5 15.1c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Zm7 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Z" />
    </svg>
  );
}

/** Nút "Discord · N online" + bảng thành viên đang online của server Discord CLB30 */
export function DiscordButton({ className, full }: { className?: string; full?: boolean }) {
  const [data, setData] = useState<DiscordSummary | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void api<DiscordSummary>('/api/discord').then((r) => {
        if (alive && r.ok) setData(r.data);
      });
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <>
      <Btn
        className={cx('!bg-[#5865F2] !text-white hover:!bg-[#4752C4]', className)}
        title={S.discord.title}
        onClick={() => setOpen(true)}
      >
        <DiscordMark />
        {full ? S.discord.title : null}
        {data?.ok && <span className="rounded-full bg-white/25 px-1.5 text-xs">{data.online}</span>}
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="text-[#5865F2]">
            <DiscordMark size={24} />
          </span>
          {data?.ok ? data.name : S.discord.title}
        </div>
        {!data ? (
          <div className="py-6 text-center text-sm text-gray-500">{S.discord.loading}</div>
        ) : !data.ok ? (
          <div className="py-6 text-center text-sm text-son">{data.error ?? S.discord.error}</div>
        ) : (
          <>
            <div className="mb-2 text-sm text-gray-500">{S.discord.online(data.online)}</div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {data.members.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl bg-black/5 px-2 py-1.5 dark:bg-white/5"
                >
                  <span className="relative shrink-0">
                    {m.avatar ? (
                      <img src={m.avatar} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-white">
                        {m.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span
                      className={cx(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900',
                        STATUS_COLOR[m.status] ?? 'bg-gray-400',
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    {m.game && (
                      <span className="block truncate text-xs text-gray-500">🎮 {m.game}</span>
                    )}
                  </span>
                </div>
              ))}
              {data.members.length === 0 && (
                <div className="py-4 text-center text-sm text-gray-500">{S.discord.empty}</div>
              )}
            </div>
          </>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data?.ok && data.invite ? (
            <a
              href={data.invite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#5865F2] font-semibold text-white"
            >
              <DiscordMark /> {S.discord.join}
            </a>
          ) : (
            <span />
          )}
          <Btn big variant="ghost" onClick={() => setOpen(false)}>
            {S.card.close}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
