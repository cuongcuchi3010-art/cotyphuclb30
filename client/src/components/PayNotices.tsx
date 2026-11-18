import { AnimatePresence, motion } from 'framer-motion';
import { formatMoney, square } from '@cotyphu/shared';
import { useStore } from '../store';
import { nameOf, playerColor, useGame, photoOf } from '../lib';
import { Avatar } from './Avatar';

const REASON: Record<string, string> = {
  rent: 'tiền thuê',
  payEach: 'thẻ Chủ tịch HĐQT',
  collectEach: 'lì xì / quà',
  loan: 'trả nợ vay',
};

/** Thông báo nổi khi người chơi trả tiền cho người khác — cả phòng cùng theo dõi */
export function PayNotices() {
  const { room, game } = useGame();
  const notices = useStore((s) => s.notices);
  const me = useStore((s) => s.me);
  if (!room || !game) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[65] flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {notices.map((n) => {
          const from = game.players.find((p) => p.id === n.from);
          const to = game.players.find((p) => p.id === n.to);
          if (!from || !to) return null;
          const mine = n.to === me ? 'in' : n.from === me ? 'out' : null;
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: -30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="flex max-w-md items-center gap-3 rounded-2xl border-2 bg-white/95 px-3 py-2 shadow-card backdrop-blur dark:bg-[#211d16]/95"
              style={{
                borderColor: mine === 'in' ? '#0E9F8E' : mine === 'out' ? '#C8102E' : '#F2A900',
              }}
            >
              <div className="flex shrink-0 items-center gap-1">
                <Avatar
                  token={from.token}
                  color={playerColor(room, from.id)}
                  size={34}
                  photo={photoOf(room, from.id)}
                />
                <motion.span
                  className="text-lg"
                  initial={{ x: -6 }}
                  animate={{ x: 6 }}
                  transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.5 }}
                >
                  💸
                </motion.span>
                <Avatar
                  token={to.token}
                  color={playerColor(room, to.id)}
                  size={34}
                  photo={photoOf(room, to.id)}
                />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-semibold">
                  <b>{n.from === me ? 'Bạn' : nameOf(room, n.from)}</b> trả{' '}
                  <span className="text-base font-extrabold text-son dark:text-nghe">
                    {formatMoney(n.amount)}
                  </span>{' '}
                  cho <b>{n.to === me ? 'bạn' : nameOf(room, n.to)}</b>
                </div>
                <div className="truncate text-xs text-gray-500">
                  {REASON[n.reason] ?? 'thanh toán'}
                  {n.pos !== undefined ? ` · ${square(n.pos).name}` : ''}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
