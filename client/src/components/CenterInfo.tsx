import { motion } from 'framer-motion';
import { formatMoney, square } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, fmtClock, nameOf, playerColor, useGame, useNow } from '../lib';
import { TokenIcon } from './TokenIcon';

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

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-[3%] p-[4%] text-center">
      <div
        className="font-extrabold leading-none tracking-tight text-son drop-shadow-sm dark:text-nghe"
        style={{ fontSize: 'clamp(14px, 4.4vmin, 40px)' }}
      >
        Cờ Tỷ Phú
        <span className="ml-2 rounded-md bg-nghe px-2 text-son-700" style={{ fontSize: '0.8em' }}>
          CLB30
        </span>
      </div>

      <div className="flex gap-[6%]" style={{ width: 'clamp(70px, 22vmin, 180px)' }}>
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
        <div
          className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm dark:bg-black/40"
          style={{ fontSize: 'clamp(10px, 2vmin, 16px)' }}
        >
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: playerColor(room, actorId) }}
          />
          <TokenIcon
            token={game.players.find((p) => p.id === actorId)?.token ?? cur.token}
            size={20}
          />
          <span className="font-semibold">
            {ph.kind === 'auction'
              ? `${S.auction.title}: ${square(game.auction!.pos).name}`
              : ph.kind === 'raiseFunds'
                ? S.raise.other(nameOf(room, ph.debtor))
                : S.game.turnOf(cur.name)}
          </span>
          {left !== null && (
            <span
              className={cx('tabular-nums font-bold', left < 10_000 ? 'text-son' : 'text-ngoc-600')}
            >
              ⏱ {fmtClock(left)}
            </span>
          )}
        </div>
      )}

      <div
        className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-gray-600 dark:text-gray-300"
        style={{ fontSize: 'clamp(8px, 1.5vmin, 13px)' }}
      >
        <span>
          🏠 {game.bank.houses}/32 · 🏨 {game.bank.hotels}/12
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
