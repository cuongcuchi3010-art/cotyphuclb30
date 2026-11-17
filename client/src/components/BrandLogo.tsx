import { useState } from 'react';

/**
 * Logo thương hiệu do chủ dự án cung cấp ở client/public/logos/<id>.svg hoặc .png.
 * Thiếu file thì hiển thị huy hiệu chữ trên nền brandColor.
 */
export function BrandLogo({
  id,
  name,
  color,
  size = 28,
}: {
  id?: string;
  name: string;
  color: string;
  /** px hoặc đơn vị CSS */
  size?: number | string;
}) {
  const [stage, setStage] = useState<'svg' | 'png' | 'text'>(id ? 'svg' : 'text');
  if (stage !== 'text' && id) {
    return (
      <img
        src={`/logos/${id}.${stage}`}
        alt={name}
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
        onError={() => setStage(stage === 'svg' ? 'png' : 'text')}
      />
    );
  }
  const initials = name
    .replace(/[–-].*$/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-bold text-white leading-none"
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: typeof size === 'number' ? size * 0.36 : `calc(${size} * 0.36)`,
      }}
      title={name}
    >
      {initials}
    </span>
  );
}
