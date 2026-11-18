import type { TokenId } from '@cotyphu/shared';
import { cx } from '../lib';
import { TokenIcon } from './TokenIcon';

/**
 * Avatar người chơi: quân cờ trên nền hoạ tiết theo màu của người chơi
 * (dùng thống nhất ở danh sách người chơi, bàn cờ, sảnh, tổng kết).
 */
export function Avatar({
  token,
  color,
  size = 32,
  ring,
  speaking,
  className,
  photo,
}: {
  token: TokenId;
  color: string;
  /** px hoặc đơn vị CSS (vd "4.6cqw") */
  size?: number | string;
  ring?: boolean;
  speaking?: boolean;
  className?: string;
  /** Ảnh đại diện của người chơi (nếu có): hiện ảnh, kèm huy hiệu quân cờ nhỏ */
  photo?: string | null;
}) {
  const id = `pat-${color.replace('#', '')}`;
  return (
    <span
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        className,
      )}
      style={{
        width: size,
        height: size,
        boxShadow: speaking
          ? `0 0 0 3px ${color}, 0 0 12px 3px ${color}`
          : ring
            ? `0 0 0 2px white, 0 0 0 4px ${color}`
            : `0 0 0 2px ${color}`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full rounded-full" viewBox="0 0 40 40" aria-hidden>
        <defs>
          <pattern
            id={id}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill={color} fillOpacity="0.18" />
            <circle cx="4" cy="4" r="1.6" fill={color} fillOpacity="0.55" />
            <rect y="0" width="8" height="1" fill={color} fillOpacity="0.25" />
          </pattern>
          <radialGradient id={`${id}-g`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="100%" stopColor="white" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="20" fill="white" />
        <circle cx="20" cy="20" r="20" fill={`url(#${id})`} />
        <circle cx="20" cy="20" r="13" fill={`url(#${id}-g)`} />
      </svg>
      {photo ? (
        <>
          <img
            src={photo}
            alt=""
            draggable={false}
            className="relative h-full w-full rounded-full object-cover"
          />
          <span
            className="absolute -bottom-[8%] -right-[8%] flex items-center justify-center rounded-full bg-white shadow"
            style={{ width: '46%', height: '46%', boxShadow: `0 0 0 1.5px ${color}` }}
          >
            <TokenIcon token={token} size="80%" />
          </span>
        </>
      ) : (
        <span className="relative flex h-full w-full items-center justify-center">
          <TokenIcon
            token={token}
            size={typeof size === 'number' ? Math.round(size * 0.68) : '68%'}
          />
        </span>
      )}
    </span>
  );
}
