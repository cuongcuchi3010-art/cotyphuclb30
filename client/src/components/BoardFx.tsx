import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatMoney, type GameEvent } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { centerPct, cx, squareName, useGame } from '../lib';

/** Kết quả lần tung vừa rồi: tổng điểm và ô sẽ tới */
interface RollInfo {
  key: number;
  dice: [number, number];
  to: number | null;
  stay: boolean;
}

function rollInfo(list: GameEvent[], key: number): RollInfo | null {
  const roll = list.find(
    (e): e is Extract<GameEvent, { t: 'roll' }> => e.t === 'roll' && e.purpose !== 'utility',
  );
  if (!roll) return null;
  const move = list.find(
    (e): e is Extract<GameEvent, { t: 'move' }> =>
      e.t === 'move' && e.playerId === roll.playerId && e.steps > 0,
  );
  return {
    key,
    dice: roll.dice,
    to: move ? move.to : null,
    stay: roll.purpose === 'jail' && !roll.doubles,
  };
}

export function useRollInfo(ms: number): RollInfo | null {
  const events = useStore((s) => s.events);
  const [info, setInfo] = useState<RollInfo | null>(null);
  useEffect(() => {
    const r = rollInfo(events.list, events.id);
    if (!r) return undefined;
    setInfo(r);
    const t = setTimeout(() => setInfo(null), ms);
    return () => clearTimeout(t);
  }, [events.id, events.list, ms]);
  return info;
}

/** Bong bóng "5 + 6 = 11 → 📍 Tên ô" giữa bàn (đặt trong vùng giữa, đứng thẳng) */
export function RollBubble() {
  const { game } = useGame();
  const info = useRollInfo(2800);
  return (
    <AnimatePresence>
      {info && game && (
        <motion.div
          key={info.key}
          initial={{ opacity: 0, scale: 0.6, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="pointer-events-none absolute left-1/2 top-[2%] z-30 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-[#1f2937]/85 px-[2cqw] py-[1cqw] text-center text-white shadow-card"
        >
          <div className="font-black tabular-nums" style={{ fontSize: '3.4cqw' }}>
            {info.dice[0]} + {info.dice[1]} = {info.dice[0] + info.dice[1]}
          </div>
          <div className="font-bold text-nghe" style={{ fontSize: '1.9cqw' }}>
            {info.stay
              ? S.fx.stayJail
              : info.to !== null
                ? `→ 📍 ${squareName(game, info.to, true)}`
                : ''}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Ô đích sáng viền + nhãn tên ô; tiền +/− bay lên trên ô (đặt trong lưới bàn cờ) */
/** Các khoản tiền +/− vừa phát sinh, gộp theo ô; mỗi khoản tự biến mất sau 2,6 giây */
export function useMoneyFx(): { key: string; pos: number; amount: number }[] {
  const { game } = useGame();
  const events = useStore((s) => s.events);
  const [money, setMoney] = useState<{ key: string; pos: number; amount: number }[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!game) return undefined;
    // Gộp các khoản cùng ô trong một lượt cập nhật
    const sums = new Map<number, number>();
    const add = (pos: number, v: number) => sums.set(pos, (sums.get(pos) ?? 0) + v);
    const posOf = (id: string) => game.players.find((p) => p.id === id)?.position ?? 0;
    for (const e of events.list) {
      if (e.t === 'pay' && e.pos !== undefined && e.reason !== 'casino') add(e.pos, -e.amount);
      else if (e.t === 'passGo') add(0, e.amount);
      else if (e.t === 'buy') add(e.pos, -e.price);
      else if (e.t === 'build') add(e.pos, -e.cost);
      else if (e.t === 'sell') add(e.pos, e.refund);
      else if (e.t === 'collect') add(posOf(e.playerId), e.amount);
    }
    if (sums.size === 0) return undefined;
    const items = [...sums]
      .filter(([, v]) => v !== 0)
      .map(([pos, amount]) => ({ key: `${events.id}-${pos}`, pos, amount }));
    setMoney((m) => [...m, ...items]);
    timers.current.push(
      setTimeout(() => setMoney((m) => m.filter((x) => !items.some((i) => i.key === x.key))), 2600),
    );
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.id]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return money;
}

export function BoardFx() {
  const { game } = useGame();
  const info = useRollInfo(3200);
  const money = useMoneyFx();

  if (!game) return null;
  const target = info && !info.stay && info.to !== null ? info.to : null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[25]">
      <AnimatePresence>
        {target !== null && (
          <motion.div
            key={`t-${info!.key}`}
            className="absolute"
            style={{ left: `${centerPct(target).x}%`, top: `${centerPct(target).y}%` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="absolute left-1/2 top-1/2 block h-[6.5cqw] w-[6.5cqw] -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-[0.5cqw] border-nghe" />
            <span className="absolute left-1/2 top-1/2 block h-[6.5cqw] w-[6.5cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.4cqw] border-nghe shadow-[0_0_2cqw_#F2A900]" />
            <span
              className="upright absolute left-1/2 top-[-5.5cqw] -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-[1cqw] py-[0.3cqw] font-bold text-son shadow"
              style={{ fontSize: '1.5cqw' }}
            >
              📍 {squareName(game, target, true)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {money.map((m) => (
          <motion.div
            key={m.key}
            className="absolute"
            style={{ left: `${centerPct(m.pos).x}%`, top: `${centerPct(m.pos).y}%` }}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: '-4cqw' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span
              className={cx(
                'upright block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg px-[0.8cqw] py-[0.2cqw] font-black text-white shadow-md',
                m.amount > 0 ? 'bg-ngoc' : 'bg-son',
              )}
              style={{ fontSize: '1.8cqw' }}
            >
              {m.amount > 0 ? '+' : '−'}
              {formatMoney(Math.abs(m.amount))}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Dòng sự kiện gần nhất ở góc trên bàn cờ; bấm để xem thêm, ✕ để ẩn */
export function EventTicker({ diamond }: { diamond?: boolean }) {
  const { room } = useGame();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const log = room?.log ?? [];
  const lastId = log[log.length - 1]?.id ?? 0;
  useEffect(() => {
    setHidden(false);
  }, [lastId]);
  if (!room || log.length === 0 || hidden) return null;
  // Bỏ các dòng mốc lượt "— Lượt N —" để dòng chính có nội dung
  const lines = log.filter((l) => !l.text.startsWith('—')).slice(-6);
  if (lines.length === 0) return null;
  const head = lines.slice(-2).map((l) => l.text);
  const more = lines.length - 2;
  return (
    <div
      className={cx(
        'pointer-events-auto absolute left-[1%] z-40',
        // Bàn thoi: nằm dưới thẻ người chơi góc trên trái, trong khoảng trống ngoài bàn
        diamond ? 'top-[13%] max-w-[34%]' : 'top-[1%] max-w-[55%]',
      )}
    >
      <div className="flex items-start gap-1 rounded-2xl bg-white/90 px-2 py-1 text-[11px] leading-snug shadow-card backdrop-blur dark:bg-black/70 sm:text-xs">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          {open ? (
            <span className="block space-y-0.5">
              {lines.map((l) => (
                <span key={l.id} className="block">
                  {l.text}
                </span>
              ))}
            </span>
          ) : (
            <span className="line-clamp-2">
              🔔 {head.join(' · ')}
              {more > 0 && (
                <span className="ml-1 rounded-full bg-gray-800 px-1.5 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">
                  +{more}
                </span>
              )}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label={S.fx.hideTicker}
          onClick={() => setHidden(true)}
          className="shrink-0 px-1 text-gray-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
