import { S } from '../strings.vi';
import { cx } from '../lib';

/** Cảnh báo: trò chơi giải trí nội bộ, nghiêm cấm cá cược / đánh bạc */
export function LegalNotice({ compact, className }: { compact?: boolean; className?: string }) {
  if (compact)
    return (
      <p
        role="note"
        className={cx(
          'text-center text-[11px] leading-snug text-gray-500 dark:text-gray-400',
          className,
        )}
      >
        ⚠️ {S.legal}
      </p>
    );
  return (
    <div
      role="note"
      className={cx(
        'flex gap-2 rounded-xl border border-son/30 bg-son-50 px-3 py-2 text-left text-xs leading-snug text-son-700 dark:border-son/40 dark:bg-son/15 dark:text-son-100',
        className,
      )}
    >
      <span aria-hidden>⚠️</span>
      <span>
        <b>{S.legalTitle}</b> {S.legal}
      </span>
    </div>
  );
}
