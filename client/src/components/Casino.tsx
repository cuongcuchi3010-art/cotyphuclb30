import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CASINO_NAMES,
  casinoBetLimit,
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

  const person = (id: string, right: React.ReactNode, highlight?: boolean) => {
    const p = game.players.find((x) => x.id === id);
    return (
      <div
        key={id}
        className={cx(
          'flex items-center gap-2 rounded-xl px-2.5 py-1.5',
          highlight ? 'bg-nghe-50 ring-2 ring-nghe dark:bg-nghe/15' : 'bg-black/5 dark:bg-white/5',
        )}
      >
        {p && (
          <Avatar
            token={p.token}
            color={playerColor(room, id)}
            size={28}
            photo={photoOf(room, id)}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nameOf(room, id)}</span>
        <span className="shrink-0 text-sm">{right}</span>
      </div>
    );
  };

  const dice = (id: string) => {
    const d = k.rolls[id];
    if (!d) return <span className="text-xs text-gray-500">{S.casino.waitingRoll}</span>;
    return (
      <span className="flex items-center gap-1">
        <span className="w-6">
          <Die value={d[0]} />
        </span>
        <span className="w-6">
          <Die value={d[1]} />
        </span>
        <b className="ml-1 tabular-nums">{d[0] + d[1]}</b>
      </span>
    );
  };

  return (
    <Modal open onClose={() => setMini(true)}>
      <div className="text-center">
        <div className="text-sm font-bold uppercase tracking-wider text-son dark:text-nghe">
          🎰 {title}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {k.kind === 'cash'
            ? S.casino.cashIntro(nameOf(room, k.opener), formatMoney(k.cap))
            : S.casino.landIntro(nameOf(room, k.opener))}
        </div>
        <div className="mx-auto my-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className={cx('h-full transition-all', left < 4000 ? 'bg-son' : 'bg-ngoc')}
            style={{ width: `${Math.min(100, (left / total) * 100)}%` }}
          />
        </div>
      </div>

      {k.stage === 'bet' ? (
        <>
          <div className="space-y-1.5">
            {k.kind === 'cash' &&
              person(k.opener, <span className="text-xs font-bold">{S.casino.house}</span>, true)}
            {k.eligible.map((id) =>
              person(
                id,
                id in k.bets ? (
                  <b className="text-son dark:text-nghe">
                    {k.kind === 'cash' ? formatMoney(k.bets[id]!) : squareName(game, k.bets[id]!)}
                  </b>
                ) : k.passed.includes(id) ? (
                  <span className="text-xs text-gray-500">{S.casino.passed}</span>
                ) : (
                  <span className="text-xs text-gray-500">{S.casino.thinking}</span>
                ),
              ),
            )}
          </div>
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
          <div className="space-y-1.5">
            {k.rollers.map((id) => person(id, dice(id), k.kind === 'cash' && id === k.opener))}
          </div>
          {k.round > 1 && (
            <div className="mt-2 text-center text-sm font-semibold text-son">{S.casino.tie}</div>
          )}
          {mustRoll && (
            <Btn
              big
              className="mt-3 w-full animate-glow"
              onClick={() => act({ type: 'casinoRoll' })}
            >
              🎲 {S.casino.roll}
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
  return (
    <AnimatePresence>
      {ev && (
        <motion.button
          type="button"
          key={res.key}
          onClick={() => setRes(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.7, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-3xl bg-giay p-5 text-left shadow-card dark:bg-giay-dark"
          >
            <div className="text-center text-sm font-bold uppercase tracking-wider text-son dark:text-nghe">
              🎰 {CASINO_NAMES[ev.kind]} · {S.casino.result}
            </div>
            {ev.kind === 'cash' ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between rounded-xl bg-nghe-50 px-3 py-2 dark:bg-nghe/15">
                  <span className="font-semibold">
                    {nameOf(room, ev.opener)} ({S.casino.house})
                  </span>
                  <b className="tabular-nums">{ev.openerDice[0] + ev.openerDice[1]}</b>
                </div>
                {ev.results.map((r) => (
                  <div
                    key={r.playerId}
                    className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{nameOf(room, r.playerId)}</span>{' '}
                      <span className="text-xs text-gray-500">
                        {r.dice[0] + r.dice[1]} {S.casino.points}
                      </span>
                    </span>
                    <b
                      className={cx(
                        'shrink-0 tabular-nums',
                        r.outcome === 'win'
                          ? 'text-ngoc-600'
                          : r.outcome === 'lose'
                            ? 'text-son'
                            : 'text-gray-500',
                      )}
                    >
                      {r.outcome === 'win'
                        ? `+${formatMoney(r.bet)}`
                        : r.outcome === 'lose'
                          ? `−${formatMoney(r.bet)}`
                          : S.casino.push}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-center">
                <div className="text-2xl font-extrabold">
                  🏆 {nameOf(room, ev.winner)}
                  {ev.winner === me ? ` (${S.casino.you})` : ''}
                </div>
                <div className="text-sm text-gray-500">
                  {S.casino.rolled(ev.dice[0] + ev.dice[1])}
                </div>
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
              </div>
            )}
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
