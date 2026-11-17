import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD,
  DECK_NAMES,
  GROUPS,
  cardById,
  UTILITY_INDICES,
  formatMoney,
  rentFor,
  type GameEvent,
  type GameState,
  type Square as Sq,
} from '@cotyphu/shared';
import { useStore } from '../store';
import { cellOf, centerPct, cx, playerColor, sideOf, useGame } from '../lib';
import { BrandLogo } from './BrandLogo';
import { Avatar } from './Avatar';
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
      className="board relative aspect-square w-full select-none rounded-2xl bg-gradient-to-br from-ngoc-100 via-nghe-50 to-son-50 p-[0.6%] shadow-card [container-type:inline-size] dark:from-[#0f2a27] dark:via-[#1c1a12] dark:to-[#2a1014]"
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

/** Màu nền / dải màu cho từng loại ô */
function squareTheme(sq: Sq): { band: string; tint: string } {
  if (sq.kind === 'street') {
    const c = GROUPS[sq.group].color;
    return { band: c, tint: c };
  }
  if (sq.kind === 'transport' || sq.kind === 'utility')
    return { band: sq.brandColor, tint: sq.brandColor };
  if (sq.kind === 'chance') return { band: '#F2A900', tint: '#F2A900' };
  if (sq.kind === 'chest') return { band: '#C8102E', tint: '#C8102E' };
  if (sq.kind === 'tax') return { band: '#6B7280', tint: '#6B7280' };
  return { band: '#0E9F8E', tint: '#F2A900' };
}

/** Tiền thuê hiện tại hiển thị trên ô đã có chủ */
function rentLabel(game: GameState, pos: number): string {
  const sq = BOARD[pos]!;
  const st = game.properties[pos]!;
  if (st.mortgaged) return 'Thế chấp';
  if (sq.kind === 'utility') {
    const n = UTILITY_INDICES.filter((i) => game.properties[i]!.owner === st.owner).length;
    return `×${n === 2 ? 10 : 4} xúc xắc`;
  }
  return formatMoney(rentFor(game, pos, { diceTotal: 7 }));
}

const BAND: Record<string, string> = {
  bottom: 'top-0 inset-x-0 h-[20%]',
  top: 'bottom-0 inset-x-0 h-[20%]',
  left: 'right-0 inset-y-0 w-[20%]',
  right: 'left-0 inset-y-0 w-[20%]',
};
const PAD: Record<string, string> = {
  bottom: 'pt-[22%] pb-[3%] flex-col',
  top: 'pb-[22%] pt-[3%] flex-col',
  left: 'pr-[22%] pl-[4%] flex-row',
  right: 'pl-[22%] pr-[4%] flex-row',
  corner: 'flex-col',
};
const BAND_GRADIENT: Record<string, string> = {
  bottom: 'to bottom',
  top: 'to top',
  left: 'to left',
  right: 'to right',
  corner: 'to bottom',
};

function SquareCell({ sq }: { sq: Sq }) {
  const { room, game } = useGame();
  const open = useStore((s) => s.setOpenSquare);
  const [row, col] = cellOf(sq.index);
  const side = sideOf(sq.index);
  const st = game?.properties[sq.index];
  const ownerColor = st?.owner ? playerColor(room, st.owner) : null;
  const corner = side === 'corner';
  const theme = squareTheme(sq);
  const price = 'price' in sq ? sq.price : null;
  const isBrand = sq.kind === 'transport' || sq.kind === 'utility';
  return (
    <button
      type="button"
      onClick={() => (price !== null ? open(sq.index) : undefined)}
      className={cx(
        'relative flex items-center justify-center gap-[3%] overflow-hidden rounded-[4px] text-center leading-[1.15] text-gray-900 shadow-sm dark:text-gray-50',
        price !== null && 'hover:z-10 hover:ring-2 hover:ring-nghe',
        PAD[side],
      )}
      style={{
        gridRow: row,
        gridColumn: col,
        background: corner
          ? `radial-gradient(circle at 50% 40%, ${theme.tint}33, transparent 70%), var(--sq-bg)`
          : `linear-gradient(${BAND_GRADIENT[side]}, ${theme.tint}38, ${theme.tint}10 70%), var(--sq-bg)`,
        boxShadow: ownerColor ? `inset 0 0 0 2px ${ownerColor}` : undefined,
      }}
      title={sq.name}
    >
      {!corner && (sq.kind === 'street' || isBrand) && (
        <span className={cx('absolute', BAND[side])} style={{ background: theme.band }} />
      )}
      {/* Biểu tượng cảnh quan / thương hiệu */}
      <span className="shrink-0 leading-none" style={{ fontSize: corner ? '4.2cqw' : '2.3cqw' }}>
        {sq.kind === 'street' ? (
          sq.icon
        ) : isBrand ? (
          <BrandLogo id={sq.logo} name={sq.name} color={sq.brandColor} size="2.4cqw" />
        ) : (
          SPECIAL_ICON[sq.kind]
        )}
      </span>
      <span
        className={cx(
          'flex min-w-0 flex-col items-center',
          side === 'left' || side === 'right' ? 'items-start text-left' : '',
        )}
      >
        <span
          className={cx('line-clamp-2 font-bold', corner && 'text-son dark:text-nghe')}
          style={{ fontSize: corner ? '1.6cqw' : '1.32cqw' }}
        >
          {sq.short ?? sq.name}
        </span>
        {st && ownerColor ? (
          <span
            className="mt-[2px] whitespace-nowrap rounded-full px-[0.5cqw] font-extrabold text-white"
            style={{ background: st.mortgaged ? '#6B7280' : ownerColor, fontSize: '1.22cqw' }}
          >
            {rentLabel(game!, sq.index)}
          </span>
        ) : price !== null ? (
          <span className="font-semibold text-son dark:text-nghe" style={{ fontSize: '1.22cqw' }}>
            {formatMoney(price)}
          </span>
        ) : sq.kind === 'tax' ? (
          <span
            className="font-semibold text-gray-600 dark:text-gray-300"
            style={{ fontSize: '1.12cqw' }}
          >
            {formatMoney(sq.amount)}
          </span>
        ) : null}
      </span>
      {st && st.houses > 0 && <Buildings houses={st.houses} side={side} />}
    </button>
  );
}

function Buildings({ houses, side }: { houses: number; side: string }) {
  const pos: Record<string, string> = {
    bottom: 'top-[2%] inset-x-0 justify-center',
    top: 'bottom-[2%] inset-x-0 justify-center',
    left: 'right-[2%] inset-y-0 flex-col justify-center',
    right: 'left-[2%] inset-y-0 flex-col justify-center',
  };
  return (
    <span className={cx('absolute z-[5] flex gap-[1px]', pos[side])} style={{ fontSize: '1.2cqw' }}>
      {houses === 5 ? (
        <span>🏨</span>
      ) : (
        Array.from({ length: houses }, (_, i) => <span key={i}>🏠</span>)
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
            <div className={cx('rounded-full shadow-md', isCur && 'animate-pulse-soft')}>
              <Avatar token={p.token} color={color} size="4.6cqw" ring={isCur} />
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
