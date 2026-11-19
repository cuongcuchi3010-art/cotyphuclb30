import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CASINO_NAMES,
  casinoBetLimit,
  casinoHouseTurn,
  casinoStakeTargets,
  formatMoney,
  ownable,
  type GameEvent,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, fmtClock, nameOf, playerColor, photoOf, squareName, useGame, useNow } from '../lib';
import { Btn, Modal } from './ui';
import { Avatar } from './Avatar';
import { Die } from './CenterInfo';

/** Bàn cược Sòng Bạc (Freestyle): hiện cho cả phòng khi có người dừng ở ô Sòng Bạc */
export function CasinoPrompt() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const now = useNow(250);
  const [custom, setCustom] = useState('');
  const [mini, setMini] = useState(false);
  const k = game?.casino;
  useEffect(() => {
    setMini(false);
    setCustom('');
  }, [k?.opener, k?.pos, k?.stage, k?.round]);
  if (!room || !game || game.phase.kind !== 'casino' || !k) return null;
  const left = room.deadline ? Math.max(0, room.deadline - now) : 0;
  const total = k.stage === 'roll' ? 10_000 : k.kind === 'land' ? 25_000 : 20_000;
  const title = CASINO_NAMES[k.kind];
  const canJoin = !!me && k.eligible.includes(me);
  const decided = !!me && (me in k.bets || k.passed.includes(me));
  const limit = me && k.kind === 'cash' ? casinoBetLimit(game, me) : 0;
  const myTargets = me && k.kind === 'land' ? casinoStakeTargets(game, me) : [];
  const mustRoll = !!me && k.stage === 'roll' && k.rollers.includes(me) && !k.rolls[me];

  if (mini) {
    return (
      <button
        type="button"
        onClick={() => setMini(false)}
        className="fixed left-1/2 top-2 z-40 -translate-x-1/2 rounded-full bg-[#2a0f3a] px-4 py-2 font-semibold text-nghe shadow-card"
      >
        🎰 {title} · {fmtClock(left)}
      </button>
    );
  }

  // Ghế quanh bàn: sòng tiền có nhà cái ngồi đầu bàn; sòng đất ai cũng ngang nhau
  const ids = k.kind === 'cash' ? [k.opener, ...k.eligible] : k.eligible;
  const seats: Seat[] = ids.map((id) => {
    const isHouse = k.kind === 'cash' && id === k.opener;
    const passed = k.passed.includes(id);
    const bet = k.bets[id];
    const chip = isHouse
      ? S.casino.house
      : bet !== undefined
        ? k.kind === 'cash'
          ? formatMoney(bet)
          : squareName(game, bet, true)
        : passed
          ? S.casino.passed
          : k.stage === 'bet'
            ? S.casino.thinking
            : null;
    const inRound = k.stage === 'roll' && k.rollers.includes(id);
    return {
      id,
      isHouse,
      chip,
      chipMuted: passed || (bet === undefined && !isHouse),
      dice: k.stage === 'roll' ? (k.rolls[id] ?? null) : null,
      waiting: inRound && !k.rolls[id],
      out: (k.stage === 'roll' && !inRound) || passed,
      me: id === me,
    };
  });
  const houseWaits =
    k.kind === 'cash' && me === k.opener && k.stage === 'roll' && !casinoHouseTurn(k);

  return (
    <Modal open onClose={() => setMini(true)}>
      <div className="mb-2 text-center text-sm text-gray-600 dark:text-gray-300">
        {k.kind === 'cash'
          ? S.casino.cashIntro(nameOf(room, k.opener), formatMoney(k.cap))
          : S.casino.landIntro(nameOf(room, k.opener))}
      </div>
      <CasinoTable
        title={title}
        seats={seats}
        center={
          <>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-nghe/90">
              {k.stage === 'bet'
                ? S.casino.betting
                : k.round > 1
                  ? S.casino.reroll
                  : S.casino.rolling}
            </div>
            <div
              className={cx(
                'text-3xl font-black tabular-nums',
                left < 4000 ? 'text-nghe' : 'text-white',
              )}
            >
              {Math.ceil(left / 1000)}
            </div>
            <div className="mx-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-nghe transition-all"
                style={{ width: `${Math.min(100, (left / total) * 100)}%` }}
              />
            </div>
          </>
        }
      />
      {k.stage === 'bet' ? (
        <>
          {canJoin && (
            <div className="mt-3 rounded-2xl bg-white/80 p-3 dark:bg-white/5">
              {k.kind === 'cash' ? (
                <>
                  <div className="mb-2 text-sm font-semibold">
                    {S.casino.yourBet}{' '}
                    <span className="text-xs font-normal text-gray-500">
                      ({S.casino.max} {formatMoney(limit)})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[50, 100, 200, 500, 1000]
                      .filter((v) => v <= limit)
                      .map((v) => (
                        <Btn
                          key={v}
                          variant={k.bets[me!] === v ? 'primary' : 'ghost'}
                          onClick={() => act({ type: 'casinoBet', amount: v })}
                        >
                          {formatMoney(v)}
                        </Btn>
                      ))}
                    <Btn
                      variant={k.bets[me!] === limit ? 'primary' : 'ghost'}
                      onClick={() => act({ type: 'casinoBet', amount: limit })}
                    >
                      {S.casino.allIn} ({formatMoney(limit)})
                    </Btn>
                  </div>
                  <form
                    className="mt-2 flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = parseInt(custom.replace(/\D/g, '') || '0', 10);
                      if (v >= 10 && v <= limit) act({ type: 'casinoBet', amount: v });
                    }}
                  >
                    <input
                      inputMode="numeric"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder={S.casino.customPh}
                      className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
                    />
                    <Btn type="submit" variant="secondary">
                      {S.casino.place}
                    </Btn>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-2 text-sm font-semibold">{S.casino.pickLand}</div>
                  <div className="max-h-[30vh] space-y-1 overflow-y-auto">
                    {myTargets.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => act({ type: 'casinoStake', pos })}
                        className={cx(
                          'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm',
                          k.bets[me!] === pos
                            ? 'bg-son text-white'
                            : 'bg-black/5 hover:bg-black/10 dark:bg-white/5',
                        )}
                      >
                        <span className="font-semibold">{squareName(game, pos)}</span>
                        <span className="text-xs opacity-80">
                          {houseLabel(game.properties[pos]?.houses ?? 0)}
                          {formatMoney(ownable(pos).price)}
                          {game.properties[pos]?.mortgaged ? ` · ${S.casino.mortgaged}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <Btn
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => act({ type: 'casinoPass' })}
              >
                {S.casino.pass}
              </Btn>
              {decided && (
                <div className="mt-1 text-center text-xs text-gray-500">{S.casino.canChange}</div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {k.round > 1 && (
            <div className="mt-2 text-center text-sm font-semibold text-son">{S.casino.tie}</div>
          )}
          {k.kind === 'cash' && (
            <div className="mt-2 text-center text-xs text-gray-500">{S.casino.houseLast}</div>
          )}
          {mustRoll && !houseWaits && (
            <Btn
              big
              className="mt-3 w-full animate-glow"
              onClick={() => act({ type: 'casinoRoll' })}
            >
              🎲 {S.casino.roll}
            </Btn>
          )}
          {houseWaits && (
            <Btn big className="mt-3 w-full" variant="ghost" disabled>
              ⏳ {S.casino.houseWait}
            </Btn>
          )}
        </>
      )}
      <p className="mt-3 text-center text-[11px] text-gray-500">{S.casino.virtual}</p>
    </Modal>
  );
}

type ResultEv = Extract<GameEvent, { t: 'casinoResult' }>;

/** Kết quả bàn cược: hiện vài giây cho cả phòng */
export function CasinoResult() {
  const { room, game } = useGame();
  const events = useStore((s) => s.events);
  const me = useStore((s) => s.me);
  const [res, setRes] = useState<{ ev: ResultEv; key: number } | null>(null);
  useEffect(() => {
    const ev = events.list.find((e): e is ResultEv => e.t === 'casinoResult');
    if (ev) {
      setRes({ ev, key: events.id });
      const t = setTimeout(() => setRes(null), 7000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [events.id, events.list]);
  if (!room || !game) return null;
  const ev = res?.ev;
  let seats: Seat[] = [];
  let headline = '';
  if (ev?.kind === 'cash') {
    const net = ev.results.reduce(
      (a, r) => a + (r.outcome === 'lose' ? r.bet : r.outcome === 'win' ? -r.bet : 0),
      0,
    );
    seats = [
      {
        id: ev.opener,
        isHouse: true,
        chip: null,
        dice: ev.openerDice,
        outcome: net > 0 ? 'win' : net < 0 ? 'lose' : 'push',
        outcomeText:
          net > 0 ? `+${formatMoney(net)}` : net < 0 ? `−${formatMoney(-net)}` : S.casino.push,
        me: ev.opener === me,
      },
      ...ev.results.map((r): Seat => ({
        id: r.playerId,
        isHouse: false,
        chip: null,
        dice: r.dice,
        outcome: r.outcome,
        outcomeText:
          r.outcome === 'win'
            ? `+${formatMoney(r.bet)}`
            : r.outcome === 'lose'
              ? `−${formatMoney(r.bet)}`
              : S.casino.push,
        me: r.playerId === me,
      })),
    ];
    headline = S.casino.houseRolled(nameOf(room, ev.opener), ev.openerDice[0] + ev.openerDice[1]);
  } else if (ev) {
    const ids = ev.players?.length ? ev.players : [ev.winner, ...ev.won.map((w) => w.from)];
    seats = ids.map((id) => ({
      id,
      isHouse: false,
      chip: null,
      dice: ev.rolls?.[id] ?? (id === ev.winner ? ev.dice : null),
      outcome: id === ev.winner ? 'winner' : 'lose',
      outcomeText: id === ev.winner ? `🏆 ${S.casino.winner}` : undefined,
      out: id !== ev.winner && !ev.rolls?.[id],
      me: id === me,
    }));
    headline = `${nameOf(room, ev.winner)}${ev.winner === me ? ` (${S.casino.you})` : ''}: ${S.casino.rolled(ev.dice[0] + ev.dice[1])}`;
  }
  return (
    <AnimatePresence>
      {ev && res && (
        <motion.button
          type="button"
          key={res.key}
          onClick={() => setRes(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl bg-giay p-4 text-left shadow-card dark:bg-giay-dark"
          >
            <CasinoTable
              title={CASINO_NAMES[ev.kind]}
              seats={seats}
              center={
                <div className="text-lg font-black uppercase tracking-widest text-white">
                  {S.casino.result}
                </div>
              }
            />
            <div className="mt-1 text-center text-sm font-semibold">{headline}</div>
            {ev.kind === 'land' && ev.won.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {ev.won.map((w) => (
                  <span
                    key={w.pos}
                    className="rounded-lg bg-son-50 px-2 py-1 text-sm font-semibold text-son-700 dark:bg-son/20 dark:text-son-100"
                  >
                    {squareName(game, w.pos)}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

interface Seat {
  id: string;
  isHouse: boolean;
  chip: ReactNode;
  chipMuted?: boolean;
  dice: [number, number] | null;
  waiting?: boolean;
  out?: boolean;
  me?: boolean;
  outcome?: 'win' | 'lose' | 'push' | 'winner';
  outcomeText?: string;
}

/** Vị trí ghế quanh bàn bầu dục (%). Nhà cái ngồi đầu bàn, người chơi ngồi vòng phía dưới */
function seatPos(i: number, n: number, house: boolean): { x: number; y: number } {
  let deg: number;
  if (house) {
    if (i === 0) deg = -90;
    else {
      // người chơi ngồi vòng phía dưới, đối diện nhà cái
      const m = n - 1;
      const span = Math.min(160, 50 * (m - 1));
      deg = m === 1 ? 90 : 90 + span / 2 - (span * (i - 1)) / (m - 1);
    }
  } else {
    deg = -90 + (360 * i) / n + (n === 2 ? 90 : 0);
  }
  const r = (deg * Math.PI) / 180;
  return { x: 50 + 42 * Math.cos(r), y: 48 + 36 * Math.sin(r) };
}

/** Bàn nỉ đỏ có người chơi ngồi quanh; ai đổ thì hiện xí ngầu cạnh người đó */
export function CasinoTable({
  title,
  seats,
  center,
}: {
  title: string;
  seats: Seat[];
  center: ReactNode;
}) {
  const { room } = useGame();
  const hasHouse = seats.some((s) => s.isHouse);
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[420px] select-none">
      {/* Mặt bàn */}
      <div
        className="absolute inset-x-[9%] inset-y-[13%] rounded-[50%] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.5)]"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #D3203F 0%, #A50D26 55%, #6E0716 100%)',
          border: '6px solid #7A4A12',
          boxShadow: 'inset 0 0 0 3px #F2A900, inset 0 0 40px rgba(0,0,0,0.35)',
        }}
      >
        <div className="absolute inset-[9%] rounded-[50%] border border-dashed border-nghe/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
          <div className="mb-0.5 text-xs font-black uppercase tracking-[0.18em] text-nghe">
            🎰 {title}
          </div>
          {center}
        </div>
      </div>
      {/* Ghế */}
      {seats.map((s, i) => {
        const pos = seatPos(i, seats.length, hasHouse);
        const p = room?.players.find((x) => x.id === s.id);
        return (
          <div
            key={s.id}
            className={cx(
              'absolute flex w-[92px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition-opacity',
              s.out && 'opacity-45',
            )}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div
              className={cx(
                'relative rounded-full',
                s.waiting && 'animate-pulse',
                s.outcome === 'win' || s.outcome === 'winner'
                  ? 'ring-4 ring-ngoc'
                  : s.outcome === 'lose'
                    ? 'ring-4 ring-gray-400'
                    : s.isHouse
                      ? 'ring-4 ring-nghe'
                      : s.me
                        ? 'ring-2 ring-white'
                        : '',
              )}
            >
              {p && (
                <Avatar
                  token={p.token}
                  color={playerColor(room, s.id)}
                  size={44}
                  photo={photoOf(room, s.id)}
                />
              )}
              {s.isHouse && (
                <span className="absolute -right-1 -top-2 text-base drop-shadow" aria-hidden>
                  👑
                </span>
              )}
              {/* Xí ngầu của người này */}
              <AnimatePresence>
                {s.dice && (
                  <motion.div
                    key={`${s.dice[0]}-${s.dice[1]}`}
                    initial={{ scale: 0.2, rotate: -200, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                    className="absolute left-1/2 top-[-36px] flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-black/70 px-1 py-0.5"
                  >
                    <span className="w-6">
                      <Die value={s.dice[0]} />
                    </span>
                    <span className="w-6">
                      <Die value={s.dice[1]} />
                    </span>
                    <b className="ml-0.5 text-base tabular-nums text-nghe">
                      {s.dice[0] + s.dice[1]}
                    </b>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="max-w-full truncate rounded bg-black/55 px-1.5 text-[11px] font-semibold leading-4 text-white">
              {nameOf(room, s.id)}
            </div>
            {s.outcomeText ? (
              <div
                className={cx(
                  'rounded-full px-2 text-[11px] font-black leading-4',
                  s.outcome === 'win' || s.outcome === 'winner'
                    ? 'bg-ngoc text-white'
                    : s.outcome === 'lose'
                      ? 'bg-gray-700 text-white'
                      : 'bg-white text-gray-700',
                )}
              >
                {s.outcomeText}
              </div>
            ) : s.chip ? (
              <div
                className={cx(
                  'max-w-full truncate rounded-full px-2 text-[11px] font-bold leading-4',
                  s.isHouse
                    ? 'bg-nghe text-son-700'
                    : s.chipMuted
                      ? 'bg-white/80 text-gray-500'
                      : 'border border-nghe bg-[#3B0F4F] text-nghe',
                )}
              >
                {s.chip}
              </div>
            ) : s.waiting ? (
              <div className="rounded-full bg-white/80 px-2 text-[11px] leading-4 text-gray-500">
                {S.casino.waitingRoll}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Nhãn số nhà trên ô (đặt ở Sòng Bạc Đất thì nhà đi kèm) */
function houseLabel(h: number): string {
  if (h >= 5) return '🏨 khách sạn · ';
  if (h > 0) return `🏠 ${h} nhà · `;
  return '';
}
