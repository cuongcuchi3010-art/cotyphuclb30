import type { TokenId } from '@cotyphu/shared';

/** Quân cờ: SVG tự vẽ, không dùng hình của bản gốc */
export function TokenIcon({ token, size = 28 }: { token: TokenId; size?: number | string }) {
  const p = { width: size, height: size, viewBox: '0 0 48 48', 'aria-hidden': true } as const;
  switch (token) {
    case 'xe-may':
      return (
        <svg {...p}>
          <circle cx="12" cy="34" r="7" fill="#333" />
          <circle cx="12" cy="34" r="3" fill="#ddd" />
          <circle cx="37" cy="34" r="7" fill="#333" />
          <circle cx="37" cy="34" r="3" fill="#ddd" />
          <path
            d="M12 34 L20 22 H31 L37 34"
            stroke="#C8102E"
            strokeWidth="5"
            fill="none"
            strokeLinejoin="round"
          />
          <path d="M19 22 Q24 16 31 18 L33 24 H21z" fill="#C8102E" />
          <rect x="30" y="12" width="4" height="10" rx="2" fill="#555" />
          <rect x="28" y="11" width="9" height="3" rx="1.5" fill="#555" />
        </svg>
      );
    case 'non-la':
      return (
        <svg {...p}>
          <path d="M24 6 L44 34 Q24 40 4 34 Z" fill="#E9C46A" stroke="#B8892B" strokeWidth="2" />
          <path d="M24 6 L16 35 M24 6 L32 35 M24 6 L24 37" stroke="#C9A04A" strokeWidth="1.2" />
          <path d="M10 35 Q24 46 38 35" stroke="#C8102E" strokeWidth="2.5" fill="none" />
        </svg>
      );
    case 'banh-mi':
      return (
        <svg {...p}>
          <path
            d="M5 28 Q8 14 24 14 Q42 14 44 26 Q42 36 24 36 Q7 36 5 28z"
            fill="#E6A04A"
            stroke="#A8641F"
            strokeWidth="2"
          />
          <path
            d="M14 20 l4 6 M22 18 l4 7 M30 18 l4 7"
            stroke="#FCE2B0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M9 30 Q24 36 41 29" stroke="#3FA34D" strokeWidth="3" fill="none" />
        </svg>
      );
    case 'ca-phe':
      return (
        <svg {...p}>
          <path d="M12 12 H36 L33 42 H15 Z" fill="#F4F1EA" stroke="#999" strokeWidth="1.5" />
          <path d="M13.5 24 H34.5 L33 42 H15 Z" fill="#7B4A2A" />
          <path d="M13 18 H35 L34.5 24 H13.5Z" fill="#D9B48F" />
          <rect x="17" y="27" width="6" height="5" rx="1" fill="#E8F4FB" opacity="0.8" />
          <rect x="25" y="31" width="6" height="5" rx="1" fill="#E8F4FB" opacity="0.8" />
          <rect
            x="27"
            y="3"
            width="3"
            height="20"
            rx="1.5"
            fill="#0E9F8E"
            transform="rotate(12 28 13)"
          />
        </svg>
      );
    case 'con-trau':
      return (
        <svg {...p}>
          <path
            d="M6 14 Q2 6 12 8 Q14 12 16 14 M42 14 Q46 6 36 8 Q34 12 32 14"
            stroke="#444"
            strokeWidth="3"
            fill="#777"
          />
          <ellipse cx="24" cy="24" rx="12" ry="11" fill="#5B5B5B" />
          <ellipse cx="24" cy="32" rx="8" ry="6" fill="#8A8A8A" />
          <circle cx="19" cy="21" r="2" fill="#fff" />
          <circle cx="29" cy="21" r="2" fill="#fff" />
          <circle cx="21" cy="32" r="1.5" fill="#333" />
          <circle cx="27" cy="32" r="1.5" fill="#333" />
        </svg>
      );
    case 'xich-lo':
      return (
        <svg {...p}>
          <circle cx="9" cy="36" r="6" fill="none" stroke="#333" strokeWidth="3" />
          <circle cx="26" cy="36" r="6" fill="none" stroke="#333" strokeWidth="3" />
          <circle cx="40" cy="38" r="5" fill="none" stroke="#333" strokeWidth="3" />
          <path d="M4 26 Q4 14 16 14 H24 V30 H6z" fill="#0E9F8E" />
          <path d="M3 16 Q12 6 26 12" stroke="#F2A900" strokeWidth="3" fill="none" />
          <path d="M24 30 L40 38 M34 22 L40 38 M31 22 H37" stroke="#333" strokeWidth="2.5" />
        </svg>
      );
    case 'hoa-sen':
      return (
        <svg {...p}>
          <path
            d="M24 6 Q31 18 24 34 Q17 18 24 6z"
            fill="#F48FB1"
            stroke="#D81B60"
            strokeWidth="1.5"
          />
          <path
            d="M8 16 Q20 20 22 34 Q10 30 8 16z"
            fill="#F8BBD0"
            stroke="#D81B60"
            strokeWidth="1.5"
          />
          <path
            d="M40 16 Q28 20 26 34 Q38 30 40 16z"
            fill="#F8BBD0"
            stroke="#D81B60"
            strokeWidth="1.5"
          />
          <path d="M6 36 Q24 30 42 36 Q24 44 6 36z" fill="#43A047" />
        </svg>
      );
    case 'ao-dai':
      return (
        <svg {...p}>
          <path
            d="M18 5 H30 L32 10 L40 16 L37 22 L32 19 L34 44 H14 L16 19 L11 22 L8 16 L16 10 Z"
            fill="#C8102E"
            stroke="#850A1F"
            strokeWidth="1.5"
          />
          <path d="M20 5 Q24 9 28 5" stroke="#F2A900" strokeWidth="2" fill="none" />
          <path d="M24 10 V44" stroke="#F2A900" strokeWidth="1.5" />
          <circle cx="21" cy="26" r="2" fill="#F2A900" />
          <circle cx="27" cy="34" r="2" fill="#F2A900" />
        </svg>
      );
  }
}
