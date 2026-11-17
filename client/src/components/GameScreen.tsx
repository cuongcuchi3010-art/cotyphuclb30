import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { computeLayout, cx, useGame, useMeasuredHeight, useViewport } from '../lib';
import { isMuted, setMuted } from '../sound';
import { VoiceControls } from './VoiceControls';
import { Board } from './Board';
import { GameOver } from './GameOver';
import { PlayerList } from './PlayerList';
import { PropertyCardModal } from './PropertyCard';
import { Prompts } from './Prompts';
import { TabBar, TabContent } from './Tabs';
import { Btn } from './ui';

export function GameScreen() {
  const { room, game, me } = useGame();
  const sheetOpen = useStore((s) => s.sheetOpen);
  const setSheet = useStore((s) => s.setSheet);
  const { w, h } = useViewport();
  const [belowRef, belowH] = useMeasuredHeight<HTMLDivElement>();
  const [barRef, barH] = useMeasuredHeight<HTMLDivElement>();
  if (!room || !game) return null;
  // Dọc: chừa đúng phần dưới bàn cờ đo được + khoảng cách (8 trên + 8 giữa + 8 dưới)
  const reserved = belowH && barH ? belowH + barH + 24 : 226;
  const L = computeLayout(w, h, reserved);

  const overlays = (
    <>
      <Prompts />
      <PropertyCardModal />
      {game.phase.kind === 'gameOver' && <GameOver />}
      {me === null && <div className="sr-only">{S.game.spectating}</div>}
    </>
  );

  // ---- Bàn cờ trái + panel phải: máy tính, điện thoại nằm ngang, máy gập mở ngang
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
          <div className={L.compact ? 'max-h-[34%] shrink-0 overflow-y-auto' : 'shrink-0'}>
            <PlayerList compact={L.compact} cols={L.compact ? 2 : 1} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/90 p-2 shadow-card dark:bg-[#211d16]">
            <TabBar />
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <TabContent />
            </div>
          </div>
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
      <div className="touch-pinch-zoom shrink-0" style={{ width: L.board }}>
        <Board />
      </div>
      <div ref={belowRef} className="w-full" style={{ maxWidth: Math.max(L.board, 360) }}>
        <div className="mb-2">
          <TopBar />
        </div>
        <PlayerList compact cols={w >= 600 ? 3 : 2} />
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

function TopBar() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const [muted, setM] = useState(isMuted());
  const meP = game?.players.find((p) => p.id === me);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="font-semibold text-gray-600 dark:text-gray-300">
        {S.lobby.code}:{' '}
        <span className="font-mono tracking-widest text-son dark:text-nghe">{room?.code}</span>
        {room && room.spectators > 0 && <span className="ml-2">👀 {room.spectators}</span>}
      </div>
      <div className="flex gap-1">
        <VoiceControls />
        <Btn
          variant="ghost"
          aria-label={muted ? S.sound.on : S.sound.off}
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </Btn>
        {meP && !meP.bankrupt && game?.phase.kind !== 'gameOver' && (
          <Btn
            variant="ghost"
            className={cx('text-xs')}
            onClick={() => {
              if (confirm(S.game.confirmResign)) act({ type: 'resign' });
            }}
          >
            {S.game.resign}
          </Btn>
        )}
      </div>
    </div>
  );
}
