import {
  CASINO_NAMES,
  canBuild,
  formatMoney,
  jailFine,
  maxFestivals,
  ownable,
  square,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { nameOf, useGame } from '../lib';
import { Btn } from './ui';

const B = '!min-h-[max(34px,5.2cqw)] !px-2 !text-[max(12px,1.8cqw)]';

/** Nút hành động chính (đặt giữa bàn cờ): tung / mua / kết thúc lượt / tạm giữ */
export function ActionBar() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const spectator = useStore((s) => s.spectator);
  if (!room || !game || game.phase.kind === 'gameOver') return null;
  const cur = game.players[game.current]!;
  const meP = game.players.find((p) => p.id === me);
  const myTurn = cur.id === me;
  const ph = game.phase;
  const note = 'text-center text-[max(10px,1.6cqw)] text-gray-600 dark:text-gray-300';

  if (spectator || !meP) return <div className={note}>👀 {S.game.spectating}</div>;
  if (meP.bankrupt) return <div className={note}>{S.game.bankrupt}</div>;
  if (ph.kind === 'drawOrder') return <div className={note}>{S.draw.spectate}</div>;
  if (ph.kind === 'mercy' && ph.owner !== me)
    return <div className={note}>{S.mercy.waiting(nameOf(room, ph.owner))}</div>;
  if (ph.kind === 'casino' && game.casino)
    return <div className={note}>{S.casino.waiting(CASINO_NAMES[game.casino.kind])}</div>;
  if (ph.kind === 'cardChoice') {
    return (
      <div className={note}>
        {myTurn
          ? `👆 ${ph.choice === 'demolish' ? S.choice.demolishHint : ph.choice === 'festival' ? S.choice.festivalHint(maxFestivals(game)) : S.choice.giftHint}`
          : S.choice.waiting(cur.name)}
      </div>
    );
  }
  if (!myTurn) {
    return (
      <div className={note}>
        {S.game.turnOf(nameOf(room, ph.kind === 'raiseFunds' ? ph.debtor : cur.id))} · {S.game.wait}
      </div>
    );
  }

  const pass = game.buildPass ?? null;
  const buildBtn =
    pass !== null && canBuild(game, meP, pass) === null ? (
      <Btn
        className={`${B} mb-1.5 w-full`}
        variant="gold"
        onClick={() => act({ type: 'build', pos: pass })}
      >
        {S.game.buildHere(
          square(pass).short ?? square(pass).name,
          formatMoney((square(pass) as { houseCost: number }).houseCost),
        )}
      </Btn>
    ) : null;
  if (ph.kind === 'awaitRoll' && meP.inJail) {
    return (
      <div className="w-full">
        <div className="mb-1 text-center text-[max(11px,1.6cqw)] font-semibold">
          🚓 {S.game.inJail} · {S.game.jailAttempts(meP.jailAttempts)}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Btn
            className={B}
            disabled={meP.cash < jailFine(game)}
            onClick={() => act({ type: 'payBail' })}
          >
            {S.game.payBail(formatMoney(jailFine(game)))}
          </Btn>
          <Btn
            className={B}
            variant="gold"
            disabled={meP.jailCards.length === 0}
            onClick={() => act({ type: 'useJailCard' })}
          >
            🎫 Thẻ
          </Btn>
          <Btn className={B} variant="secondary" onClick={() => act({ type: 'roll' })}>
            🎲 {S.game.rollDoubles}
          </Btn>
        </div>
      </div>
    );
  }
  if (ph.kind === 'awaitRoll') {
    return (
      <div className="w-full">
        {buildBtn}
        <Btn
          className={`${B} w-full animate-glow !text-[max(13px,2.1cqw)]`}
          onClick={() => act({ type: 'roll' })}
        >
          🎲 {game.doublesCount > 0 ? S.game.rollAgain : S.game.roll}
        </Btn>
      </div>
    );
  }
  if (ph.kind === 'awaitBuy') {
    const sq = ownable(ph.pos);
    return (
      <div className="grid w-full grid-cols-2 gap-1.5">
        <Btn className={B} disabled={meP.cash < sq.price} onClick={() => act({ type: 'buy' })}>
          {S.game.buy(formatMoney(sq.price))}
        </Btn>
        <Btn className={B} variant="ghost" onClick={() => act({ type: 'decline' })}>
          {S.game.decline}
        </Btn>
      </div>
    );
  }
  if (ph.kind === 'awaitEnd') {
    return (
      <div className="w-full">
        {buildBtn}
        <Btn
          className={`${B} w-full !text-[max(13px,2.1cqw)]`}
          variant="secondary"
          onClick={() => act({ type: 'endTurn' })}
        >
          ✅ {S.game.endTurn}
        </Btn>
      </div>
    );
  }
  return null;
}
