import { AnimatePresence, motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';

export function Btn({
  variant = 'primary',
  big,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
        big ? 'min-h-[48px] px-5 text-base' : 'min-h-[36px] px-3 text-sm',
        variant === 'primary' && 'bg-son text-white shadow hover:bg-son-600',
        variant === 'gold' && 'bg-nghe text-son-700 shadow hover:bg-nghe-600',
        variant === 'secondary' && 'bg-ngoc text-white shadow hover:bg-ngoc-600',
        variant === 'danger' &&
          'bg-gray-800 text-white hover:bg-black dark:bg-gray-200 dark:text-gray-900',
        variant === 'ghost' &&
          'bg-black/5 text-gray-800 hover:bg-black/10 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20',
        className,
      )}
    />
  );
}

export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}) {
  // Luôn gắn vào <body>: tránh bị bó trong khung có transform / backdrop-filter (bàn thoi, bàn 3D)
  const node = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cx(
              'max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-giay p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card dark:bg-giay-dark sm:max-w-md sm:rounded-3xl',
              className,
            )}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl bg-white/90 p-3 shadow-card dark:bg-[#211d16]', className)}>
      {children}
    </div>
  );
}
