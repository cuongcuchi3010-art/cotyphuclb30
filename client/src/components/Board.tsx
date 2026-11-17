import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD,
  DECK_NAMES,
  GROUPS,
  cardById,
  formatMoney,
  type GameEvent,
  type Square as Sq,
} from '@cotyphu/shared';
import { useStore } from '../store';
import { cellOf, centerPct, cx, playerColor, sideOf, useGame } from '../lib';
import { BrandLogo } from './BrandLogo';
import { TokenIcon } from './TokenIcon';
import { CenterInfo } from './CenterInfo';

const SPECIAL_ICON: Partial<Record<Sq['kind'], string>> = {
  chest: '🧧',
  chance: '❓',
  tax: '💸',
  parking: '☕',
  goToJail: '🚦',
  jail: '🚓',
  go: '⬅️',
};

export function Board() {
  return (
    <div
      className="board relative aspect-square w-full select-none rounded-2xl bg-ngoc-50 p-[0.6%] shadow-card dark:bg-[#0f2a27]"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr repeat(9, 1fr) 1.6fr',
        gridTemplateRows: '1.6fr repeat(9, 1fr) 1.6fr',
        gap: '0.3%',
      }}
    >
      {BOARD.map((sq) => (
        <SquareCell key={sq.index} sq={sq} />
      ))}
      <div
        className="relative overflow-hidden rounded-xl"
        style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
      >
        <CenterDecor />
        <CenterInfo />
        <CardReveal />
      </div>
      <Tokens />
    </div>
  );
}

function CenterDecor() {
  // Hoạ tiết trống đồng cách điệu
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07] dark:opacity-[0.12]"
      viewBox="0 0 100 100"
    >
      {[46, 38, 30, 22].map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#C8102E" strokeWidth="1.2" />
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <path
            key={i}
            d={`M50 50 L${50 + Math.cos(a - 0.1) * 14} ${50 + Math.sin(a - 0.1) * 14} L${50 + Math.cos(a) * 20} ${50 + Math.sin(a) * 20} L${50 + Math.cos(a + 0.1) * 14} ${50 + Math.sin(a + 0.1) * 14}Z`}
            fill="#C8102E"
          />
        );
      })}
    </svg>
  );
}

function SquareCell({ sq }: { sq: Sq }) {
  const { room, game } = useGame();
  const open = useStore((s) => s.setOpenSquare);
  const [row, col] = cellOf(sq.index);
  const side = sideOf(sq.index);
  const st = game?.properties[sq.index];
  const ownerColor = st?.owner ? playerColor(room, st.owner) : null;
  const corner = side === 'corner';
  const strip = sq.kind === 'street' ? GROUPS[sq.group].color : null;
  const stripPos: Record<string, string> = {
    bottom: 'top-0 inset-x-0 h-[22%]',
    top: 'bottom-0 inset-x-0 h-[22%]',
    left: 'right-0 inset-y-0 w-[22%]',
    right: 'left-0 inset-y-0 w-[22%]',
  };
  const contentPad: Record<string, string> = {
    bottom: 'pt-[24%]',
    top: 'pb-[24%]',
    left: 'pr-[24%]',
    right: 'pl-[24%]',
    corner: '',
  };
  const price = 'price' in sq ? sq.price : null;
  return (
    <button
      type="button"
      onClick={() => (price !== null ? open(sq.index) : undefined)}
      className={cx(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-[3px] bg-white text-center leading-tight text-gray-800 dark:bg-[#1d1a14] dark:text-gray-100',
        price !== null && 'hover:ring-2 hover:ring-nghe',
        corner && 'bg-nghe-50 dark:bg-[#2a2210]',
        contentPad[side],
      )}
      style={{ gridRow: row, gridColumn: col }}
      title={sq.name}
    >
      {strip && <span className={cx('absolute', stripPos[side])} style={{ background: strip }} />}
      {st?.mortgaged && (
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-gray-500/50 text-[clamp(6px,1.4vmin,11px)] font-bold text-white">
          TC
        </span>
      )}
      <SquareBody sq={sq} />
      {st && st.houses > 0 && <Buildings houses={st.houses} side={side} />}
      {ownerColor ? (
        <span
          className="absolute bottom-[4%] right-[4%] z-[6] h-[clamp(6px,1.5vmin,13px)] w-[clamp(6px,1.5vmin,13px)] rounded-full border border-white shadow"
          style={{ background: ownerColor }}
        />
      ) : (
        price !== null && (
          <span className="text-[clamp(5px,1.1vmin,10px)] font-semibold text-son dark:text-nghe">
            {formatMoney(price)}
          </span>
        )
      )}
    </button>
  );
}

function SquareBody({ sq }: { sq: Sq }) {
  const label = sq.short ?? sq.name;
  const text = 'text-[clamp(5px,1.15vmin,11px)] font-medium px-[2px]';
  if (sq.kind === 'transport' || sq.kind === 'utility') {
    return (
      <>
        <BrandLogo id={sq.logo} name={sq.name} color={sq.brandColor} size={18} />
        <span className={text}>{label}</span>
      </>
    );
  }
  if (sq.kind === 'street') return <span className={cx(text, 'line-clamp-2')}>{label}</span>;
  const corner = sq.index % 10 === 0;
  return (
    <>
      <span className={corner ? 'text-[clamp(10px,3vmin,26px)]' : 'text-[clamp(8px,1.8vmin,16px)]'}>
        {SPECIAL_ICON[sq.kind]}
      </span>
      <span className={cx(text, corner && 'font-bold text-son dark:text-nghe')}>{label}</span>
    </>
  );
}

function Buildings({ houses, side }: { houses: number; side: string }) {
  const pos: Record<string, string> = {
    bottom: 'top-[1%] inset-x-0 justify-center',
    top: 'bottom-[1%] inset-x-0 justify-center',
    left: 'right-[1%] inset-y-0 flex-col justify-center',
    right: 'left-[1%] inset-y-0 flex-col justify-center',
  };
  return (
    <span className={cx('absolute z-[5] flex gap-[1px]', pos[side])}>
      {houses === 5 ? (
        <span className="h-[clamp(5px,1.3vmin,10px)] w-[clamp(9px,2.4vmin,18px)] rounded-[2px] border border-white bg-son" />
      ) : (
        Array.from({ length: houses }, (_, i) => (
          <span
            key={i}
            className="h-[clamp(4px,1vmin,8px)] w-[clamp(4px,1vmin,8px)] rounded-[1px] border border-white bg-ngoc-600"
          />
        ))
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Quân cờ: đi từng ô có animation
// ---------------------------------------------------------------------------

const STEP_S = 0.16;

function buildPath(from: number, events: GameEvent[], pid: string): number[] | null {
  const path: number[] = [from];
  let cur = from;
  let moved = false;
  for (const e of events) {
    if (e.t !== 'move' || e.playerId !== pid) continue;
    moved = true;
    if (e.steps === 0) {
      path.push(e.to);
    } else {
      const dir = e.steps > 0 ? 1 : -1;
      for (let k = 0; k < Math.abs(e.steps); k++) {
        cur = (cur + dir + 40) % 40;
        path.push(cur);
      }
    }
    cur = e.to;
  }
  return moved ? path : null;
}

function Tokens() {
  const { room, game } = useGame();
  const events = useStore((s) => s.events);
  const shown = useRef<Record<string, number>>({});
  const [paths, setPaths] = useState<Record<string, { key: number; path: number[] }>>({});

  useEffect(() => {
    if (!game) return;
    const next: Record<string, { key: number; path: number[] }> = {};
    for (const p of game.players) {
      const prev = shown.current[p.id] ?? p.position;
      const path = buildPath(prev, events.list, p.id);
      if (path && path[path.length - 1] === p.position) next[p.id] = { key: events.id, path };
      else if (prev !== p.position) next[p.id] = { key: events.id, path: [p.position] };
      shown.current[p.id] = p.position;
    }
    if (Object.keys(next).length) setPaths((old) => ({ ...old, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.id, game?.seq]);

  const stacks = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const p of game?.players ?? []) {
      if (p.bankrupt) continue;
      m.set(p.position, [...(m.get(p.position) ?? []), p.id]);
    }
    return m;
  }, [game]);

  if (!game) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {game.players.map((p) => {
        if (p.bankrupt) return null;
        const st = stacks.get(p.position) ?? [p.id];
        const k = st.indexOf(p.id);
        const n = st.length;
        const ox = n > 1 ? (k - (n - 1) / 2) * 1.6 : 0;
        const oy = n > 1 ? (k % 2 === 0 ? -0.8 : 0.8) : 0;
        const anim = paths[p.id] ?? { key: 0, path: [p.position] };
        const xs = anim.path.map((i) => `${centerPct(i).x + ox}%`);
        const ys = anim.path.map((i) => `${centerPct(i).y + oy + (p.inJail ? -1.5 : 0)}%`);
        const color = playerColor(room, p.id);
        const isCur = game.players[game.current]?.id === p.id;
        return (
          <motion.div
            key={`${p.id}-${anim.key}`}
            className="absolute"
            initial={{ left: xs[0], top: ys[0] }}
            animate={{ left: xs, top: ys }}
            transition={{ duration: Math.max(0.2, (xs.length - 1) * STEP_S), ease: 'linear' }}
            style={{ translateX: '-50%', translateY: '-50%' }}
          >
            <div
              className={cx(
                'flex items-center justify-center rounded-full border-2 bg-white/95 p-[2px] shadow-md dark:bg-gray-900/95',
                isCur && 'animate-pulse-soft',
              )}
              style={{
                borderColor: color,
                width: 'clamp(16px, 4.6vmin, 38px)',
                height: 'clamp(16px, 4.6vmin, 38px)',
              }}
            >
              <TokenIcon token={p.token} size={30} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thẻ bài lật khi rút
// ---------------------------------------------------------------------------

function CardReveal() {
  const events = useStore((s) => s.events);
  const { room } = useGame();
  const [card, setCard] = useState<{
    id: string;
    deck: 'chance' | 'chest';
    who: string;
    key: number;
  } | null>(null);

  useEffect(() => {
    const ev = events.list.find((e) => e.t === 'card');
    if (ev && ev.t === 'card') {
      setCard({ id: ev.cardId, deck: ev.deck, who: ev.playerId, key: events.id });
      const t = setTimeout(() => setCard(null), 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [events.id, events.list]);

  return (
    <AnimatePresence>
      {card && (
        <motion.button
          type="button"
          key={card.key}
          onClick={() => setCard(null)}
          className="absolute inset-0 z-30 flex items-center justify-center p-[8%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={cx(
              'w-full max-w-[280px] rounded-2xl border-4 p-4 text-center shadow-card',
              card.deck === 'chance'
                ? 'border-nghe bg-nghe-50 dark:bg-[#2a2210]'
                : 'border-son bg-son-50 dark:bg-[#2a1014]',
            )}
            initial={{ rotateY: 180, scale: 0.6 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.6 }}
          >
            <div className="text-2xl">{card.deck === 'chance' ? '❓' : '🧧'}</div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-son dark:text-nghe">
              {DECK_NAMES[card.deck]} · {room?.players.find((p) => p.id === card.who)?.name}
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {cardById(card.id).text}
            </div>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
