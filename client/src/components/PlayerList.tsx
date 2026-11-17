import { OWNABLE_INDICES, formatMoney } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, playerColor, useGame } from '../lib';
import { useVoice } from '../voice';
import { Avatar } from './Avatar';

/** Danh sách người chơi; bấm vào người khác để mở giao dịch với họ */
export function PlayerList({ compact }: { compact?: boolean }) {
  const { room, game, me } = useGame();
  const speaking = useVoice((s) => s.speaking);
  const setDraft = useStore((s) => s.setTradeDraft);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  if (!room || !game) return null;
  const cur = game.players[game.current]?.id;
  const meP = game.players.find((p) => p.id === me);
  return (
    <div className={cx('grid gap-1.5', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1')}>
      {game.players.map((p) => {
        const seat = room.players.find((s) => s.id === p.id);
        const props = OWNABLE_INDICES.filter((i) => game.properties[i]!.owner === p.id).length;
        const isCur = p.id === cur && game.phase.kind !== 'gameOver';
        const color = playerColor(room, p.id);
        const canTrade = !!meP && !meP.bankrupt && p.id !== me && !p.bankrupt;
        return (
          <button
            type="button"
            key={p.id}
            disabled={!canTrade}
            title={canTrade ? S.trade.pick : undefined}
            onClick={() => {
              setDraft({
                to: p.id,
                giveCash: 0,
                giveProps: [],
                giveCards: 0,
                takeCash: 0,
                takeProps: [],
                takeCards: 0,
              });
              setTab('trade');
              setSheet(true);
            }}
            className={cx(
              'flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left',
              isCur ? 'shadow' : 'border-transparent',
              canTrade && 'hover:bg-white',
              p.bankrupt && 'opacity-40 grayscale',
            )}
            style={{
              borderColor: isCur ? color : undefined,
              background: `linear-gradient(90deg, ${color}22, transparent 70%)`,
            }}
          >
            <div className="relative shrink-0">
              <Avatar
                token={p.token}
                color={color}
                size={compact ? 30 : 38}
                speaking={speaking.includes(p.id)}
              />
              <span
                className={cx(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white',
                  seat?.online || seat?.isBot ? 'bg-green-500' : 'bg-gray-400',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{p.name}</span>
                {p.id === me && <span className="text-xs text-gray-400">({S.lobby.you})</span>}
                {room.hostId === p.id && <span title={S.lobby.host}>👑</span>}
                {seat?.voice && <span title="Voice">🎙️</span>}
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
          </button>
        );
      })}
    </div>
  );
}
