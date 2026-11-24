import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls as OrbitImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BOARD,
  CASINO_NAMES,
  GROUPS,
  casinoKindAt,
  festivalMult,
  formatMoney,
  isFestival,
  isFrozen,
  rentFor,
  type GameEvent,
  type GameState,
  type Square,
  type TokenId,
} from '@cotyphu/shared';
import { useStore } from '../store';
import {
  BOARD_UNITS,
  boardXZ,
  cx,
  fmtClock,
  playerColor,
  sideOf,
  tileIconUrl,
  useGame,
  useNow,
} from '../lib';
import { S } from '../strings.vi';
import { useMoneyFx, useRollInfo, RollBubble, EventTicker } from './BoardFx';
import { ActionBar } from './ActionBar';
import { Avatar } from './Avatar';
import { CardReveal } from './Board';
import { TokenModel } from './Tokens3D';

const HALF = BOARD_UNITS / 2;
const TILE_H = 0.16;
const BASE_H = 0.35;
const TOP = BASE_H + TILE_H; // mặt trên ô

const SPECIAL: Partial<Record<Square['kind'], string>> = {
  chest: '🧧',
  chance: '🎲',
  tax: '💸',
  parking: '☕',
  goToJail: '🚨',
  jail: '🚓',
  go: '🏁',
  transport: '📺',
  utility: '⚡',
};

/** Góc quay quanh trục Y để mép trên của hình in hướng vào giữa bàn */
function sideAngle(i: number): number {
  if (i <= 10) return i === 10 ? -Math.PI / 2 : 0;
  if (i < 20) return -Math.PI / 2;
  if (i <= 30) return i === 30 ? Math.PI / 2 : Math.PI;
  return Math.PI / 2;
}

/** Kích thước ô trước khi xoay: rộng 1 (ô góc 1,6) × sâu 1,6 */
function tileSize(i: number): [number, number] {
  return sideOf(i) === 'corner' ? [1.6, 1.6] : [1, 1.6];
}

// ---------------------------------------------------------------------------
// Hình in trên mặt ô (vẽ bằng canvas)
// ---------------------------------------------------------------------------

/** Màn hình lớn (Full HD trở lên tính theo điểm ảnh thật): vẽ chữ trên ô nét hơn */
const SCREEN_PX =
  typeof window === 'undefined'
    ? 1920
    : Math.max(window.screen.width, window.screen.height) * (window.devicePixelRatio || 1);
const HI_RES = SCREEN_PX >= 2500;
const PX = HI_RES ? 320 : 256; // px trên 1 đơn vị (Full HD cũng vẽ nét)
/** Giới hạn số điểm ảnh vẽ mỗi khung hình (giữ 2K / 4K vẫn mượt) */
const PIXEL_BUDGET = HI_RES ? 6_000_000 : 4_500_000;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

interface TileLook {
  name: string;
  icon: string;
  /** Ảnh biểu trưng SVG của ô (null: dùng emoji / logo công ty) */
  iconUrl: string | null;
  band: string | null;
  bottom: string;
  owner: string | null;
  mortgaged: boolean;
  frozen: boolean;
  fest: number;
  casino: boolean;
  corner: boolean;
}

function tileLook(
  game: GameState | null,
  room: ReturnType<typeof useGame>['room'],
  sq: Square,
): TileLook {
  const i = sq.index;
  const st = game?.properties[i];
  const ck = game ? casinoKindAt(game, i) : null;
  const free = game?.rules.mode === 'freestyle';
  const fest20 = i === 20 && (free || !!game?.rules.festivalSquare);
  let name = sq.short ?? sq.name;
  let icon = sq.kind === 'street' ? (sq.icon ?? '🏠') : (SPECIAL[sq.kind] ?? '');
  if (ck) {
    name = CASINO_NAMES[ck];
    icon = '🎰';
  }
  if (fest20) {
    name = 'Lễ Hội';
    icon = '🎉';
  }
  const price = 'price' in sq ? sq.price : null;
  let bottom = '';
  if (sq.kind === 'tax')
    bottom = `Trả ${formatMoney(sq.amount * (free ? (game?.rules.feeMult ?? 2) : 1))}`;
  else if (price !== null && !ck) {
    if (st?.owner && game && !st.mortgaged)
      bottom =
        sq.kind === 'utility'
          ? 'Thuê ×xúc xắc'
          : `Thuê ${formatMoney(rentFor(game, i, { diceTotal: 7 }))}`;
    else bottom = formatMoney(price);
  } else if (sq.kind === 'go') bottom = `+${formatMoney(game?.rules.goSalary ?? 200)}`;
  const band =
    sq.kind === 'street'
      ? GROUPS[sq.group].color
      : sq.kind === 'transport' || sq.kind === 'utility'
        ? ck
          ? null
          : sq.brandColor
        : null;
  return {
    name,
    icon,
    iconUrl: tileIconUrl(game, i),
    band,
    bottom,
    owner: st?.owner ? playerColor(room, st.owner) : null,
    mortgaged: !!st?.mortgaged,
    frozen: !!game && !!st?.owner && isFrozen(game, st.owner) && price !== null && !ck,
    fest: game && isFestival(game, i) ? festivalMult(game, i) : 0,
    casino: !!ck,
    corner: sideOf(i) === 'corner',
  };
}

// Ảnh biểu trưng ô: tải một lần, vẽ lên canvas mặt ô khi đã sẵn sàng
const TILE_IMG = new Map<string, HTMLImageElement>();
const imgListeners = new Set<() => void>();
let imgVersion = 0;
function tileImage(url: string): HTMLImageElement | null {
  let img = TILE_IMG.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imgVersion++;
      imgListeners.forEach((f) => f());
    };
    img.src = url;
    TILE_IMG.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
/** Tăng mỗi khi có thêm ảnh biểu trưng tải xong, để vẽ lại mặt ô */
function useTileImageVersion(): number {
  const [v, setV] = useState(imgVersion);
  useEffect(() => {
    const f = () => setV(imgVersion);
    imgListeners.add(f);
    f();
    return () => {
      imgListeners.delete(f);
    };
  }, []);
  return v;
}

function drawTile(look: TileLook, w: number, d: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = Math.round(w * PX);
  c.height = Math.round(d * PX);
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  g.fillStyle = look.casino ? '#2a0f3a' : look.corner ? '#FFF6E0' : '#FFFDF7';
  g.fillRect(0, 0, W, H);
  if (look.band) {
    g.fillStyle = look.band;
    g.fillRect(0, 0, W, H * 0.2);
  }
  const font = '"Be Vietnam Pro", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const img = look.iconUrl ? tileImage(look.iconUrl) : null;
  if (img) {
    const size = W * (look.corner ? 0.46 : 0.66);
    const cy = H * (look.corner ? 0.36 : 0.41);
    g.drawImage(img, (W - size) / 2, cy - size / 2, size, size);
  } else {
    g.font = `${Math.round(W * (look.corner ? 0.3 : 0.42))}px ${font}`;
    g.fillText(look.icon, W / 2, H * (look.corner ? 0.38 : 0.42));
  }
  g.fillStyle = look.casino ? '#F2A900' : '#1f2937';
  g.font = `800 ${Math.round(W * (look.corner ? 0.13 : 0.15))}px ${font}`;
  const lines = wrap(g, look.name, W * 0.9);
  lines.forEach((l, k) => g.fillText(l, W / 2, H * (look.corner ? 0.66 : 0.66) + k * W * 0.17));
  if (look.bottom) {
    g.fillStyle = look.owner ? look.owner : '#374151';
    g.fillRect(0, H * 0.86, W, H * 0.14);
    g.fillStyle = '#fff';
    g.font = `800 ${Math.round(W * 0.12)}px ${font}`;
    g.fillText(look.bottom, W / 2, H * 0.93);
  }
  if (look.owner) {
    g.strokeStyle = look.owner;
    g.lineWidth = W * 0.07;
    g.strokeRect(0, 0, W, H);
  }
  if (look.mortgaged) {
    g.fillStyle = 'rgba(100,100,100,0.55)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.font = `800 ${Math.round(W * 0.13)}px ${font}`;
    g.fillText('THẾ CHẤP', W / 2, H / 2);
  }
  if (look.frozen) {
    g.fillStyle = 'rgba(125,211,252,0.45)';
    g.fillRect(0, 0, W, H);
    g.font = `${Math.round(W * 0.2)}px ${font}`;
    g.fillText('❄️', W * 0.8, H * 0.3);
  }
  if (look.fest) {
    g.fillStyle = '#C8102E';
    g.beginPath();
    g.arc(W * 0.8, H * 0.32, W * 0.16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(W * 0.14)}px ${font}`;
    g.fillText(`×${look.fest}`, W * 0.8, H * 0.33);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

// ---------------------------------------------------------------------------
// Ô, nhà, quân cờ
// ---------------------------------------------------------------------------

function Tile({ sq, fontsReady }: { sq: Square; fontsReady: boolean }) {
  const { room, game } = useGame();
  const open = useStore((s) => s.setOpenSquare);
  const look = tileLook(game, room, sq);
  const imgVer = useTileImageVersion();
  if (look.iconUrl) tileImage(look.iconUrl);
  const key = JSON.stringify(look) + fontsReady + imgVer;
  const [w, d] = tileSize(sq.index);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(() => drawTile(look, w, d), [key]);
  useEffect(() => () => tex.dispose(), [tex]);
  const [x, z] = boardXZ(sq.index);
  const houses = game?.properties[sq.index]?.houses ?? 0;
  const ownerId = game?.properties[sq.index]?.owner;
  const owner = ownerId ? playerColor(room, ownerId) : null;
  const clickable = 'price' in sq && !(game && casinoKindAt(game, sq.index));
  return (
    <group position={[x, BASE_H, z]} rotation={[0, sideAngle(sq.index), 0]}>
      <mesh
        position={[0, TILE_H / 2, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          // Kéo xoay camera thì không tính là bấm vào ô
          if (!clickable || e.delta > 6) return;
          e.stopPropagation();
          open(sq.index);
        }}
      >
        <boxGeometry args={[w * 0.96, TILE_H, d * 0.96]} />
        <meshStandardMaterial attach="material-0" color="#e7e1d3" />
        <meshStandardMaterial attach="material-1" color="#e7e1d3" />
        <meshStandardMaterial attach="material-2" map={tex} />
        <meshStandardMaterial attach="material-3" color="#cfc7b4" />
        <meshStandardMaterial attach="material-4" color="#e7e1d3" />
        <meshStandardMaterial attach="material-5" color="#e7e1d3" />
      </mesh>
      {houses > 0 && <Buildings houses={houses} color={owner ?? '#1E9E5A'} />}
    </group>
  );
}

/** Nhà / khách sạn đặt ở mép trong ô (phía giữa bàn) */
/** Tông màu nhà theo chủ ô: tường nhạt, mái / viền đậm cùng màu người chơi */
function ownerShades(color: string): { wall: string; roof: string; trim: string } {
  const base = new THREE.Color(color);
  const wall = base.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  const trim = base.clone().lerp(new THREE.Color('#000000'), 0.3);
  return { wall: `#${wall.getHexString()}`, roof: color, trim: `#${trim.getHexString()}` };
}

function Buildings({ houses, color }: { houses: number; color: string }) {
  const c = useMemo(() => ownerShades(color), [color]);
  if (houses >= 5)
    return (
      <group position={[0, TILE_H, -0.5]}>
        {/* Khách sạn: thân màu chủ ô, mái + viền đậm */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.7, 0.44, 0.32]} />
          <meshStandardMaterial color={c.roof} />
        </mesh>
        <mesh position={[0, 0.22, 0.161]}>
          <boxGeometry args={[0.56, 0.3, 0.005]} />
          <meshStandardMaterial color={c.wall} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.76, 0.09, 0.38]} />
          <meshStandardMaterial color={c.trim} />
        </mesh>
      </group>
    );
  const xs = [-0.33, -0.11, 0.11, 0.33].slice(0, houses);
  return (
    <group position={[0, TILE_H, -0.52]}>
      {xs.map((hx) => (
        <group key={hx} position={[hx, 0, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.17, 0.2, 0.2]} />
            <meshStandardMaterial color={c.wall} />
          </mesh>
          <mesh position={[0, 0.26, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.15, 0.13, 4]} />
            <meshStandardMaterial color={c.roof} />
          </mesh>
          {/* Khung mái */}
          <mesh position={[0, 0.205, 0]}>
            <boxGeometry args={[0.2, 0.02, 0.23]} />
            <meshStandardMaterial color={c.trim} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function buildPath(from: number, events: GameEvent[], pid: string): number[] | null {
  const path = [from];
  let cur = from;
  let moved = false;
  for (const e of events) {
    if (e.t !== 'move' || e.playerId !== pid) continue;
    moved = true;
    if (e.steps === 0) path.push(e.to);
    else {
      const dir = e.steps > 0 ? 1 : -1;
      for (let k = 0; k < Math.abs(e.steps); k++) {
        cur = (cur + dir + 40) % 40;
        path.push(cur);
      }
    }
    cur = e.to;
  }
  return moved ? path : null;
}

/** Vị trí đặt quân trên ô (lệch nhau khi nhiều quân cùng ô) */
function slot(pos: number, k: number, n: number, out: THREE.Vector3): THREE.Vector3 {
  const [x, z] = boardXZ(pos);
  const off = n > 1 ? (k - (n - 1) / 2) * 0.3 : 0;
  const along = sideOf(pos) === 'left' || sideOf(pos) === 'right';
  return out.set(x + (along ? 0 : off), TOP, z + (along ? off : 0));
}

/** Mượt đầu – cuối mỗi bước */
const smooth = (t: number) => t * t * (3 - 2 * t);

function Pawn({
  id,
  color,
  token,
  active,
  slotIndex,
  slotCount,
  pathRef,
  onPos,
}: {
  id: string;
  color: string;
  token: TokenId;
  active: boolean;
  slotIndex: number;
  slotCount: number;
  pathRef: React.MutableRefObject<Record<string, { path: number[]; t0: number }>>;
  onPos: (id: string, v: THREE.Vector3) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  // Vector dùng lại mỗi khung hình (tránh tạo rác → khựng)
  const va = useMemo(() => new THREE.Vector3(), []);
  const vb = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const placed = useRef(false);
  useFrame((_, dt) => {
    const g = ref.current;
    const anim = pathRef.current[id];
    if (!g || !anim) return;
    // Đường dài thì đi nhanh hơn chút để không chờ lâu
    const STEP = anim.path.length > 8 ? 0.17 : 0.23; // giây mỗi ô
    const t = (performance.now() - anim.t0) / 1000 / STEP;
    const last = anim.path.length - 1;
    const k = Math.min(last, Math.floor(t));
    const f = k >= last ? 0 : t - k;
    slot(anim.path[k]!, k >= last ? slotIndex : 0, k >= last ? slotCount : 1, va);
    slot(anim.path[Math.min(last, k + 1)]!, 0, 1, vb);
    p.copy(va).lerp(vb, smooth(f));
    const now = performance.now() / 1000;
    p.y += Math.sin(f * Math.PI) * 0.32; // nhảy từng ô
    // Đứng yên: trượt mượt về chỗ đứng (khi nhiều quân cùng ô thì dàn ra)
    if (k >= last && placed.current) {
      const cur = g.position;
      const kk = 1 - Math.exp(-dt * 12);
      p.x = cur.x + (p.x - cur.x) * kk;
      p.z = cur.z + (p.z - cur.z) * kk;
    }
    // Người đang tới lượt: nhún nhẹ, vòng sáng dưới chân
    if (active && k >= last) p.y += 0.04 + Math.sin(now * 3.2) * 0.04;
    g.position.copy(p);
    placed.current = true;
    if (glow.current) {
      glow.current.position.set(p.x, TOP + 0.015, p.z);
      const s = 1 + Math.sin(now * 4) * 0.1;
      glow.current.scale.set(s, s, s);
    }
    onPos(id, p);
  });
  return (
    <>
      <group ref={ref}>
        <group scale={1.05}>
          <TokenModel token={token} color={color} />
        </group>
      </group>
      {active && (
        <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      )}
    </>
  );
}

function Pawns({ follow }: { follow: React.MutableRefObject<THREE.Vector3 | null> }) {
  const { room, game } = useGame();
  const events = useStore((s) => s.events);
  const pathRef = useRef<Record<string, { path: number[]; t0: number }>>({});
  const shown = useRef<Record<string, number>>({});
  const positions = useRef<Record<string, THREE.Vector3>>({});

  useEffect(() => {
    if (!game) return;
    for (const p of game.players) {
      const prev = shown.current[p.id] ?? p.position;
      const path = buildPath(prev, events.list, p.id);
      if (path && path[path.length - 1] === p.position)
        pathRef.current[p.id] = { path, t0: performance.now() };
      else if (prev !== p.position || !pathRef.current[p.id])
        pathRef.current[p.id] = { path: [p.position], t0: performance.now() };
      shown.current[p.id] = p.position;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.id, game?.seq]);

  const cur = game ? game.players[game.current]?.id : null;
  useFrame(() => {
    if (cur && positions.current[cur]) follow.current = positions.current[cur]!;
  });
  if (!game) return null;
  const stacks = new Map<number, string[]>();
  for (const p of game.players)
    if (!p.bankrupt) stacks.set(p.position, [...(stacks.get(p.position) ?? []), p.id]);
  return (
    <>
      {game.players
        .filter((p) => !p.bankrupt)
        .map((p) => {
          const st = stacks.get(p.position) ?? [p.id];
          return (
            <Pawn
              key={p.id}
              id={p.id}
              color={playerColor(room, p.id)}
              token={p.token}
              active={p.id === cur}
              slotIndex={st.indexOf(p.id)}
              slotCount={st.length}
              pathRef={pathRef}
              onPos={(id, v) => {
                const cur = positions.current[id];
                if (cur) cur.copy(v);
                else positions.current[id] = v.clone();
              }}
            />
          );
        })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Xí ngầu 3D
// ---------------------------------------------------------------------------

function pipTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = n === 1 ? '#C8102E' : '#1f2937';
  const P: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [
      [36, 36],
      [92, 92],
    ],
    3: [
      [32, 32],
      [64, 64],
      [96, 96],
    ],
    4: [
      [36, 36],
      [92, 36],
      [36, 92],
      [92, 92],
    ],
    5: [
      [34, 34],
      [94, 34],
      [64, 64],
      [34, 94],
      [94, 94],
    ],
    6: [
      [36, 30],
      [92, 30],
      [36, 64],
      [92, 64],
      [36, 98],
      [92, 98],
    ],
  };
  for (const [x, y] of P[n]!) {
    g.beginPath();
    g.arc(x, y, n === 1 ? 16 : 11, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

// Thứ tự mặt của BoxGeometry: +x, −x, +y, −y, +z, −z
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
/** Góc quay để mặt có giá trị v hướng lên trên */
const FACE_UP: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
};

function Dice() {
  const { game } = useGame();
  const events = useStore((s) => s.events);
  const mats = useMemo(
    () => FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: pipTexture(v) })),
    [],
  );
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const anim = useRef<{ t0: number; spin: [number, number, number][] } | null>(null);
  useEffect(() => {
    if (events.list.some((e) => e.t === 'roll' && e.purpose !== 'utility'))
      anim.current = {
        t0: performance.now(),
        spin: [0, 1].map(() => [
          (Math.random() * 4 + 4) * Math.PI,
          (Math.random() * 4 + 2) * Math.PI,
          (Math.random() * 4 + 3) * Math.PI,
        ]) as [number, number, number][],
      };
  }, [events.id, events.list]);
  const dice = game?.lastDice ?? [1, 1];
  useFrame(() => {
    const a = anim.current;
    const t = a ? Math.min(1, (performance.now() - a.t0) / 1100) : 1;
    const ease = 1 - Math.pow(1 - t, 3);
    refs.forEach((r, i) => {
      const m = r.current;
      if (!m) return;
      const fin = FACE_UP[dice[i]!]!;
      const sp = a?.spin[i] ?? [0, 0, 0];
      m.rotation.set(
        fin[0] + sp[0] * (1 - ease),
        fin[1] + sp[1] * (1 - ease) + i * 0.4,
        fin[2] + sp[2] * (1 - ease),
      );
      const bounce = Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 2.2;
      m.position.set(0.6 + (i === 0 ? -0.5 : 0.5), TOP + 0.3 + bounce + (1 - ease) * 1.5, 2.1);
    });
  });
  return (
    <>
      {refs.map((r, i) => (
        <mesh key={i} ref={r} material={mats} castShadow>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
        </mesh>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Nhãn nổi (tiền +/−, ô đích)
// ---------------------------------------------------------------------------

function labelTexture(text: string, bg: string): [THREE.CanvasTexture, number] {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '800 56px "Be Vietnam Pro", system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 48;
  c.width = w;
  c.height = 84;
  g.font = font;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, 84, 24);
  g.fill();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 45);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return [t, w / 84];
}

function FloatLabel({
  pos,
  text,
  bg,
  rise,
}: {
  pos: number;
  text: string;
  bg: string;
  rise?: boolean;
}) {
  const [tex, ratio] = useMemo(() => labelTexture(text, bg), [text, bg]);
  useEffect(() => () => tex.dispose(), [tex]);
  const ref = useRef<THREE.Sprite>(null);
  const t0 = useRef(performance.now());
  const [x, z] = boardXZ(pos);
  useFrame(() => {
    const s = ref.current;
    if (!s) return;
    const t = (performance.now() - t0.current) / 1000;
    s.position.set(x, TOP + 1.1 + (rise ? Math.min(1, t) * 0.8 : Math.sin(t * 3) * 0.05), z);
  });
  return (
    <sprite ref={ref} scale={[0.42 * ratio, 0.42, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} transparent />
    </sprite>
  );
}

function Fx() {
  const { game } = useGame();
  const money = useMoneyFx();
  const info = useRollInfo(3200);
  if (!game) return null;
  const target = info && !info.stay && info.to !== null ? info.to : null;
  return (
    <>
      {target !== null && (
        <>
          <FloatLabel
            key={`t${info!.key}`}
            pos={target}
            text={`📍 ${BOARD[target]!.short ?? BOARD[target]!.name}`}
            bg="#C8102E"
          />
          <TargetRing pos={target} />
        </>
      )}
      {money.map((m) => (
        <FloatLabel
          key={m.key}
          pos={m.pos}
          rise
          text={`${m.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(m.amount))}`}
          bg={m.amount > 0 ? '#0E9F8E' : '#C8102E'}
        />
      ))}
    </>
  );
}

function TargetRing({ pos }: { pos: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const [x, z] = boardXZ(pos);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const s = 1 + Math.sin(performance.now() / 180) * 0.12;
    m.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} position={[x, TOP + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.52, 40]} />
      <meshBasicMaterial color="#F2A900" transparent opacity={0.95} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Mặt bàn, giữa bàn, thành phố xung quanh
// ---------------------------------------------------------------------------

function centerTexture(fontsReady: boolean): THREE.CanvasTexture {
  void fontsReady;
  const c = document.createElement('canvas');
  c.width = c.height = 2048;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  g.fillStyle = '#F4EEDC';
  g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = '#E3B5B5';
  g.lineWidth = 6;
  g.strokeRect(40, 40, 944, 944);
  const font = '"Be Vietnam Pro", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(512, 470);
  g.rotate(-0.18);
  g.fillStyle = '#C8102E';
  g.font = `900 130px ${font}`;
  g.fillText('CỜ TỶ PHÚ!', 0, 0);
  g.fillStyle = '#F2A900';
  g.beginPath();
  g.roundRect(-150, 70, 300, 100, 24);
  g.fill();
  g.fillStyle = '#7a1020';
  g.font = `900 80px ${font}`;
  g.fillText('CLB30', 0, 122);
  g.restore();
  // Khung đặt thẻ
  const card = (x: number, y: number, label: string, color: string) => {
    g.setLineDash([18, 12]);
    g.strokeStyle = color;
    g.lineWidth = 8;
    g.strokeRect(x - 130, y - 85, 260, 170);
    g.setLineDash([]);
    g.fillStyle = color;
    g.font = `900 44px ${font}`;
    g.fillText(label, x, y + 125);
  };
  card(250, 250, 'CƠ HỘI', '#D97706');
  card(774, 774, 'KHÍ VẬN', '#C8102E');
  // Tiền rải
  const bill = (x: number, y: number, r: number, color: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(r);
    g.fillStyle = color;
    g.fillRect(-80, -34, 160, 68);
    g.fillStyle = '#fff';
    g.font = `900 34px ${font}`;
    g.fillText('500 tr', 0, 2);
    g.restore();
  };
  bill(780, 210, 0.3, '#22C55E');
  bill(200, 760, -0.4, '#EC4899');
  bill(600, 820, 0.2, '#38BDF8');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

function Table({ fontsReady }: { fontsReady: boolean }) {
  const tex = useMemo(() => centerTexture(fontsReady), [fontsReady]);
  const inner = BOARD_UNITS - 3.2;
  return (
    <group>
      {/* Đế bàn */}
      <mesh position={[0, BASE_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[BOARD_UNITS + 0.5, BASE_H, BOARD_UNITS + 0.5]} />
        <meshStandardMaterial color="#1E9E5A" />
      </mesh>
      {/* Mặt giữa */}
      <mesh position={[0, BASE_H + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[inner, inner]} />
        <meshStandardMaterial map={tex} />
      </mesh>
      {/* Chồng thẻ Cơ Hội / Khí Vận */}
      {(
        [
          [-inner * 0.256, -inner * 0.256, '#F2A900'],
          [inner * 0.256, inner * 0.256, '#C8102E'],
        ] as const
      ).map(([x, z, color]) => (
        <mesh key={color} position={[x, BASE_H + 0.12, z]} rotation={[0, -0.4, 0]} castShadow>
          <boxGeometry args={[1.5, 0.22, 1.0]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* Túi tiền */}
      <group position={[-2.5, BASE_H, 1.7]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.55, 20, 16]} />
          <meshStandardMaterial color="#9A5B2B" />
        </mesh>
        <mesh position={[0, 1.08, 0]} castShadow>
          <coneGeometry args={[0.28, 0.35, 12]} />
          <meshStandardMaterial color="#7C4A22" />
        </mesh>
        <mesh position={[0, 0.55, 0.53]}>
          <circleGeometry args={[0.22, 24]} />
          <meshStandardMaterial color="#F2A900" />
        </mesh>
      </group>
    </group>
  );
}

/** Thành phố low-poly quanh bàn: cỏ, đường, cây, nhà, cột đèn */
function City({ lite }: { lite: boolean }) {
  const R = HALF + 1.6; // tâm đường
  const trees = useMemo(() => {
    const out: [number, number, number][] = [];
    const n = lite ? 14 : 34;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = R + 2.2 + (k % 3) * 0.9;
      out.push([Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, 0.7 + (k % 4) * 0.15]);
    }
    return out;
  }, [R, lite]);
  const blocks = useMemo(
    () =>
      lite
        ? []
        : ([
            [-R - 4, -R + 2, '#FDE68A', 1.6],
            [R + 4.2, -R + 4, '#BFDBFE', 2.4],
            [-R + 3, -R - 4.5, '#FCA5A5', 1.8],
            [R - 2, R + 4.5, '#C4B5FD', 2.2],
            [-R - 4.5, R - 1, '#A7F3D0', 1.4],
          ] as [number, number, string, number][]),
    [R, lite],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#8BD36A" />
      </mesh>
      {/* Đường vòng quanh bàn */}
      {[0, 1, 2, 3].map((k) => {
        const horiz = k % 2 === 0;
        const sign = k < 2 ? 1 : -1;
        return (
          <mesh
            key={k}
            rotation={[-Math.PI / 2, 0, 0]}
            position={horiz ? [0, 0.005, sign * R] : [sign * R, 0.005, 0]}
            receiveShadow
          >
            <planeGeometry args={horiz ? [2 * R + 2.2, 2.2] : [2.2, 2 * R + 2.2]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
        );
      })}
      {/* Vạch kẻ đường */}
      {Array.from({ length: 28 }, (_, k) => {
        const side = Math.floor(k / 7);
        const t = ((k % 7) - 3) * 2.4;
        const horiz = side % 2 === 0;
        const sign = side < 2 ? 1 : -1;
        return (
          <mesh
            key={`d${k}`}
            rotation={[-Math.PI / 2, 0, horiz ? 0 : Math.PI / 2]}
            position={horiz ? [t, 0.01, sign * R] : [sign * R, 0.01, t]}
          >
            <planeGeometry args={[1.1, 0.12]} />
            <meshBasicMaterial color="#F9FAFB" />
          </mesh>
        );
      })}
      {trees.map(([x, z, s], k) => (
        <group key={k} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.7, 6]} />
            <meshStandardMaterial color="#7C4A22" />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color={k % 2 ? '#22A04B' : '#2FB35A'} flatShading />
          </mesh>
        </group>
      ))}
      {blocks.map(([x, z, color, h], k) => (
        <group key={k} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[2.4, h, 1.8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, h + 0.15, 0]}>
            <boxGeometry args={[2.6, 0.3, 2]} />
            <meshStandardMaterial color="#B91C1C" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera: kéo để xoay, chụm để phóng to; tự lướt theo người đang tới lượt
// ---------------------------------------------------------------------------

function Controls({ follow }: { follow: React.MutableRefObject<THREE.Vector3 | null> }) {
  const { camera, gl } = useThree();
  const { game } = useGame();
  const controls = useMemo(() => {
    const c = new OrbitImpl(camera, gl.domElement);
    c.enableDamping = true;
    c.maxPolarAngle = Math.PI / 2.3;
    c.minDistance = 6;
    c.maxDistance = 26;
    c.enablePan = false;
    return c;
  }, [camera, gl]);
  const auto = useRef(true);
  useEffect(() => {
    const off = () => (auto.current = false);
    controls.addEventListener('start', off);
    return () => {
      controls.removeEventListener('start', off);
      controls.dispose();
    };
  }, [controls]);
  // Lượt mới: lại tự lướt theo người chơi
  useEffect(() => {
    auto.current = true;
  }, [game?.turn]);
  const want = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (auto.current && follow.current) {
      want.copy(follow.current).multiplyScalar(0.3);
      want.y = 0;
      // Giảm chấn theo thời gian thực: mượt như nhau ở 30, 60 hay 144 khung hình/giây
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 2.2);
      want.sub(controls.target).multiplyScalar(k);
      controls.target.add(want);
      camera.position.add(want);
    }
    controls.update();
  });
  return null;
}

function Scene({ lite }: { lite: boolean }) {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    void document.fonts?.ready.then(() => setFontsReady(true));
  }, []);
  const follow = useRef<THREE.Vector3 | null>(null);
  return (
    <>
      <color attach="background" args={['#BFE6FF']} />
      <fog attach="fog" args={['#BFE6FF', 30, 60]} />
      <hemisphereLight args={['#ffffff', '#88aa77', 0.9]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.5}
        castShadow={!lite}
        shadow-mapSize={HI_RES ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <City lite={lite} />
      <Table fontsReady={fontsReady} />
      {BOARD.map((sq) => (
        <Tile key={sq.index} sq={sq} fontsReady={fontsReady} />
      ))}
      <Pawns follow={follow} />
      <Dice />
      <Fx />
      <Controls follow={follow} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Khung 3D + bảng điều khiển phẳng nổi bên trên
// ---------------------------------------------------------------------------

function Hud() {
  const { room, game } = useGame();
  const now = useNow(250);
  if (!room || !game) return null;
  const cur = game.players[game.current]!;
  const ph = game.phase;
  const actorId = ph.kind === 'raiseFunds' ? ph.debtor : cur.id;
  const actor = game.players.find((p) => p.id === actorId) ?? cur;
  const left = room.deadline ? room.deadline - now : null;
  return (
    <div className="pointer-events-auto w-full rounded-2xl bg-white/90 p-[1.6cqw] shadow-card backdrop-blur dark:bg-black/70">
      {ph.kind !== 'gameOver' && (
        <div
          className="mb-[1cqw] flex items-center justify-center gap-[1cqw]"
          style={{ fontSize: 'max(11px,1.7cqw)' }}
        >
          <Avatar token={actor.token} color={playerColor(room, actorId)} size={22} />
          <b>{S.game.turnOf(actor.name)}</b>
          {left !== null && (
            <span
              className={cx('font-bold tabular-nums', left < 10_000 ? 'text-son' : 'text-ngoc-600')}
            >
              ⏱ {fmtClock(left)}
            </span>
          )}
        </div>
      )}
      <ActionBar />
    </div>
  );
}

class GlBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean }> {
  override state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  override render() {
    return this.state.err ? this.props.fallback : this.props.children;
  }
}

/**
 * Theo dõi thời gian vẽ mỗi khung: chậm (dưới ~45 khung/giây) thì hạ độ nét 15%,
 * nhanh trở lại (trên ~57 khung/giây) thì nâng dần, để chuyển động luôn mượt.
 */
function PerfGuard({ onQuality }: { onQuality: (f: (q: number) => number) => void }) {
  const acc = useRef({ t: 0, n: 0, warm: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.warm += dt;
    if (a.warm < 2) return; // bỏ qua lúc mới tải
    a.t += dt;
    a.n++;
    if (a.t < 1.2) return;
    const avg = a.t / a.n;
    a.t = 0;
    a.n = 0;
    if (avg > 1 / 45) onQuality((q) => Math.max(0.55, q * 0.85));
    else if (avg < 1 / 57) onQuality((q) => Math.min(1, q * 1.08));
  });
  return null;
}

/** Độ phân giải vẽ: theo màn hình nhưng không vượt ngân sách điểm ảnh */
function useAdaptiveDpr(lite: boolean): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const area = Math.max(1, r.width * r.height);
      const device = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 2);
      const fit = Math.sqrt((lite ? 1_200_000 : PIXEL_BUDGET) / area);
      setDpr(Math.max(lite ? 0.75 : 1, Math.min(device, fit)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lite]);
  return [ref, dpr];
}

export default function Board3D({ fill }: { fill?: boolean }) {
  const setShape = useStore((s) => s.setBoardShape);
  const lite =
    typeof window !== 'undefined' &&
    (window.innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 2);
  const [box, baseDpr] = useAdaptiveDpr(lite);
  // Chất lượng tự điều chỉnh theo tốc độ khung hình thực tế
  const [quality, setQuality] = useState(1);
  // Khi máy chậm chỉ hạ phần vượt độ nét gốc của màn hình, không vẽ thấp hơn 1:1 (tránh mờ)
  const floor = lite ? 0.75 : Math.min(1, baseDpr);
  const dpr = Math.max(floor, baseDpr * quality);
  const fallback = (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl bg-white/80 p-4 text-center">
      <div>{S.shape.no3d}</div>
      <button
        type="button"
        className="rounded-xl bg-son px-3 py-2 font-bold text-white"
        onClick={() => setShape('square')}
      >
        {S.shape.back2d}
      </button>
    </div>
  );
  return (
    <GlBoundary fallback={fallback}>
      <div
        ref={box}
        className={cx(
          'relative w-full overflow-hidden rounded-2xl shadow-card',
          fill ? 'h-full' : 'aspect-square',
        )}
      >
        <Canvas
          shadows={!lite}
          dpr={dpr}
          camera={{ position: [0, 15.5, 13.5], fov: fill ? 38 : 42 }}
          gl={{ antialias: !lite, powerPreference: 'high-performance' }}
        >
          <Scene lite={lite} />
          <PerfGuard onQuality={setQuality} />
        </Canvas>
        <EventTicker />
        {/* Lớp phẳng: giữ kích thước vừa phải dù màn hình rất rộng (2K / 4K) */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(100%,880px)] -translate-x-1/2 [container-type:inline-size]">
          <RollBubble />
          <div className="pointer-events-auto">
            <CardReveal />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-[2%] left-1/2 w-[clamp(19rem,46%,38rem)] -translate-x-1/2 [container-type:inline-size]">
          <Hud />
        </div>
      </div>
    </GlBoundary>
  );
}
