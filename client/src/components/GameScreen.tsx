import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, useGame } from '../lib';
import { isMuted, setMuted } from '../sound';
import { ActionBar } from './ActionBar';
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
  if (!room || !game) return null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col gap-3 p-2 pb-36 lg:flex-row lg:items-start lg:p-4 lg:pb-4">
      {/* Bàn cờ */}
      <div className="w-full lg:sticky lg:top-4 lg:max-w-[min(100vh-2rem,900px)] lg:flex-1">
        <div className="touch-pinch-zoom overflow-auto">
          <Board />
        </div>
      </div>

      {/* Panel bên phải (máy tính) */}
      <aside className="hidden w-[380px] shrink-0 flex-col gap-3 lg:flex">
        <TopBar />
        <PlayerList />
        <div className="rounded-2xl bg-white/90 p-3 shadow-card dark:bg-[#211d16]">
          <ActionBar />
        </div>
        <div className="flex h-[48vh] flex-col rounded-2xl bg-white/90 p-2 shadow-card dark:bg-[#211d16]">
          <TabBar />
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
            <TabContent />
          </div>
        </div>
      </aside>

      {/* Điện thoại: danh sách người chơi gọn + thanh hành động cố định + bottom sheet */}
      <div className="lg:hidden">
        <div className="mb-2">
          <TopBar />
        </div>
        <PlayerList compact />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-giay/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-white/10 dark:bg-giay-dark/95 lg:hidden">
        <ActionBar />
        <div className="mt-2">
          <TabBar />
        </div>
      </div>
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheet(false)}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0 flex h-[72vh] flex-col rounded-t-3xl bg-giay p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-card dark:bg-giay-dark"
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

      <Prompts />
      <PropertyCardModal />
      {game.phase.kind === 'gameOver' && <GameOver />}
      {me === null && <div className="sr-only">{S.game.spectating}</div>}
    </div>
  );
}

function TopBar() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const [muted, setM] = useState(isMuted());
  const meP = game?.players.find((p) => p.id === me);
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="font-semibold text-gray-600 dark:text-gray-300">
        {S.lobby.code}:{' '}
        <span className="font-mono tracking-widest text-son dark:text-nghe">{room?.code}</span>
        {room && room.spectators > 0 && <span className="ml-2">👀 {room.spectators}</span>}
      </div>
      <div className="flex gap-1">
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
