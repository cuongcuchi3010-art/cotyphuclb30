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
        className="rounded-[18%] object-contain shadow-sm"
        style={{ width: size, height: size }}
        onError={() => setStage(stage === 'svg' ? 'png' : 'text')}
      />
    );
  }
  const words = name
    .replace(/[–-].*$/, '')
    .split(/\s+/)
    .filter(Boolean);
  // Tên một từ ngắn (vd METUB, MonoX): hiện nguyên tên; còn lại: chữ cái đầu / 2 ký tự đầu
  const initials = (
    words.length === 1
      ? words[0]!.length <= 5
        ? words[0]!
        : words[0]!.replace(/[a-z]/g, '').slice(0, 3) || words[0]!.slice(0, 2)
      : words
          .map((w) => w[0])
          .join('')
          .slice(0, 3)
  ).toUpperCase();
  const k = Math.min(0.36, 1.05 / Math.max(initials.length, 1));
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-bold text-white leading-none"
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: typeof size === 'number' ? size * k : `calc(${size} * ${k})`,
      }}
      title={name}
    >
      {initials}
    </span>
  );
}
