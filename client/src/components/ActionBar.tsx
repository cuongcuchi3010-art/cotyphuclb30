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
import { PowerRollButton } from './PowerRoll';
import { BuildPicker } from './BuildPicker';
import { Avatar } from './Avatar';
import { useStore } from '../store';
import { cx, nameOf, photoOf, playerColor, useGame } from '../lib';
import { Btn } from './ui';
import { useState } from 'react';

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
    return (
      <div className={note}>
        {S.mercy.waitingOwner(nameOf(room, ph.owner), nameOf(room, ph.payer))}
      </div>
    );
  if (ph.kind === 'casino' && game.casino)
    return <div className={note}>{S.casino.waiting(CASINO_NAMES[game.casino.kind])}</div>;
  if (ph.kind === 'cardChoice') {
    return (
      <div className={note}>
        {myTurn
          ? `👆 ${
              ph.choice === 'demolish'
                ? S.choice.demolishHint
                : ph.choice === 'festival'
                  ? S.choice.festivalHint(maxFestivals(game))
                  : ph.choice === 'swap'
                    ? S.choice.swapHint
                    : ph.choice === 'teleport'
                      ? S.choice.teleportHint
                      : S.choice.giftHint
            }`
          : S.choice.waiting(cur.name)}
      </div>
    );
  }
  if (!myTurn) {
    const who = ph.kind === 'raiseFunds' ? ph.debtor : cur.id;
    const doing =
      ph.kind === 'awaitRoll'
        ? S.wait.roll
        : ph.kind === 'awaitBuy'
          ? S.wait.buy
          : ph.kind === 'raiseFunds'
            ? S.wait.raise
            : ph.kind === 'auction'
              ? S.wait.auction
              : S.wait.think;
    const wp = game.players.find((p) => p.id === who);
    return (
      <div className={cx(note, 'flex items-center justify-center gap-1.5')}>
        {wp && (
          <Avatar
            token={wp.token}
            color={playerColor(room, who)}
            size={22}
            photo={photoOf(room, who)}
          />
        )}
        <span>
          ⏳ <b>{nameOf(room, who)}</b> {doing}
        </span>
      </div>
    );
  }

  const pass = game.buildPass ?? null;
  const buildBtn =
    pass !== null && canBuild(game, meP, pass) === null ? (
      <BuildHereButton pos={pass} className={`${B} mb-1.5 w-full`} />
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
          <PowerRollButton
            className={B}
            variant="secondary"
            onRoll={(power) => act({ type: 'roll', power })}
          >
            🎲 {S.game.rollDoubles}
          </PowerRollButton>
        </div>
      </div>
    );
  }
  if (ph.kind === 'awaitRoll') {
    return (
      <div className="w-full">
        {buildBtn}
        <PowerRollButton
          className={`${B} w-full animate-glow !text-[max(13px,2.1cqw)]`}
          onRoll={(power) => act({ type: 'roll', power })}
        >
          🎲 {game.doublesCount > 0 ? S.game.rollAgain : S.game.roll}
        </PowerRollButton>
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

/** Nút "Xây tại đây…" mở hộp chọn số nhà */
function BuildHereButton({ pos, className }: { pos: number; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn className={className} variant="gold" onClick={() => setOpen(true)}>
        {S.game.buildHere(
          square(pos).short ?? square(pos).name,
          formatMoney((square(pos) as { houseCost: number }).houseCost),
        )}
      </Btn>
      <BuildPicker pos={pos} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
