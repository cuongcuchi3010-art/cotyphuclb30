import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD,
  DECK_NAMES,
  GROUPS,
  cardById,
  UTILITY_INDICES,
  formatMoney,
  isFestival,
  rentFor,
  standings,
  type GameEvent,
  type GameState,
  type Square as Sq,
} from '@cotyphu/shared';
import { useStore } from '../store';
import { useVoice } from '../voice';
import { cellOf, centerPct, cx, playerColor, sideOf, useGame, photoOf } from '../lib';
import { BrandLogo } from './BrandLogo';
import { Avatar } from './Avatar';
import { CenterInfo } from './CenterInfo';

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
  const shape = useStore((s) => s.boardShape);
  if (shape !== 'diamond') return <BoardGrid diamond={false} />;
  // Bàn hình thoi: xoay 45° (vẫn 2D); người chơi ở 4 góc
  return (
    <div className="relative aspect-square w-full select-none [container-type:inline-size]">
      <div
        className="absolute left-1/2 top-1/2 w-[70.71%]"
        style={{ transform: 'translate(-50%, -50%) rotate(45deg)' }}
      >
        <BoardGrid diamond />
      </div>
      <PlayerCorners />
    </div>
  );
}

function BoardGrid({ diamond }: { diamond: boolean }) {
  return (
    <div
      className={cx(
        'board relative aspect-square w-full select-none rounded-2xl bg-[#DCE3EA] p-[0.7%] shadow-card [container-type:inline-size] dark:bg-[#0d1117]',
        diamond && 'diamond',
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
        className="relative overflow-hidden rounded-xl"
        style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
      >
        <CenterDecor />
        {diamond ? (
          // Giữa bàn thoi: khung đứng thẳng nội tiếp
          <div
            className="absolute left-1/2 top-1/2 h-[70.71%] w-[70.71%]"
            style={{ transform: 'translate(-50%, -50%) rotate(-45deg)' }}
          >
            <CenterInfo />
            <CardReveal />
          </div>
        ) : (
          <>
            <CenterInfo />
            <CardReveal />
          </>
        )}
      </div>
      <Tokens />
    </div>
  );
}

/** Người chơi ở 4 góc màn hình quanh bàn thoi */
function PlayerCorners() {
  const { room, game, me } = useGame();
  const setDraft = useStore((s) => s.setTradeDraft);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  const speaking = useVoice((s) => s.speaking);
  if (!room || !game) return null;
  const ranks = game.rules.showStandings ? new Map(standings(game).map((x) => [x.id, x])) : null;
  const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);
  const meP = game.players.find((p) => p.id === me);
  // Chỗ ngồi theo CHIỀU KIM ĐỒNG HỒ đúng thứ tự lượt đi (sau bốc thăm):
  // góc 0 trên-trái → 1 trên-phải → 2 dưới-phải → 3 dưới-trái.
  // 5–6 người: thêm người thứ 3 vào góc phải (dưới người 2), người thứ 6 vào góc trái (trên người 5).
  const n = game.players.length;
  const layout: number[][] =
    n <= 4 ? [[0], [1], [2], [3]] : n === 5 ? [[0], [1, 2], [3], [4]] : [[0], [1, 2], [3], [4, 5]];
  const slots = layout.map((idx) =>
    idx.map((i) => game.players[i]).filter((p): p is (typeof game.players)[number] => !!p),
  );
  const pos = [
    'left-0 top-0 items-start',
    'right-0 top-0 items-end',
    'right-0 bottom-0 items-end flex-col-reverse',
    'left-0 bottom-0 items-start flex-col-reverse',
  ];
  const cur = game.phase.kind !== 'gameOver' ? game.players[game.current]?.id : null;
  return (
    <>
      {slots.map((list, k) => (
        <div
          key={k}
          className={cx('pointer-events-none absolute flex flex-col gap-[1cqw]', pos[k])}
        >
          {list.map((p) => {
            const seat = room.players.find((s) => s.id === p.id);
            const color = playerColor(room, p.id);
            const isCur = p.id === cur;
            const canTrade = !!meP && !meP.bankrupt && p.id !== me && !p.bankrupt;
            const rk = ranks?.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={!canTrade}
                onClick={() => {
                  setDraft({
                    to: p.id,
                    giveCash: 0,
                    giveProps: [],
                    giveCards: 0,
                    takeCash: 0,
                    takeProps: [],
                    takeCards: 0,
                  });
                  setTab('trade');
                  setSheet(true);
                }}
                className={cx(
                  'pointer-events-auto flex w-[27cqw] items-center gap-[1.2cqw] rounded-[2cqw] border-[0.5cqw] bg-white/95 px-[1.2cqw] py-[0.9cqw] text-left shadow-card dark:bg-[#211d16]/95',
                  p.bankrupt && 'opacity-40 grayscale',
                  isCur && 'animate-glow',
                )}
                style={{
                  borderColor: isCur ? color : 'transparent',
                  background: `linear-gradient(135deg, ${color}2a, transparent 70%), var(--sq-bg)`,
                }}
              >
                <span className="relative shrink-0">
                  <Avatar
                    token={p.token}
                    color={color}
                    size="7.5cqw"
                    speaking={speaking.includes(p.id)}
                    photo={photoOf(room, p.id)}
                  />
                  <span
                    className={cx(
                      'absolute bottom-0 right-0 h-[1.8cqw] w-[1.8cqw] rounded-full border border-white',
                      seat?.online || seat?.isBot ? 'bg-green-500' : 'bg-gray-400',
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span
                    className="flex items-center gap-[0.6cqw] font-bold"
                    style={{ fontSize: 'max(10px, 2.3cqw)' }}
                  >
                    {rk && <span>{medal(rk.rank)}</span>}
                    <span className="truncate">{p.id === me ? `${p.name} (bạn)` : p.name}</span>
                    {room.hostId === p.id && <span>👑</span>}
                  </span>
                  <span
                    className="block font-extrabold text-son dark:text-nghe"
                    style={{ fontSize: 'max(11px, 2.6cqw)' }}
                  >
                    {formatMoney(p.cash)}
                  </span>
                  <span
                    className="flex flex-wrap gap-x-[0.8cqw] text-gray-500"
                    style={{ fontSize: 'max(9px, 1.7cqw)' }}
                  >
                    {rk && <span>TS {formatMoney(rk.worth)}</span>}
                    {p.inJail && <span>🚓</span>}
                    {p.jailCards.length > 0 && <span>🎫{p.jailCards.length}</span>}
                    {seat?.voice && <span>🎙️</span>}
                    {seat?.isBot && <span>🤖</span>}
                    {p.bankrupt && <span>Phá sản</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </>
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
        className="relative flex flex-col items-center justify-center gap-[4%] overflow-hidden rounded-[6px] text-center shadow-sm"
        style={{
          gridRow: row,
          gridColumn: col,
          background: c.bg,
        }}
        title={sq.name}
      >
        <span className="upright leading-none drop-shadow-sm" style={{ fontSize: '5.4cqw' }}>
          {SPECIAL_ICON[sq.kind]}
        </span>
        <span
          className="upright font-extrabold uppercase leading-tight"
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
        'group relative flex items-center justify-center gap-[4%] overflow-hidden rounded-[6px] bg-[var(--sq-bg)] text-center leading-[1.1] text-slate-800 shadow-sm transition dark:text-slate-100',
        price !== null && 'hover:z-10 hover:-translate-y-[1px] hover:shadow-md',
        PAD[side],
      )}
      style={{
        gridRow: row,
        gridColumn: col,
        boxShadow: ownerColor
          ? `inset 0 0 0 0.55cqw ${ownerColor}, 0 0 0.6cqw ${ownerColor}88`
          : undefined,
      }}
      title={sq.name}
    >
      {/* Hình minh hoạ lớn */}
      <span
        className={cx(
          'upright flex shrink-0 items-center justify-center leading-none',
          st?.mortgaged && 'opacity-35 grayscale',
        )}
        style={{ fontSize: '3.5cqw' }}
      >
        {sq.kind === 'street' ? (
          sq.icon
        ) : isBrand ? (
          <BrandLogo id={sq.logo} name={sq.name} color={sq.brandColor} size="3.4cqw" />
        ) : (
          SPECIAL_ICON[sq.kind]
        )}
      </span>
      {/* Tên ô */}
      <span
        className={cx(
          'upright flex min-w-0 flex-col',
          vertical ? 'items-start text-left' : 'items-center',
        )}
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

      {/* Dải màu nhóm ở mép ngoài: giá mua (chưa có chủ) / tiền thuê (đã có chủ) */}
      {band && bandText && (
        <span
          className={cx(
            'absolute flex items-center justify-center font-extrabold text-white',
            BAND[side],
          )}
          style={{
            background: st?.mortgaged ? '#94A3B8' : band,
            fontSize: '1.15cqw',
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
      {game && isFestival(game, sq.index) && (
        <span
          className="upright absolute right-[3%] top-[3%] z-[7] leading-none drop-shadow"
          style={{ fontSize: '2.2cqw' }}
          title="Lễ hội: tiền thuê ×2"
        >
          🎉
        </span>
      )}
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
            <div className={cx('upright rounded-full shadow-md', isCur && 'animate-pulse-soft')}>
              <Avatar
                token={p.token}
                color={color}
                size="4.6cqw"
                ring={isCur}
                photo={photoOf(room, p.id)}
              />
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
