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
  square,
  type GameEvent,
  type GameState,
  type Square as Sq,
} from '@cotyphu/shared';
import { useStore } from '../store';
import {
  cellOf,
  centerPct,
  cx,
  fmtClock,
  nameOf,
  playerColor,
  sideOf,
  useGame,
  useNow,
} from '../lib';
import { BrandLogo } from './BrandLogo';
import { Avatar } from './Avatar';
import { CenterInfo, Die } from './CenterInfo';
import { ActionBar } from './ActionBar';

const SPECIAL_ICON: Partial<Record<Sq['kind'], string>> = {
  chest: '🧧',
  chance: '🎲',
  tax: '💸',
  parking: '☕',
  goToJail: '🚨',
  jail: '🚓',
  go: '🏁',
};

export function Board() {
  const view = useStore((s) => s.view);
  return view === '3d' ? <Board3D /> : <BoardGrid iso={false} />;
}

/** Lưới bàn cờ 11×11 (dùng cho cả 2D và mặt bàn 3D) */
function BoardGrid({ iso }: { iso: boolean }) {
  return (
    <div
      className={cx(
        'board relative aspect-square w-full select-none p-[0.7%] [container-type:inline-size]',
        iso
          ? 'iso rounded-[1.2cqw] bg-[#C9D3DD] dark:bg-[#1a2230]'
          : 'rounded-2xl bg-[#DCE3EA] shadow-card dark:bg-[#0d1117]',
      )}
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
        className={cx('relative rounded-xl', !iso && 'overflow-hidden')}
        style={{ gridRow: '2 / 11', gridColumn: '2 / 11', zIndex: iso ? 1 : undefined }}
      >
        {iso ? (
          <IsoCenter />
        ) : (
          <>
            <CenterDecor />
            <CenterInfo />
            <CardReveal />
          </>
        )}
      </div>
      <Tokens />
    </div>
  );
}

/** Bàn cờ 3D (isometric): mặt bàn nghiêng có độ dày; HUD phẳng nổi ở giữa */
function Board3D() {
  return (
    <div
      className="relative w-full select-none [container-type:inline-size]"
      style={{ height: '64cqw' }}
    >
      <div
        className="absolute left-1/2 top-[47%]"
        style={{
          width: '66cqw',
          height: '66cqw',
          transform: 'translate(-50%, -50%) rotateX(55deg) rotateZ(-45deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Khối đế: nhiều lớp xếp chồng tạo độ dày */}
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <div
            key={k}
            className="absolute inset-0 rounded-[1.2cqw]"
            style={{
              transform: `translateZ(-${k * 0.32}cqw)`,
              background: k === 6 ? '#5B6B7D' : '#8494A6',
              boxShadow: k === 6 ? '0 0 4cqw 1cqw rgb(15 23 42 / 0.35)' : undefined,
            }}
          />
        ))}
        <BoardGrid iso />
      </div>
      {/* HUD phẳng (không nghiêng) để bấm dễ; trên điện thoại hiện bên dưới bàn */}
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center sm:flex">
        <div className="pointer-events-auto" style={{ width: '34cqw', marginTop: '-4cqw' }}>
          <Hud3D />
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[44%] h-[34cqw] w-[46cqw] -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto relative h-full w-full">
          <CardReveal />
        </div>
      </div>
    </div>
  );
}

/** Bảng điều khiển phẳng cho chế độ 3D */
export function Hud3D() {
  const { room, game } = useGame();
  const events = useStore((s) => s.events);
  const now = useNow(250);
  if (!room || !game) return null;
  const cur = game.players[game.current]!;
  const dice = game.lastDice ?? [1, 1];
  const rolledNow = events.list.some((e) => e.t === 'roll');
  const left = room.deadline ? room.deadline - now : null;
  const ph = game.phase;
  const actorId = ph.kind === 'raiseFunds' ? ph.debtor : cur.id;
  const actor = game.players.find((p) => p.id === actorId) ?? cur;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/85 p-2.5 shadow-card backdrop-blur dark:bg-black/60">
      <div className="flex max-w-full items-center gap-3">
        <div className="flex w-[84px] shrink-0 gap-1.5">
          {dice.map((d, i) => (
            <motion.div
              key={`${events.id}-${i}`}
              initial={rolledNow ? { rotate: -360, scale: 0.4, y: -20 } : false}
              animate={{ rotate: 0, scale: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: i * 0.05,
                type: 'spring',
                stiffness: 180,
                damping: 14,
              }}
              className="flex-1"
            >
              <Die value={d} />
            </motion.div>
          ))}
        </div>
        {ph.kind !== 'gameOver' && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar token={actor.token} color={playerColor(room, actorId)} size={30} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold">
                {ph.kind === 'auction'
                  ? `Đấu giá: ${square(game.auction!.pos).short ?? square(game.auction!.pos).name}`
                  : ph.kind === 'raiseFunds'
                    ? `${nameOf(room, ph.debtor)} gom tiền`
                    : `Lượt ${cur.name}`}
              </div>
              {left !== null && (
                <div
                  className={cx(
                    'text-xs font-bold tabular-nums',
                    left < 10_000 ? 'text-son' : 'text-ngoc-600',
                  )}
                >
                  ⏱ {fmtClock(left)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="w-full">
        <ActionBar />
      </div>
    </div>
  );
}

/** Giữa mặt bàn 3D: thảm cỏ, chữ sơn trên nền, cây và công trình đứng */
function IsoCenter() {
  const deco = [
    { x: '14%', y: '14%', e: '🏟️', s: 8 },
    { x: '86%', y: '14%', e: '🌳', s: 4.5 },
    { x: '14%', y: '86%', e: '🌴', s: 4.5 },
    { x: '86%', y: '86%', e: '⛲', s: 5 },
    { x: '50%', y: '10%', e: '🌳', s: 3.5 },
    { x: '10%', y: '50%', e: '🌲', s: 3.5 },
    { x: '90%', y: '50%', e: '🌲', s: 3.5 },
    { x: '50%', y: '90%', e: '🌳', s: 3.5 },
  ];
  return (
    <div
      className="absolute inset-0 rounded-xl"
      style={{
        background: 'radial-gradient(circle at 50% 50%, #A6DE85 0%, #7CC35C 55%, #5FA845 100%)',
        boxShadow: 'inset 0 0 0 0.5cqw rgb(255 255 255 / 0.5)',
      }}
    >
      <div className="absolute inset-[7%] rounded-[2cqw] border-[0.35cqw] border-dashed border-white/60" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-center font-black leading-none text-white/85 drop-shadow"
          style={{ fontSize: '6cqw' }}
        >
          CỜ TỶ PHÚ
          <div className="mt-[1cqw] text-nghe" style={{ fontSize: '7.5cqw' }}>
            CLB30
          </div>
        </div>
      </div>
      {deco.map((d, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: d.x, top: d.y, fontSize: `${d.s}cqw` }}
        >
          <span className="bb">{d.e}</span>
        </span>
      ))}
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

/** Màu nhóm (dải giá) của ô mua được */
function bandColor(sq: Sq): string | null {
  if (sq.kind === 'street') return GROUPS[sq.group].color;
  if (sq.kind === 'transport') return '#334155';
  if (sq.kind === 'utility') return '#0E7490';
  return null;
}

/** Ô góc: màu nền riêng để dễ định hướng */
const CORNER_STYLE: Record<number, { bg: string; fg: string; sub?: string }> = {
  0: { bg: 'linear-gradient(135deg,#D9F7E8,#B7EBD2)', fg: '#0B7F52', sub: 'Nhận 200 tr' },
  10: { bg: 'linear-gradient(135deg,#ECEFF3,#D9DEE5)', fg: '#475569', sub: 'Chỉ ghé thăm' },
  20: { bg: 'linear-gradient(135deg,#FFF3CF,#FDE29A)', fg: '#9A6A00', sub: 'Nghỉ chân' },
  30: { bg: 'linear-gradient(135deg,#FFE1E4,#FFC2C9)', fg: '#B3132B', sub: 'Về tạm giữ' },
};

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

/** Dải giá nằm ở MÉP NGOÀI bàn cờ */
const BAND: Record<string, string> = {
  bottom: 'bottom-0 inset-x-0 h-[19%]',
  top: 'top-0 inset-x-0 h-[19%]',
  left: 'left-0 inset-y-0 w-[19%]',
  right: 'right-0 inset-y-0 w-[19%]',
};
const INNER_STRIPE: Record<string, (c: string) => string> = {
  bottom: (c) => `inset 0 0.4cqw 0 0 ${c}`,
  top: (c) => `inset 0 -0.4cqw 0 0 ${c}`,
  left: (c) => `inset -0.4cqw 0 0 0 ${c}`,
  right: (c) => `inset 0.4cqw 0 0 0 ${c}`,
};
const PAD: Record<string, string> = {
  bottom: 'pb-[21%] pt-[4%] flex-col',
  top: 'pt-[21%] pb-[4%] flex-col',
  left: 'pl-[21%] pr-[3%] flex-row',
  right: 'pr-[21%] pl-[3%] flex-row',
  corner: 'flex-col',
};

function SquareCell({ sq }: { sq: Sq }) {
  const { room, game } = useGame();
  const open = useStore((s) => s.setOpenSquare);
  const [row, col] = cellOf(sq.index);
  const side = sideOf(sq.index);
  const st = game?.properties[sq.index];
  const ownerColor = st?.owner ? playerColor(room, st.owner) : null;
  const price = 'price' in sq ? sq.price : null;
  const isBrand = sq.kind === 'transport' || sq.kind === 'utility';
  const band = bandColor(sq);
  const vertical = side === 'left' || side === 'right';

  // ---- Ô góc
  if (side === 'corner') {
    const c = CORNER_STYLE[sq.index]!;
    return (
      <div
        className="sq relative flex flex-col items-center justify-center gap-[4%] overflow-hidden rounded-[6px] text-center shadow-sm"
        style={{
          gridRow: row,
          gridColumn: col,
          background: c.bg,
          ['--depth' as string]: 20 + row - col,
        }}
        title={sq.name}
      >
        <span className="leading-none drop-shadow-sm" style={{ fontSize: '5.4cqw' }}>
          <span className="bb">{SPECIAL_ICON[sq.kind]}</span>
        </span>
        <span
          className="font-extrabold uppercase leading-tight"
          style={{ color: c.fg, fontSize: '1.55cqw' }}
        >
          {sq.short ?? sq.name}
        </span>
        {c.sub && (
          <span
            className="font-semibold leading-none opacity-80"
            style={{ color: c.fg, fontSize: '1.1cqw' }}
          >
            {sq.index === 20 && game?.rules.jackpot ? `Hũ: ${formatMoney(game.jackpot)}` : c.sub}
          </span>
        )}
      </div>
    );
  }

  // ---- Ô thường
  const bandText =
    st?.owner && game ? rentLabel(game, sq.index) : price !== null ? formatMoney(price) : null;
  return (
    <button
      type="button"
      onClick={() => (price !== null ? open(sq.index) : undefined)}
      className={cx(
        'sq group relative flex items-center justify-center gap-[4%] overflow-hidden rounded-[6px] bg-[var(--sq-bg)] text-center leading-[1.1] text-slate-800 shadow-sm transition dark:text-slate-100',
        price !== null && 'hover:z-10 hover:-translate-y-[1px] hover:shadow-md',
        PAD[side],
      )}
      style={{
        gridRow: row,
        gridColumn: col,
        boxShadow: ownerColor ? `inset 0 0 0 0.35cqw ${ownerColor}` : undefined,
        ['--depth' as string]: 20 + row - col,
      }}
      title={sq.name}
    >
      {/* Hình minh hoạ lớn */}
      <span
        className={cx(
          'flex shrink-0 items-center justify-center leading-none',
          st?.mortgaged && 'opacity-35 grayscale',
        )}
        style={{ fontSize: '3.5cqw' }}
      >
        {sq.kind === 'street' ? (
          <span className="bb">{sq.icon}</span>
        ) : isBrand ? (
          <BrandLogo id={sq.logo} name={sq.name} color={sq.brandColor} size="3.4cqw" />
        ) : (
          <span className="bb">{SPECIAL_ICON[sq.kind]}</span>
        )}
      </span>
      {/* Tên ô */}
      <span
        className={cx('flex min-w-0 flex-col', vertical ? 'items-start text-left' : 'items-center')}
      >
        <span className="line-clamp-2 font-bold" style={{ fontSize: '1.22cqw' }}>
          {sq.short ?? sq.name}
        </span>
        {sq.kind === 'tax' && (
          <span
            className="font-semibold text-slate-500 dark:text-slate-300"
            style={{ fontSize: '1.1cqw' }}
          >
            {formatMoney(sq.amount)}
          </span>
        )}
      </span>

      {/* Dải giá (chưa có chủ) / tiền thuê theo màu chủ (đã có chủ) ở mép ngoài */}
      {band && bandText && (
        <span
          className={cx(
            'absolute flex items-center justify-center font-extrabold text-white',
            BAND[side],
          )}
          style={{
            background: st?.mortgaged ? '#94A3B8' : (ownerColor ?? band),
            fontSize: '1.15cqw',
            // Chủ sở hữu: giữ một vạch màu nhóm ở mép trong của thẻ
            boxShadow: ownerColor ? INNER_STRIPE[side]!(band) : undefined,
          }}
        >
          <span
            className="whitespace-nowrap"
            style={
              vertical
                ? {
                    writingMode: 'vertical-rl',
                    transform: side === 'left' ? 'rotate(180deg)' : undefined,
                  }
                : undefined
            }
          >
            {ownerColor && !st?.mortgaged && sq.kind !== 'utility' ? `Thuê ${bandText}` : bandText}
          </span>
        </span>
      )}
      {st && st.houses > 0 && <Buildings houses={st.houses} side={side} />}
    </button>
  );
}

/** Nhà / khách sạn: đặt ở mép trong (phía giữa bàn) */
function Buildings({ houses, side }: { houses: number; side: string }) {
  const pos: Record<string, string> = {
    bottom: 'top-[2%] inset-x-0 justify-center',
    top: 'bottom-[2%] inset-x-0 justify-center',
    left: 'right-[2%] inset-y-0 flex-col justify-center',
    right: 'left-[2%] inset-y-0 flex-col justify-center',
  };
  return (
    <span
      className={cx('absolute z-[5] flex gap-[1px] drop-shadow', pos[side])}
      style={{ fontSize: '1.35cqw' }}
    >
      {houses === 5 ? (
        <span className="bb">🏨</span>
      ) : (
        Array.from({ length: houses }, (_, i) => (
          <span key={i} className="bb">
            🏠
          </span>
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
    <div className="tokens pointer-events-none absolute inset-0 z-20">
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
            <div className={cx('bb-token rounded-full shadow-md', isCur && 'animate-pulse-soft')}>
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
            <div className="text-2xl">{card.deck === 'chance' ? '🎲' : '🧧'}</div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-son dark:text-nghe">
              {DECK_NAMES[card.deck]} · {room?.players.find((p) => p.id === card.who)?.name}
            </div>
            <div
              style={{ fontSize: 'max(11px, 1.75cqw)' }}
              className="font-medium text-gray-800 dark:text-gray-100"
            >
              {cardById(card.id).text}
            </div>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
