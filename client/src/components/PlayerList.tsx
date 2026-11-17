import { OWNABLE_INDICES, formatMoney } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { cx, playerColor, useGame } from '../lib';
import { TokenIcon } from './TokenIcon';

export function PlayerList({ compact }: { compact?: boolean }) {
  const { room, game, me } = useGame();
  if (!room || !game) return null;
  const cur = game.players[game.current]?.id;
  return (
    <div className={cx('grid gap-1.5', compact ? 'grid-cols-3' : 'grid-cols-1')}>
      {game.players.map((p) => {
        const seat = room.players.find((s) => s.id === p.id);
        const props = OWNABLE_INDICES.filter((i) => game.properties[i]!.owner === p.id).length;
        const isCur = p.id === cur && game.phase.kind !== 'gameOver';
        return (
          <div
            key={p.id}
            className={cx(
              'flex items-center gap-2 rounded-xl border-2 bg-white/80 px-2 py-1.5 dark:bg-white/5',
              isCur ? 'border-nghe shadow' : 'border-transparent',
              p.bankrupt && 'opacity-40 grayscale',
            )}
          >
            <div className="relative shrink-0">
              <div
                className="rounded-full border-2 bg-white p-0.5 dark:bg-gray-900"
                style={{ borderColor: playerColor(room, p.id) }}
              >
                <TokenIcon token={p.token} size={compact ? 20 : 26} />
              </div>
              <span
                className={cx(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white',
                  seat?.online || seat?.isBot ? 'bg-green-500' : 'bg-gray-400',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 truncate text-sm font-semibold">
                <span className="truncate">{p.name}</span>
                {p.id === me && <span className="text-xs text-gray-400">({S.lobby.you})</span>}
                {room.hostId === p.id && <span title={S.lobby.host}>👑</span>}
              </div>
              <div className="flex flex-wrap gap-x-2 text-xs text-gray-600 dark:text-gray-300">
                <b className="text-son dark:text-nghe">{formatMoney(p.cash)}</b>
                {!compact && <span>🏘 {props}</span>}
                {p.inJail && <span>🚓 {S.game.jailed}</span>}
                {p.jailCards.length > 0 && <span>🎫 {p.jailCards.length}</span>}
                {seat?.isBot && <span>🤖 {S.game.bot}</span>}
                {!seat?.online && !seat?.isBot && !p.bankrupt && (
                  <span className="text-son">{S.game.offline}</span>
                )}
                {p.bankrupt && <span>{S.game.bankrupt}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
