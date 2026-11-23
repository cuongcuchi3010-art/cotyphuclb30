import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { computeLayout, cx, useGame, useMeasuredHeight, useViewport } from '../lib';
import { isMuted, setMuted } from '../sound';
import { setMusicOn, startMusic, stopMusic, useMusic } from '../music';
import { DiscordButton } from './DiscordButton';
import { Board } from './Board';
import { GameOver } from './GameOver';
import { PlayerList } from './PlayerList';
import { PropertyCardModal } from './PropertyCard';
import { Prompts } from './Prompts';
import { PayNotices } from './PayNotices';
import { TabBar, TabContent } from './Tabs';
import { RulesButton } from './RulesGuide';
import { Btn } from './ui';
import { LegalNotice } from './LegalNotice';

const RAIL = 84;
const TOPBAR = 48;

export function GameScreen() {
  const { room, game, me } = useGame();
  const sheetOpen = useStore((s) => s.sheetOpen);
  const setSheet = useStore((s) => s.setSheet);
  const { w, h } = useViewport();
  const shape = useStore((s) => s.boardShape);
  const diamond = shape === 'diamond';
  const is3d = shape === '3d';
  const [belowRef, belowH] = useMeasuredHeight<HTMLDivElement>();
  const [barRef, barH] = useMeasuredHeight<HTMLDivElement>();
  const railsRef = useRef(false);
  useEffect(() => {
    // Trình duyệt chỉ cho phát âm thanh sau khi người dùng chạm/bấm
    const kick = () => startMusic();
    kick();
    window.addEventListener('pointerdown', kick);
    return () => {
      window.removeEventListener('pointerdown', kick);
      stopMusic();
    };
  }, []);
  if (!room || !game) return null;
  // Dọc: chừa đúng phần dưới bàn cờ đo được + khoảng cách (8 trên + 8 giữa + 8 dưới)
  // Hàng nút (mã phòng, nhạc, loa, bỏ cuộc) cao ~TOPBAR px khi nằm dưới bàn cờ
  const measured = belowH && barH ? belowH + barH + 24 : 0;
  const base = measured ? measured - (railsRef.current ? 0 : TOPBAR) : 226 - TOPBAR;
  const withRails = computeLayout(w, h, base, RAIL * 2 + 16);
  const noRails = computeLayout(w, h, base + TOPBAR);
  // Màn hình rộng gần vuông (Z Fold mở trong): đưa nút ra hai bên nếu bàn cờ không nhỏ đi đáng kể
  const rails =
    w >= 600 && w / h < 1.15 && withRails.mode === 'stack' && withRails.board >= noRails.board - 12;
  railsRef.current = rails;
  const L = rails ? withRails : noRails;

  const overlays = (
    <>
      <Prompts />
      <PayNotices />
      <PropertyCardModal />
      {game.phase.kind === 'gameOver' && <GameOver />}
      {me === null && <div className="sr-only">{S.game.spectating}</div>}
    </>
  );

  // ---- Bàn cờ trái + panel phải: máy tính, điện thoại nằm ngang, máy gập mở ngang
  // ---- 3D trên màn hình ngang (máy tính Full HD / 2K / 4K): khung 3D lấp đầy phần còn lại
  if (L.mode === 'side' && is3d) {
    // Màn hình rất rộng: bảng bên to theo cỡ chữ gốc (16 → 20 → 26px)
    const ui = w >= 3200 ? 26 / 16 : w >= 2400 ? 20 / 16 : 1;
    // Bảng chức năng chiếm ~30% bề ngang để giao dịch / vay / tài sản dễ thao tác;
    // màn Full HD phóng chữ trong bảng thêm ~15% (2K/4K đã phóng theo cỡ chữ gốc)
    const panel = Math.round(Math.min(620 * ui, Math.max(340, w * 0.3)));
    const zoom = ui === 1 && w >= 1500 ? 1.15 : ui === 1 && w >= 1200 ? 1.08 : 1;
    return (
      <div className="flex gap-3 p-2" style={{ height: '100dvh' }}>
        <div className="min-w-0 flex-1">
          <Board fill />
        </div>
        <aside
          className="flex min-w-0 shrink-0 flex-col gap-2"
          style={{ width: panel / zoom, height: `${100 / zoom}%`, zoom }}
        >
          <TopBar />
          <div className="max-h-[34%] shrink-0 overflow-y-auto">
            <PlayerList compact={h < 800} cols={1} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/90 p-2 shadow-card dark:bg-[#211d16]">
            <TabBar />
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <TabContent />
            </div>
          </div>
          <LegalNotice compact className="shrink-0" />
        </aside>
        {overlays}
      </div>
    );
  }

  if (L.mode === 'side') {
    return (
      <div
        className="mx-auto flex justify-center gap-3 p-2"
        style={{ height: '100dvh', maxWidth: L.board + L.panel + 48 }}
      >
        <div className="shrink-0 self-center" style={{ width: L.board }}>
          <Board />
        </div>
        <aside className="flex min-w-0 flex-col gap-2" style={{ width: L.panel }}>
          <TopBar />
          {!diamond && (
            <div className={L.compact ? 'max-h-[34%] shrink-0 overflow-y-auto' : 'shrink-0'}>
              <PlayerList compact={L.compact} cols={L.compact ? 2 : 1} />
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/90 p-2 shadow-card dark:bg-[#211d16]">
            <TabBar />
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <TabContent />
            </div>
          </div>
          <LegalNotice compact className="shrink-0" />
        </aside>
        {overlays}
      </div>
    );
  }

  // ---- Dọc: điện thoại cầm dọc, máy gập mở dọc (màn hình gần vuông)
  return (
    <div
      className="mx-auto flex min-h-[100dvh] flex-col items-center justify-center gap-2 p-2"
      style={{ paddingBottom: (barH || 76) + 8 }}
    >
      <div className="flex items-center justify-center gap-2">
        {rails && <RailLeft width={RAIL} />}
        <div className="touch-pinch-zoom shrink-0" style={{ width: L.board }}>
          <Board />
        </div>
        {rails && <RailRight width={RAIL} />}
      </div>
      <div ref={belowRef} className="w-full" style={{ maxWidth: Math.max(L.board, 360) }}>
        {!rails && (
          <div className="mb-2">
            <TopBar />
          </div>
        )}
        {!diamond && <PlayerList compact cols={w >= 600 ? 3 : 2} />}
        <LegalNotice compact className="mt-1.5" />
      </div>
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-giay/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-white/10 dark:bg-giay-dark/95"
      >
        <div className="mx-auto" style={{ maxWidth: Math.max(L.board, 360) }}>
          <TabBar />
        </div>
      </div>
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheet(false)}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0 mx-auto flex h-[72dvh] max-w-[720px] flex-col rounded-t-3xl bg-giay p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-card dark:bg-giay-dark"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Đóng"
                className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-black/20 dark:bg-white/30"
                onClick={() => setSheet(false)}
              />
              <TabBar />
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <TabContent />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {overlays}
    </div>
  );
}

/** Mã phòng (+ số khán giả) */
function RoomCode({ vertical }: { vertical?: boolean }) {
  const { room } = useGame();
  return (
    <div
      className={cx(
        'font-semibold text-gray-600 dark:text-gray-300',
        vertical && 'flex flex-col items-center text-center leading-tight',
      )}
    >
      <span className={vertical ? 'text-xs' : ''}>{S.lobby.code}:</span>{' '}
      <span className="font-mono tracking-widest text-son dark:text-nghe">{room?.code}</span>
      {room && room.spectators > 0 && <span className="ml-2">👀 {room.spectators}</span>}
    </div>
  );
}

function ShapeButton({ className, vertical }: { className?: string; vertical?: boolean }) {
  const shape = useStore((s) => s.boardShape);
  const setShape = useStore((s) => s.setBoardShape);
  return (
    <div
      className={cx(
        'flex rounded-xl bg-black/5 p-0.5 dark:bg-white/10',
        vertical && 'flex-col',
        className,
      )}
      role="group"
      aria-label={S.shape.label}
    >
      {(['diamond', 'square', '3d'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setShape(v)}
          className={cx(
            'flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-bold',
            shape === v
              ? 'bg-white text-son shadow dark:bg-gray-800 dark:text-nghe'
              : 'text-gray-500',
          )}
        >
          {v === 'diamond'
            ? `◆ ${S.shape.diamond}`
            : v === 'square'
              ? `■ ${S.shape.square}`
              : `🧊 ${S.shape.threeD}`}
        </button>
      ))}
    </div>
  );
}

function SoundButton({ className }: { className?: string }) {
  const [muted, setM] = useState(isMuted());
  return (
    <Btn
      variant="ghost"
      className={className}
      title={muted ? S.sound.on : S.sound.off}
      aria-label={muted ? S.sound.on : S.sound.off}
      onClick={() => {
        setMuted(!muted);
        setM(!muted);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </Btn>
  );
}

function MusicButton({ className }: { className?: string }) {
  const on = useMusic((s) => s.on);
  return (
    <Btn
      variant={on ? 'gold' : 'ghost'}
      className={cx(!on && 'opacity-60 grayscale', className)}
      title={on ? S.music.off : S.music.on}
      aria-label={on ? S.music.off : S.music.on}
      onClick={() => setMusicOn(!on)}
    >
      🎵
    </Btn>
  );
}

function ResignButton({ className }: { className?: string }) {
  const { game, me } = useGame();
  const act = useStore((s) => s.act);
  const meP = game?.players.find((p) => p.id === me);
  if (!meP || meP.bankrupt || game?.phase.kind === 'gameOver') return null;
  return (
    <Btn
      variant="ghost"
      className={cx('text-xs', className)}
      onClick={() => {
        if (confirm(S.game.confirmResign)) act({ type: 'resign' });
      }}
    >
      {S.game.resign}
    </Btn>
  );
}

function TopBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <RoomCode />
      <div className="flex flex-wrap justify-end gap-1">
        <RulesButton />
        <DiscordButton />
        <ShapeButton />
        <MusicButton />
        <SoundButton />
        <ResignButton />
      </div>
    </div>
  );
}

/** Cột nút hai bên bàn cờ (màn hình rộng gần vuông: Z Fold mở trong, tablet) */
function RailLeft({ width }: { width: number }) {
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 text-sm" style={{ width }}>
      <RoomCode vertical />
    </div>
  );
}
function RailRight({ width }: { width: number }) {
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 text-sm" style={{ width }}>
      <RulesButton label />
      <DiscordButton />
      <ShapeButton vertical />
      <MusicButton />
      <SoundButton />
      <ResignButton />
    </div>
  );
}
