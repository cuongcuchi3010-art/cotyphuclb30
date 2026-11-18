import { motion } from 'framer-motion';
import { formatMoney, netWorth, ranking, square } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { playerColor, useGame, photoOf } from '../lib';
import { TokenIcon } from './TokenIcon';
import { Avatar } from './Avatar';
import { Btn } from './ui';

export function GameOver() {
  const { room, game, me } = useGame();
  const send = useStore((s) => s.send);
  if (!room || !game) return null;
  const order = ranking(game);
  const winner = game.players.find((p) => p.id === game.winner);
  const most = game.landings.reduce((best, n, i) => (n > (game.landings[best] ?? 0) ? i : best), 0);
  const topRent = [...game.players].sort(
    (a, b) => b.stats.rentCollected - a.stats.rentCollected,
  )[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-3">
      <motion.div
        className="w-full max-w-md rounded-3xl bg-giay p-5 shadow-card dark:bg-giay-dark"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <div className="text-center">
          <div className="text-sm font-bold uppercase tracking-wider text-son">
            {game.endReason === 'timeUp' ? S.over.timeUp : S.over.title}
          </div>
          <div className="my-2 text-5xl">🏆</div>
          {winner && (
            <div className="flex items-center justify-center gap-2 text-2xl font-extrabold">
              <TokenIcon token={winner.token} size={36} />
              {S.over.winner(winner.name)}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1 text-sm font-bold">{S.over.ranking}</div>
          <ol className="space-y-1">
            {order.map((id, k) => {
              const p = game.players.find((x) => x.id === id)!;
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 dark:bg-white/5"
                >
                  <span className="w-5 font-bold">{k + 1}.</span>
                  <Avatar
                    token={p.token}
                    color={playerColor(room, id)}
                    size={28}
                    photo={photoOf(room, id)}
                  />
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className="text-sm text-gray-500">
                    {p.bankrupt
                      ? S.game.bankrupt
                      : `${S.over.netWorth}: ${formatMoney(netWorth(game, id))}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-4 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
          <div className="mb-1 font-bold">{S.over.stats}</div>
          <div>
            📍 {S.over.mostLanded}: <b>{square(most).name}</b> ({game.landings[most]} lần)
          </div>
          {topRent && (
            <div>
              💰 {S.over.topRent}: <b>{topRent.name}</b> ({formatMoney(topRent.stats.rentCollected)}
              )
            </div>
          )}
          <div>
            🚓 {S.over.jailVisits}:{' '}
            {game.players.map((p) => `${p.name} ${p.stats.jailVisits}`).join(' · ')}
          </div>
        </div>

        <div className="mt-4">
          {room.hostId === me ? (
            <Btn big className="w-full" onClick={() => send({ type: 'playAgain' })}>
              🔁 {S.over.playAgain}
            </Btn>
          ) : (
            <div className="text-center text-sm text-gray-500">{S.over.waitingHost}</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
