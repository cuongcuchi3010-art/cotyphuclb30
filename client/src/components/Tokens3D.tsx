import type { TokenId } from '@cotyphu/shared';

/**
 * Quân cờ 3D kiểu đồ chơi lắp ghép: mô phỏng đúng biểu tượng quân cờ của game
 * (xe máy, nón lá, bánh mì, cà phê sữa đá, con trâu, xích lô, hoa sen, áo dài),
 * đứng thẳng trên mặt ô (không có đế).
 * Gốc toạ độ ở tâm đáy; cao khoảng 0,8; mặt trước hướng +z.
 */

/** Nhựa bóng kiểu đồ chơi */
function P({ c, rough = 0.35 }: { c: string; rough?: number }) {
  return <meshStandardMaterial color={c} roughness={rough} metalness={0.02} />;
}

const BLACK = '#1f2937';
const WHITE = '#F8FAFC';
const GOLD = '#F2C94C';

function Wheel({
  x,
  y,
  z,
  r = 0.12,
  w = 0.06,
}: {
  x: number;
  y: number;
  z: number;
  r?: number;
  w?: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, w, 20]} />
        <P c={BLACK} rough={0.6} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[r * 0.45, r * 0.45, w + 0.01, 16]} />
        <P c="#D1D5DB" rough={0.3} />
      </mesh>
    </group>
  );
}

function XeMay({ color }: { color: string }) {
  return (
    <group position={[0, 0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
      <Wheel x={0} y={0.12} z={0.2} />
      <Wheel x={0} y={0.12} z={-0.2} />
      {/* Thân xe */}
      <mesh position={[0, 0.25, -0.03]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.12, 0.36]} />
        <P c="#C8102E" />
      </mesh>
      {/* Yên */}
      <mesh position={[0, 0.34, -0.08]} castShadow>
        <boxGeometry args={[0.14, 0.05, 0.2]} />
        <P c={BLACK} rough={0.5} />
      </mesh>
      {/* Đầu xe + đèn */}
      <mesh position={[0, 0.36, 0.16]} castShadow>
        <boxGeometry args={[0.15, 0.14, 0.08]} />
        <P c={color} />
      </mesh>
      <mesh position={[0, 0.37, 0.205]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#FEF3C7" emissive="#FDE68A" emissiveIntensity={0.6} />
      </mesh>
      {/* Ghi đông */}
      <mesh position={[0, 0.46, 0.15]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.28, 10]} />
        <P c="#4B5563" />
      </mesh>
    </group>
  );
}

function NonLa() {
  return (
    <group position={[0, 0.12, 0]}>
      <mesh position={[0, 0.26, 0]} castShadow>
        <coneGeometry args={[0.3, 0.42, 32]} />
        <P c="#E9C46A" rough={0.6} />
      </mesh>
      {/* Vành nón + đường nan */}
      {[0.1, 0.2, 0.3].map((y) => (
        <mesh key={y} position={[0, 0.05 + y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3 * (1 - (y + 0.0) / 0.42) + 0.005, 0.006, 6, 32]} />
          <P c="#B8892B" />
        </mesh>
      ))}
      {/* Quai nón đỏ */}
      <mesh position={[0, 0.07, 0.02]} rotation={[0.5, 0, 0]}>
        <torusGeometry args={[0.18, 0.015, 8, 32, Math.PI]} />
        <P c="#C8102E" />
      </mesh>
    </group>
  );
}

function BanhMi() {
  return (
    <group position={[0, 0.25, 0]} rotation={[0, 0.5, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.13, 0.34, 8, 20]} />
        <P c="#E6A04A" rough={0.55} />
      </mesh>
      {/* Khía vỏ bánh */}
      {[-0.14, 0, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.115, 0]} rotation={[0, 0.6, 0]}>
          <boxGeometry args={[0.03, 0.02, 0.16]} />
          <P c="#F7D08A" />
        </mesh>
      ))}
      {/* Nhân: rau + thịt */}
      <mesh position={[0, 0.02, 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 10]} />
        <P c="#16A34A" />
      </mesh>
      <mesh position={[0.06, -0.02, 0.11]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.3, 10]} />
        <P c="#DC2626" />
      </mesh>
    </group>
  );
}

function CaPhe() {
  return (
    <group position={[0, 0.12, 0]}>
      {/* Ly thuỷ tinh */}
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.15, 0.12, 0.46, 24, 1, true]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.35} roughness={0.05} />
      </mesh>
      {/* Cà phê + sữa */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.13, 0.115, 0.22, 24]} />
        <P c="#5B3A1E" rough={0.3} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.14, 0.13, 0.1, 24]} />
        <P c="#C08A5A" rough={0.3} />
      </mesh>
      {/* Đá viên */}
      {(
        [
          [0.05, 0.36, 0.03],
          [-0.05, 0.38, -0.02],
          [0, 0.4, 0.06],
        ] as const
      ).map(([x, y, z]) => (
        <mesh key={`${x}${y}`} position={[x, y, z]} rotation={[0.4, 0.7, 0.2]}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshStandardMaterial color="#F0F9FF" transparent opacity={0.8} roughness={0.05} />
        </mesh>
      ))}
      {/* Ống hút */}
      <mesh position={[0.05, 0.5, 0]} rotation={[0, 0, -0.25]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.4, 10]} />
        <P c="#C8102E" />
      </mesh>
    </group>
  );
}

function ConTrau() {
  const body = '#4B5563';
  return (
    <group position={[0, 0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.27, -0.04]} castShadow>
        <boxGeometry args={[0.22, 0.2, 0.36]} />
        <P c={body} rough={0.6} />
      </mesh>
      {/* Chân */}
      {(
        [
          [-0.07, -0.14],
          [0.07, -0.14],
          [-0.07, 0.1],
          [0.07, 0.1],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.09, z]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
          <P c={body} rough={0.6} />
        </mesh>
      ))}
      {/* Đầu + mõm */}
      <mesh position={[0, 0.33, 0.2]} castShadow>
        <boxGeometry args={[0.16, 0.15, 0.13]} />
        <P c={body} rough={0.6} />
      </mesh>
      <mesh position={[0, 0.29, 0.28]}>
        <boxGeometry args={[0.12, 0.08, 0.05]} />
        <P c="#9CA3AF" rough={0.6} />
      </mesh>
      {/* Sừng cong */}
      {[-1, 1].map((sd) => (
        <mesh
          key={sd}
          position={[sd * 0.1, 0.42, 0.2]}
          rotation={[0, 0, sd > 0 ? 0 : Math.PI]}
          castShadow
        >
          <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI * 0.9]} />
          <P c="#F5F5F4" rough={0.4} />
        </mesh>
      ))}
      {/* Mắt */}
      {[-1, 1].map((sd) => (
        <mesh key={`e${sd}`} position={[sd * 0.045, 0.36, 0.268]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <P c={WHITE} />
        </mesh>
      ))}
    </group>
  );
}

function XichLo({ color }: { color: string }) {
  return (
    <group position={[0, 0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
      <Wheel x={-0.15} y={0.1} z={0.15} r={0.1} w={0.04} />
      <Wheel x={0.15} y={0.1} z={0.15} r={0.1} w={0.04} />
      <Wheel x={0} y={0.1} z={-0.22} r={0.1} w={0.04} />
      {/* Ghế khách phía trước */}
      <mesh position={[0, 0.24, 0.12]} castShadow>
        <boxGeometry args={[0.3, 0.1, 0.18]} />
        <P c="#C8102E" />
      </mesh>
      <mesh position={[0, 0.34, 0.04]} castShadow>
        <boxGeometry args={[0.3, 0.18, 0.04]} />
        <P c="#C8102E" />
      </mesh>
      {/* Mui che: mái nghiêng trên hai cột */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.42, 0.04]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
          <P c="#374151" />
        </mesh>
      ))}
      <mesh position={[0, 0.52, 0.1]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.03, 0.24]} />
        <P c={color} rough={0.4} />
      </mesh>
      {/* Khung + yên người đạp */}
      <mesh position={[0, 0.22, -0.1]} rotation={[Math.PI / 2.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.32, 8]} />
        <P c="#374151" />
      </mesh>
      <mesh position={[0, 0.36, -0.2]} castShadow>
        <boxGeometry args={[0.08, 0.03, 0.1]} />
        <P c={BLACK} />
      </mesh>
    </group>
  );
}

function HoaSen() {
  const petals = (n: number, r: number, tilt: number, y: number, c: string, s: number) =>
    Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + (n === 6 ? Math.PI / 6 : 0);
      return (
        <mesh
          key={`${n}-${k}`}
          position={[Math.sin(a) * r, y, Math.cos(a) * r]}
          rotation={[tilt, a, 0]}
          scale={[0.55 * s, 1 * s, 0.3 * s]}
          castShadow
        >
          <sphereGeometry args={[0.13, 16, 12]} />
          <P c={c} rough={0.4} />
        </mesh>
      );
    });
  return (
    <group position={[0, 0.12, 0]}>
      {/* Lá sen */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.03, 24]} />
        <P c="#16A34A" rough={0.5} />
      </mesh>
      {petals(8, 0.12, 0.7, 0.16, '#F9A8D4', 1)}
      {petals(6, 0.06, 0.35, 0.22, '#EC4899', 0.85)}
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.05, 16]} />
        <P c="#FACC15" />
      </mesh>
    </group>
  );
}

function AoDai() {
  return (
    <group position={[0, 0.12, 0]}>
      {/* Quần trắng */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.24, 20]} />
        <P c={WHITE} rough={0.5} />
      </mesh>
      {/* Tà áo dài đỏ */}
      <mesh position={[0, 0.3, 0.01]} castShadow>
        <cylinderGeometry args={[0.085, 0.16, 0.42, 4, 1]} />
        <P c="#C8102E" rough={0.35} />
      </mesh>
      {/* Thân áo + cổ */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.16, 20]} />
        <P c="#C8102E" rough={0.35} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.05, 16]} />
        <P c="#C8102E" />
      </mesh>
      {/* Hoạ tiết vàng */}
      {[0.36, 0.46].map((y) => (
        <mesh key={y} position={[0, y, 0.105]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <P c={GOLD} />
        </mesh>
      ))}
      {/* Nón lá nhỏ trên đầu (đầu móc treo) */}
      <mesh position={[0, 0.69, 0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <P c="#F5D0A9" />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow>
        <coneGeometry args={[0.12, 0.09, 24]} />
        <P c="#E9C46A" rough={0.6} />
      </mesh>
    </group>
  );
}

export function TokenModel({ token, color }: { token: TokenId; color: string }) {
  return (
    // Không còn đế: hạ mô hình xuống sát mặt ô (các mẫu được dựng cao hơn 0,12 cho đế cũ)
    <group position={[0, -0.12, 0]}>
      {token === 'xe-may' && <XeMay color={color} />}
      {token === 'non-la' && <NonLa />}
      {token === 'banh-mi' && <BanhMi />}
      {token === 'ca-phe' && <CaPhe />}
      {token === 'con-trau' && <ConTrau />}
      {token === 'xich-lo' && <XichLo color={color} />}
      {token === 'hoa-sen' && <HoaSen />}
      {token === 'ao-dai' && <AoDai />}
    </group>
  );
}
