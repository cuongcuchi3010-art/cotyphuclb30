import { formatMoney, ownable } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { nameOf, useGame } from '../lib';
import { Btn } from './ui';

/** Nút hành động chính: tung / mua / kết thúc lượt / tạm giữ */
export function ActionBar() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const spectator = useStore((s) => s.spectator);
  if (!room || !game || game.phase.kind === 'gameOver') return null;
  const cur = game.players[game.current]!;
  const meP = game.players.find((p) => p.id === me);
  const myTurn = cur.id === me;
  const ph = game.phase;

  if (spectator || !meP) {
    return <div className="text-center text-sm text-gray-500">👀 {S.game.spectating}</div>;
  }
  if (meP.bankrupt) {
    return <div className="text-center text-sm font-semibold text-gray-500">{S.game.bankrupt}</div>;
  }
  if (!myTurn) {
    return (
      <div className="text-center text-sm text-gray-500">
        {S.game.turnOf(nameOf(room, ph.kind === 'raiseFunds' ? ph.debtor : cur.id))} · {S.game.wait}
      </div>
    );
  }

  if (ph.kind === 'awaitRoll' && meP.inJail) {
    return (
      <div>
        <div className="mb-2 text-center text-sm font-semibold">
          🚓 {S.game.inJail} · {S.game.jailAttempts(meP.jailAttempts)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Btn big disabled={meP.cash < 50} onClick={() => act({ type: 'payBail' })}>
            {S.game.payBail}
          </Btn>
          <Btn
            big
            variant="gold"
            disabled={meP.jailCards.length === 0}
            onClick={() => act({ type: 'useJailCard' })}
          >
            {S.game.useCard}
          </Btn>
          <Btn big variant="secondary" onClick={() => act({ type: 'roll' })}>
            🎲 {S.game.rollDoubles}
          </Btn>
        </div>
      </div>
    );
  }
  if (ph.kind === 'awaitRoll') {
    return (
      <Btn big className="w-full text-lg" onClick={() => act({ type: 'roll' })}>
        🎲 {game.doublesCount > 0 ? S.game.rollAgain : S.game.roll}
      </Btn>
    );
  }
  if (ph.kind === 'awaitBuy') {
    const sq = ownable(ph.pos);
    return (
      <div className="grid grid-cols-2 gap-2">
        <Btn big disabled={meP.cash < sq.price} onClick={() => act({ type: 'buy' })}>
          {S.game.buy(formatMoney(sq.price))}
        </Btn>
        <Btn big variant="ghost" onClick={() => act({ type: 'decline' })}>
          {S.game.decline}
        </Btn>
      </div>
    );
  }
  if (ph.kind === 'awaitEnd') {
    return (
      <Btn
        big
        variant="secondary"
        className="w-full text-lg"
        onClick={() => act({ type: 'endTurn' })}
      >
        ✅ {S.game.endTurn}
      </Btn>
    );
  }
  return null;
}
