import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { formatMoney, square } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, fmtClock, nameOf, playerColor, useGame, useNow } from '../lib';
import { ActionBar } from './ActionBar';
import { Avatar } from './Avatar';

/** Giữa bàn cờ: xúc xắc, lượt + đồng hồ, nút hành động, nhật ký */
export function CenterInfo() {
  const { room, game } = useGame();
  const events = useStore((s) => s.events);
  const now = useNow(250);
  if (!room || !game) return null;
  const cur = game.players[game.current]!;
  const dice = game.lastDice ?? [1, 1];
  const rolledNow = events.list.some((e) => e.t === 'roll');
  const left = room.deadline ? room.deadline - now : null;
  const ph = game.phase;
  const actorId = ph.kind === 'raiseFunds' ? ph.debtor : cur.id;
  const actor = game.players.find((p) => p.id === actorId) ?? cur;

  return (
    <div className="relative flex h-full flex-col items-center gap-[1.6cqw] p-[2.2cqw]">
      <div
        className="font-extrabold leading-none tracking-tight text-son dark:text-nghe"
        style={{ fontSize: '2.6cqw' }}
      >
        Cờ Tỷ Phú
        <span
          className="ml-1.5 rounded-md bg-nghe px-1.5 text-son-700"
          style={{ fontSize: '0.85em' }}
        >
          CLB30
        </span>
      </div>

      <div className="flex w-full items-center justify-center gap-[2cqw]">
        <div className="flex gap-[1cqw]" style={{ width: '14cqw' }}>
          {dice.map((d, i) => (
            <motion.div
              key={`${events.id}-${i}`}
              initial={rolledNow ? { rotate: -360, scale: 0.4, y: -20 } : false}
              animate={{ rotate: 0, scale: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: i * 0.05,
                type: 'spring',
                stiffness: 180,
                damping: 14,
              }}
              className="flex-1"
            >
              <Die value={d} />
            </motion.div>
          ))}
        </div>
        {ph.kind !== 'gameOver' && (
          <div className="flex min-w-0 items-center gap-[1cqw] rounded-full bg-white/85 px-[1.4cqw] py-[0.6cqw] shadow-sm dark:bg-black/40">
            <Avatar token={actor.token} color={playerColor(room, actorId)} size="4cqw" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-bold" style={{ fontSize: '1.7cqw' }}>
                {ph.kind === 'auction'
                  ? `${S.auction.title}: ${square(game.auction!.pos).short ?? square(game.auction!.pos).name}`
                  : ph.kind === 'raiseFunds'
                    ? S.raise.other(nameOf(room, ph.debtor))
                    : S.game.turnOf(cur.name)}
              </div>
              {left !== null && (
                <div
                  className={cx(
                    'font-bold tabular-nums',
                    left < 10_000 ? 'text-son' : 'text-ngoc-600',
                  )}
                  style={{ fontSize: '1.6cqw' }}
                >
                  ⏱ {fmtClock(left)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-[60cqw]">
        <ActionBar />
      </div>

      <LogFeed />

      <div
        className="flex flex-wrap justify-center gap-x-3 text-gray-600 dark:text-gray-300"
        style={{ fontSize: '1.25cqw' }}
      >
        <span>
          🏠 {game.bank.houses}/{game.rules.houseStock ?? 32} · 🏨 {game.bank.hotels}/
          {game.rules.hotelStock ?? 12}
        </span>
        {game.rules.jackpot && (
          <span>
            ☕ {S.game.jackpot}: <b>{formatMoney(game.jackpot)}</b>
          </span>
        )}
        {room.gameEndsAt && (
          <span>
            ⌛ {S.game.gameTimeLeft} {fmtClock(room.gameEndsAt - now)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Nhật ký ván ở giữa bàn cờ */
export function LogFeed({ panel }: { panel?: boolean } = {}) {
  const { room } = useGame();
  const box = useRef<HTMLDivElement>(null);
  const log = room?.log ?? [];
  const lastId = log[log.length - 1]?.id ?? 0;
  /** Đang ở cuối danh sách → tự cuộn theo dòng mới; đang kéo lên đọc → giữ nguyên */
  const stick = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [lastId]);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-xl bg-white/75 shadow-inner dark:bg-black/35">
      <div
        className={cx(
          'font-bold text-ngoc-700 dark:text-ngoc-100',
          panel ? 'px-3 pt-2' : 'px-[1.4cqw] pt-[0.8cqw]',
        )}
        style={{ fontSize: panel ? '14px' : '1.45cqw' }}
      >
        📜 {S.log}
      </div>
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className={cx(
          'min-h-0 flex-1 overflow-y-auto',
          panel ? 'space-y-0.5 px-3 pb-2' : 'space-y-[0.3cqw] px-[1.4cqw] pb-[0.8cqw]',
        )}
        style={{ fontSize: panel ? '13px' : 'max(9px, 1.45cqw)' }}
      >
        {log.slice(-60).map((l) => (
          <div
            key={l.id}
            className={cx(
              l.text.startsWith('—')
                ? 'mt-1 font-semibold text-ngoc-700 dark:text-ngoc-100'
                : 'text-gray-800 dark:text-gray-200',
            )}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 26],
    [72, 26],
    [28, 50],
    [72, 50],
    [28, 74],
    [72, 74],
  ],
};

export function Die({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full drop-shadow-md">
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="18"
        fill="white"
        stroke="#C8102E"
        strokeWidth="4"
      />
      {PIPS[value]?.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={value === 1 ? '#C8102E' : '#222'} />
      ))}
    </svg>
  );
}
