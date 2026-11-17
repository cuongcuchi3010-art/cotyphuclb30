import { create } from 'zustand';

/**
 * Nhạc nền vui nhộn tổng hợp bằng Web Audio (không cần file, không vướng bản quyền).
 * Giai điệu ngũ cung (Đô–Rê–Mi–Son–La) kiểu dân gian, nhịp nhanh, lặp 8 ô nhịp.
 */

const KEY = 'cotyphu:music';

export const useMusic = create<{ on: boolean; playing: boolean }>(() => ({
  on: (() => {
    try {
      return localStorage.getItem(KEY) !== '0'; // mặc định bật
    } catch {
      return true;
    }
  })(),
  playing: false,
}));

const BPM = 118;
const EIGHTH = 60 / BPM / 2;
const LOOKAHEAD = 0.15;

// Tần số nốt (Hz)
const N: Record<string, number> = {
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G2: 98.0,
  A2: 110.0,
};

// Giai điệu: 8 ô nhịp × 8 móc đơn. '-' = ngân nốt trước, '.' = lặng
const MELODY = [
  'E5 G5 A5 - G5 E5 D5 .',
  'C5 D5 E5 G5 E5 - D5 .',
  'E5 G5 A5 C5 A5 G5 E5 .',
  'D5 E5 D5 C5 A4 - . .',
  'G4 A4 C5 D5 E5 - G5 .',
  'A5 G5 E5 D5 E5 - C5 .',
  'D5 E5 G5 E5 D5 C5 A4 .',
  'C5 - D5 E5 C5 - . .',
]
  .join(' ')
  .split(' ');

// Hợp âm mỗi ô nhịp: C – Am – F – G (lặp)
const CHORDS: [string, string[]][] = [
  ['C3', ['C4', 'E4', 'G4']],
  ['A2', ['A3', 'C4', 'E4']],
  ['F3', ['F4', 'A4', 'C5']],
  ['G2', ['G3', 'D4', 'G4']],
  ['C3', ['C4', 'E4', 'G4']],
  ['A2', ['A3', 'C4', 'E4']],
  ['F3', ['F4', 'A4', 'C5']],
  ['G2', ['G3', 'D4', 'G4']],
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;

function tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hat(t: number, gain: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.06);
}

function kick(t: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

/** Độ dài nốt (số móc đơn) tính cả các dấu ngân '-' phía sau */
function noteLength(i: number): number {
  let n = 1;
  while (MELODY[(i + n) % MELODY.length] === '-') n++;
  return n;
}

function scheduleStep(i: number, t: number) {
  const bar = Math.floor(i / 8) % CHORDS.length;
  const beat = i % 8;
  const [bass, chord] = CHORDS[bar]!;
  // Giai điệu (tiếng gảy kiểu đàn tranh)
  const m = MELODY[i % MELODY.length]!;
  if (m !== '-' && m !== '.') {
    const len = noteLength(i % MELODY.length) * EIGHTH;
    tone(N[m]!, t, Math.max(0.25, len * 0.95), 'triangle', 0.32);
    tone(N[m]! * 2, t, 0.12, 'sine', 0.05); // ánh kim nhẹ
  }
  // Bass nhảy quãng 8 theo phách
  if (beat % 2 === 0) tone(N[bass]! * (beat % 4 === 2 ? 2 : 1), t, EIGHTH * 1.6, 'sine', 0.35);
  // Hợp âm đệm nảy ở phách nghịch
  if (beat % 2 === 1) for (const c of chord) tone(N[c]!, t, EIGHTH * 0.7, 'square', 0.035);
  // Trống
  if (beat === 0 || beat === 4) kick(t);
  hat(t, beat % 2 ? 0.08 : 0.04);
}

function tick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(step, nextTime);
    nextTime += EIGHTH;
    step = (step + 1) % (CHORDS.length * 8);
  }
}

export function startMusic() {
  if (!useMusic.getState().on || timer) return;
  try {
    ctx ??= new AudioContext();
  } catch {
    return;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 1.5); // nhỏ, không át tiếng nói
  nextTime = ctx.currentTime + 0.1;
  step = 0;
  timer = setInterval(tick, 30);
  useMusic.setState({ playing: true });
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  }
  useMusic.setState({ playing: false });
}

export function setMusicOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
  useMusic.setState({ on });
  if (on) startMusic();
  else stopMusic();
}
