import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { GateScreen } from './components/GateScreen';
import { Home } from './components/Home';
import { RoomPage } from './components/RoomPage';
import { usePath } from './router';
import { checkGate, useStore } from './store';
import { cx } from './lib';

export function App() {
  const path = usePath();
  const auth = useStore((s) => s.auth);
  const gate = useStore((s) => s.gate);
  useEffect(() => {
    void checkGate();
  }, []);
  const m = path.match(/^\/r\/([A-Za-z0-9]{6})\/?$/);
  return (
    <div className="lotus-bg min-h-[100dvh]">
      {gate === null ? null : !gate ? (
        <GateScreen />
      ) : !auth ? (
        <AuthScreen />
      ) : m ? (
        <RoomPage key={m[1]!.toUpperCase()} code={m[1]!.toUpperCase()} />
      ) : (
        <Home />
      )}
      <Toasts />
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[80] flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-medium shadow-card',
              t.kind === 'error' ? 'bg-son text-white' : 'bg-gray-900 text-white',
            )}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
