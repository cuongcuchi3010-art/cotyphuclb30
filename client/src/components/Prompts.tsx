import { useEffect, useState, type ReactNode } from 'react';
import {
  demolishTargets,
  festivalTargets,
  festivalMult,
  maxFestivals,
  rentFor,
  giftTargets,
  GROUPS,
  formatMoney,
  liquidationValue,
  mortgageValue,
  ownable,
  square,
  totalOwed,
  type LoanOffer,
  type Trade,
  type TradeSide,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, fmtClock, nameOf, playerColor, useGame, useNow, photoOf } from '../lib';
import { Btn, Modal } from './ui';
import { Avatar } from './Avatar';
import { motion } from 'framer-motion';

/** Các popup quan trọng: mua ô, đấu giá, gom tiền, giao dịch đến, chuộc ô, host xử lý mất kết nối */
export function Prompts() {
  return (
    <>
      <BuyPrompt />
      <AuctionPrompt />
      <RaiseFundsBanner />
      <IncomingTrade />
      <MortgageChoice />
      <IncomingLoan />
      <CardChoicePrompt />
      <DrawOrderPrompt />
      <HostDisconnect />
    </>
  );
}

function BuyPrompt() {
  const { game, me } = useGame();
  const act = useStore((s) => s.act);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  const [hidden, setHidden] = useState(false);
  const ph = game?.phase;
  const isMine = !!game && ph?.kind === 'awaitBuy' && game.players[game.current]!.id === me;
  const pos = ph?.kind === 'awaitBuy' ? ph.pos : -1;
  useEffect(() => {
    setHidden(false);
  }, [pos, game?.turn]);
  if (!game || !isMine || pos < 0) return null;
  const sq = ownable(pos);
  const meP = game.players.find((p) => p.id === me)!;
  const enough = meP.cash >= sq.price;
  const color = sq.kind === 'street' ? GROUPS[sq.group].color : sq.brandColor;
  return (
    <Modal open={!hidden}>
      <div className="text-center">
        <div className="mx-auto mb-3 h-2 w-20 rounded-full" style={{ background: color }} />
        <div className="text-sm text-gray-500">{S.game.offerTitle}</div>
        <div className="text-2xl font-bold">{sq.name}</div>
        <div className="my-2 text-3xl font-extrabold text-son dark:text-nghe">
          {formatMoney(sq.price)}
        </div>
        {sq.kind === 'street' && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Thuê: {formatMoney(sq.rent[0])} · KS: {formatMoney(sq.rent[5])}
          </div>
        )}
        <div className="mt-1 text-sm">
          Tiền mặt của bạn: <b>{formatMoney(meP.cash)}</b>
        </div>
        {!enough && <div className="mt-2 text-sm text-son">{S.game.offerNotEnough}</div>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Btn big disabled={!enough} onClick={() => act({ type: 'buy' })}>
            {S.game.buy(formatMoney(sq.price))}
          </Btn>
          <Btn big variant="ghost" onClick={() => act({ type: 'decline' })}>
            {S.game.decline}
          </Btn>
        </div>
        {!enough && (
          <Btn
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              setHidden(true);
              setTab('assets');
              setSheet(true);
            }}
          >
            {S.raise.openAssets}
          </Btn>
        )}
      </div>
    </Modal>
  );
}

function AuctionPrompt() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const now = useNow(200);
  const [custom, setCustom] = useState('');
  const [mini, setMini] = useState(false);
  const a = game?.auction;
  useEffect(() => {
    setMini(false);
  }, [a?.pos]);
  if (!room || !game || game.phase.kind !== 'auction' || !a) return null;
  const meP = game.players.find((p) => p.id === me);
  const canBid = !!meP && !meP.bankrupt && a.bidders.includes(meP.id);
  const leading = a.highBidder === me;
  const left = room.deadline ? room.deadline - now : 0;
  const sq = square(a.pos);
  const bid = (amount: number) => act({ type: 'bid', amount });
  const base = Math.max(a.highBid, 0);

  if (mini) {
    return (
      <button
        type="button"
        onClick={() => setMini(false)}
        className="fixed left-1/2 top-2 z-40 -translate-x-1/2 rounded-full bg-nghe px-4 py-2 font-semibold text-son-700 shadow-card"
      >
        🔨 {sq.name}: {a.highBid ? formatMoney(a.highBid) : '—'} · {fmtClock(left)}
      </button>
    );
  }
  return (
    <Modal open onClose={() => setMini(true)}>
      <div className="text-center">
        <div className="text-sm font-bold uppercase tracking-wider text-son">
          🔨 {S.auction.title}
        </div>
        <div className="text-2xl font-bold">{sq.name}</div>
        <div className="text-sm text-gray-500">
          Giá niêm yết {formatMoney(ownable(a.pos).price)}
        </div>
        <div className="my-3">
          <div className="text-xs text-gray-500">{S.auction.current}</div>
          <div className="text-4xl font-extrabold text-son dark:text-nghe">
            {a.highBid ? formatMoney(a.highBid) : '—'}
          </div>
          <div className="text-sm">
            {a.highBidder ? S.auction.leader(nameOf(room, a.highBidder)) : S.auction.none}
          </div>
        </div>
        <div className="mx-auto mb-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className={cx('h-full transition-all', left < 3000 ? 'bg-son' : 'bg-ngoc')}
            style={{ width: `${Math.min(100, (left / 10000) * 100)}%` }}
          />
        </div>
        {canBid ? (
          leading ? (
            <div className="rounded-xl bg-ngoc-50 p-3 font-semibold text-ngoc-700 dark:bg-ngoc-700/30 dark:text-ngoc-100">
              {S.auction.youLead}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[10, 50, 100].map((inc) => (
                  <Btn
                    key={inc}
                    big
                    disabled={!meP || base + inc > meP.cash}
                    onClick={() => bid(Math.max(10, base + inc))}
                  >
                    +{inc}
                  </Btn>
                ))}
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = parseInt(custom, 10);
                  if (v > 0) bid(v);
                  setCustom('');
                }}
              >
                <input
                  inputMode="numeric"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                  placeholder={S.auction.custom}
                  className="min-h-[44px] flex-1 rounded-xl border border-black/10 bg-white px-3 dark:border-white/20 dark:bg-black/30"
                />
                <Btn big variant="gold" type="submit">
                  {S.auction.bid}
                </Btn>
              </form>
              <div className="mt-2 text-xs text-gray-500">
                {S.auction.min} · Tiền mặt: {formatMoney(meP!.cash)}
              </div>
            </>
          )
        ) : null}
      </div>
    </Modal>
  );
}

function RaiseFundsBanner() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  const now = useNow(500);
  if (!room || !game || game.phase.kind !== 'raiseFunds' || game.phase.debtor !== me) return null;
  const meP = game.players.find((p) => p.id === me)!;
  const debt = game.debts[0];
  if (!debt) return null;
  const owed = totalOwed(game, me);
  const canPay = meP.cash >= debt.amount;
  const canBankrupt = liquidationValue(game, me) < owed;
  return (
    <div className="fixed inset-x-2 top-2 z-40 mx-auto max-w-lg rounded-2xl border-2 border-son bg-white p-3 shadow-card dark:bg-[#2a1014]">
      <div className="flex items-center justify-between">
        <div className="font-bold text-son">💰 {S.raise.title}</div>
        {room.deadline && (
          <div className="tabular-nums font-bold text-son">⏱ {fmtClock(room.deadline - now)}</div>
        )}
      </div>
      <div className="text-sm">
        {S.raise.owe(formatMoney(debt.amount), nameOf(room, debt.to))} ·{' '}
        <b>{S.raise.short(formatMoney(Math.max(0, debt.amount - meP.cash)))}</b>
      </div>
      <div className="text-xs text-gray-500">{S.raise.hint}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Btn big disabled={!canPay} onClick={() => act({ type: 'payDebt' })}>
          {S.raise.pay}
        </Btn>
        <Btn
          big
          variant="ghost"
          onClick={() => {
            setTab('assets');
            setSheet(true);
          }}
        >
          {S.raise.openAssets}
        </Btn>
        {canBankrupt && (
          <Btn big variant="danger" onClick={() => act({ type: 'declareBankruptcy' })}>
            {S.raise.bankrupt}
          </Btn>
        )}
      </div>
    </div>
  );
}

export function SideView({ side, owner }: { side: TradeSide; owner: string }) {
  const { room } = useGame();
  const items: string[] = [];
  if (side.cash) items.push(formatMoney(side.cash));
  for (const p of side.properties) items.push(square(p).name);
  if (side.jailCards) items.push(`${side.jailCards} Thẻ Bảo Lãnh`);
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500">
        {nameOf(room, owner)} {S.trade.gives}:
      </div>
      <div className="text-sm font-medium">{items.length ? items.join(', ') : S.trade.nothing}</div>
    </div>
  );
}

export function TradeActions({ t, onDone }: { t: Trade; onDone?: () => void }) {
  const { me } = useGame();
  const act = useStore((s) => s.act);
  const setDraft = useStore((s) => s.setTradeDraft);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  if (t.to === me) {
    return (
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Btn
          onClick={() => {
            act({ type: 'acceptTrade', id: t.id });
            onDone?.();
          }}
        >
          {S.trade.accept}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            act({ type: 'rejectTrade', id: t.id });
            onDone?.();
          }}
        >
          {S.trade.reject}
        </Btn>
        <Btn
          variant="gold"
          onClick={() => {
            setDraft({
              to: t.from,
              giveCash: t.take.cash,
              giveProps: [...t.take.properties],
              giveCards: t.take.jailCards,
              takeCash: t.give.cash,
              takeProps: [...t.give.properties],
              takeCards: t.give.jailCards,
              counterOf: t.id,
            });
            setTab('trade');
            setSheet(true);
            onDone?.();
          }}
        >
          {S.trade.counter}
        </Btn>
      </div>
    );
  }
  if (t.from === me)
    return (
      <Btn variant="ghost" className="mt-2" onClick={() => act({ type: 'cancelTrade', id: t.id })}>
        {S.trade.cancel}
      </Btn>
    );
  return null;
}

function IncomingTrade() {
  const { room, game, me } = useGame();
  const [seen, setSeen] = useState<string[]>([]);
  const t = game?.trades.find((x) => x.to === me && !seen.includes(x.id));
  if (!t || !room) return null;
  const close = () => setSeen((s) => [...s, t.id]);
  return (
    <Modal open onClose={close}>
      <div className="mb-3 text-center text-lg font-bold">
        🤝 {S.trade.incoming(nameOf(room, t.from))}
      </div>
      <div className="space-y-2 rounded-xl bg-black/5 p-3 dark:bg-white/10">
        <SideView side={t.give} owner={t.from} />
        <SideView side={t.take} owner={t.to} />
      </div>
      <TradeActions t={t} onDone={close} />
    </Modal>
  );
}

function MortgageChoice() {
  const { game, me } = useGame();
  const act = useStore((s) => s.act);
  const ch = game?.mortgageChoices.find((m) => m.playerId === me);
  if (!game || !ch || game.phase.kind === 'auction') return null;
  return (
    <Modal open>
      <div className="text-center">
        <div className="text-sm text-gray-500">{S.assets.received}</div>
        <div className="my-2 text-xl font-bold">{square(ch.pos).name}</div>
        <div className="grid grid-cols-2 gap-2">
          <Btn big onClick={() => act({ type: 'mortgageChoice', pos: ch.pos, redeem: true })}>
            {S.assets.redeemNow(formatMoney(mortgageValue(ch.pos)))}
          </Btn>
          <Btn
            big
            variant="ghost"
            onClick={() => act({ type: 'mortgageChoice', pos: ch.pos, redeem: false })}
          >
            {S.assets.keep}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function HostDisconnect() {
  const { room, me } = useGame();
  const send = useStore((s) => s.send);
  if (!room || room.hostId !== me || room.status !== 'playing') return null;
  const seat = room.players.find((p) => p.awaitingHostDecision);
  if (!seat) return null;
  const choose = (choice: 'wait' | 'bot' | 'bankrupt') =>
    send({ type: 'disconnectChoice', playerId: seat.id, choice });
  return (
    <Modal open>
      <div className="mb-4 text-center text-lg font-bold">📡 {S.disconnect.title(seat.name)}</div>
      <div className="grid gap-2">
        <Btn big variant="ghost" onClick={() => choose('wait')}>
          {S.disconnect.wait}
        </Btn>
        <Btn big variant="secondary" onClick={() => choose('bot')}>
          🤖 {S.disconnect.bot}
        </Btn>
        <Btn big variant="danger" onClick={() => choose('bankrupt')}>
          {S.disconnect.bankrupt}
        </Btn>
      </div>
    </Modal>
  );
}

export function LoanActions({ o, onDone }: { o: LoanOffer; onDone?: () => void }) {
  const { me } = useGame();
  const act = useStore((s) => s.act);
  if (o.to === me)
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn
          onClick={() => {
            act({ type: 'acceptLoan', id: o.id });
            onDone?.();
          }}
        >
          {S.loan.accept}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            act({ type: 'rejectLoan', id: o.id });
            onDone?.();
          }}
        >
          {S.loan.reject}
        </Btn>
      </div>
    );
  if (o.from === me)
    return (
      <Btn
        variant="ghost"
        className="mt-1 !min-h-[30px]"
        onClick={() => act({ type: 'cancelLoan', id: o.id })}
      >
        {S.loan.cancel}
      </Btn>
    );
  return null;
}

function IncomingLoan() {
  const { room, game, me } = useGame();
  const [seen, setSeen] = useState<string[]>([]);
  const o = game?.loanOffers?.find((x) => x.to === me && !seen.includes(x.id));
  if (!o || !room) return null;
  const close = () => setSeen((s) => [...s, o.id]);
  return (
    <Modal open onClose={close}>
      <div className="mb-3 text-center text-lg font-bold">
        💰{' '}
        {o.lender === o.from
          ? S.loan.incomingLend(nameOf(room, o.from))
          : S.loan.incomingBorrow(nameOf(room, o.from))}
      </div>
      <div className="rounded-xl bg-black/5 p-3 text-center dark:bg-white/10">
        {S.loan.terms(formatMoney(o.amount), formatMoney(o.repay), o.turns)}
        <div className="mt-1 text-xs text-gray-500">{S.loan.rentHint}</div>
      </div>
      <LoanActions o={o} onDone={close} />
    </Modal>
  );
}

/** Thẻ cho người rút tự chọn: đập nhà người khác / tặng ô đất */
function CardChoicePrompt() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const [pick, setPick] = useState<number | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const ph = game?.phase;
  const mine = !!game && ph?.kind === 'cardChoice' && game.players[game.current]!.id === me;
  const seq = game?.seq;
  useEffect(() => {
    setPick(null);
    setTo(null);
  }, [seq]);
  if (!room || !game || !me || !mine || ph?.kind !== 'cardChoice') return null;
  const row = (pos: number, right: ReactNode, active: boolean, onClick: () => void) => {
    const sq = ownable(pos);
    const color = sq.kind === 'street' ? GROUPS[sq.group].color : sq.brandColor;
    return (
      <button
        key={pos}
        type="button"
        onClick={onClick}
        className={cx(
          'flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left',
          active
            ? 'border-son bg-son-50 dark:bg-son-700/30'
            : 'border-transparent bg-black/5 dark:bg-white/5',
        )}
      >
        <span className="h-7 w-1.5 shrink-0 rounded" style={{ background: color }} />
        <span className="min-w-0 flex-1 truncate font-semibold">
          {sq.kind === 'street' ? `${sq.icon ?? ''} ` : ''}
          {sq.name}
        </span>
        <span className="shrink-0 text-xs text-gray-500">{right}</span>
      </button>
    );
  };
  if (ph.choice === 'festival') {
    const targets = festivalTargets(game, me);
    return (
      <Modal open>
        <div className="text-center text-lg font-bold">{S.choice.festivalTitle}</div>
        <div className="mb-3 text-center text-sm text-gray-500">
          {S.choice.festivalHint(maxFestivals(game))}
        </div>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {targets.map((pos) => {
            const now = rentFor(game, pos, { diceTotal: 7 });
            const base = now / festivalMult(game, pos);
            return row(
              pos,
              <>
                {formatMoney(base)} →{' '}
                <b className="text-son">
                  {formatMoney(base * 2)}–{formatMoney(base * 4)}
                </b>
              </>,
              false,
              () => act({ type: 'chooseFestival', pos }),
            );
          })}
        </div>
      </Modal>
    );
  }
  if (ph.choice === 'demolish') {
    const targets = demolishTargets(game, me);
    return (
      <Modal open>
        <div className="text-center text-lg font-bold">{S.choice.demolishTitle}</div>
        <div className="mb-3 text-center text-sm text-gray-500">{S.choice.demolishHint}</div>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {targets.map((pos) =>
            row(
              pos,
              <>
                {nameOf(room, game.properties[pos]!.owner)} ·{' '}
                {S.choice.houses(game.properties[pos]!.houses)}
              </>,
              false,
              () => act({ type: 'chooseDemolish', pos }),
            ),
          )}
        </div>
      </Modal>
    );
  }
  const targets = giftTargets(game, me);
  const others = game.players.filter((p) => !p.bankrupt && p.id !== me);
  return (
    <Modal open>
      <div className="text-center text-lg font-bold">{S.choice.giftTitle}</div>
      <div className="mb-3 text-center text-sm text-gray-500">{S.choice.giftHint}</div>
      <div className="max-h-[36vh] space-y-1.5 overflow-y-auto">
        {targets.map((pos) =>
          row(pos, formatMoney(ownable(pos).price), pick === pos, () => setPick(pos)),
        )}
      </div>
      <div className="mt-3 text-sm font-semibold">{S.choice.to}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {others.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setTo(o.id)}
            className={cx(
              'rounded-xl border-2 px-3 py-1.5 text-sm font-semibold',
              to === o.id
                ? 'border-son bg-son-50 dark:bg-son-700/30'
                : 'border-transparent bg-black/5 dark:bg-white/5',
            )}
          >
            {o.name}
          </button>
        ))}
      </div>
      <Btn
        big
        className="mt-4 w-full"
        disabled={pick === null || !to}
        onClick={() => {
          if (pick !== null && to) act({ type: 'chooseGift', pos: pick, to });
        }}
      >
        🎁 {S.choice.confirmGift}
      </Btn>
    </Modal>
  );
}

/** Bốc thăm thứ tự xuất phát: mỗi người lật một lá, số 1 đi đầu */
function DrawOrderPrompt() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const now = useNow(250);
  if (!room || !game || game.phase.kind !== 'drawOrder' || !game.lots) return null;
  const n = game.players.length;
  const picks = game.lots.picks;
  const byCard = new Map(
    Object.entries(picks).map(([pid, x]) => [x.card, { pid, number: x.number }]),
  );
  const myPick = me ? picks[me] : undefined;
  const isPlayer = !!me && game.players.some((p) => p.id === me);
  const left = room.deadline ? room.deadline - now : null;
  return (
    <Modal open>
      <div className="text-center text-lg font-bold">{S.draw.title}</div>
      <div className="mb-3 text-center text-sm text-gray-500">
        {!isPlayer ? S.draw.spectate : myPick ? S.draw.yours(myPick.number) : S.draw.hint}
        {left !== null && (
          <span className="ml-2 font-bold tabular-nums text-son">⏱ {fmtClock(left)}</span>
        )}
      </div>
      <div
        className={cx(
          'grid gap-2.5',
          n <= 3 ? 'grid-cols-3' : n === 4 ? 'grid-cols-4' : 'grid-cols-3',
        )}
      >
        {Array.from({ length: n }, (_, k) => {
          const got = byCard.get(k);
          const canPick = isPlayer && !myPick && !got;
          const p = got ? game.players.find((x) => x.id === got.pid) : undefined;
          return (
            <button
              key={k}
              type="button"
              disabled={!canPick}
              onClick={() => act({ type: 'drawLot', card: k })}
              className="aspect-[3/4] [perspective:600px]"
            >
              <motion.div
                className="relative h-full w-full [transform-style:preserve-3d]"
                animate={{ rotateY: got ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 16 }}
              >
                {/* Mặt sau: lá thăm úp */}
                <div
                  className={cx(
                    'absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-4 border-nghe bg-gradient-to-br from-son to-son-700 text-white shadow-card [backface-visibility:hidden]',
                    canPick && 'animate-glow hover:-translate-y-1',
                  )}
                >
                  <span className="text-3xl">🪷</span>
                  <span className="mt-1 text-xs font-extrabold tracking-widest text-nghe">
                    CLB30
                  </span>
                </div>
                {/* Mặt trước: số đã bốc */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-4 bg-white shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)] dark:bg-gray-900"
                  style={{ borderColor: p ? playerColor(room, p.id) : '#ddd' }}
                >
                  <span className="text-4xl font-black text-son dark:text-nghe">{got?.number}</span>
                  {p && (
                    <>
                      <Avatar
                        token={p.token}
                        color={playerColor(room, p.id)}
                        size={28}
                        photo={photoOf(room, p.id)}
                      />
                      <span className="max-w-full truncate px-1 text-xs font-semibold">
                        {p.id === me ? 'Bạn' : p.name}
                      </span>
                    </>
                  )}
                </div>
              </motion.div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-center text-xs text-gray-500">
        {isPlayer && myPick ? S.draw.waiting : S.draw.auto}
      </div>
    </Modal>
  );
}
