import type { GameEvent } from '@cotyphu/shared';

/** Âm thanh ngắn tổng hợp bằng Web Audio (không cần file) */

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('cotyphu:muted') === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}
export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem('cotyphu:muted', v ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  dice() {
    for (let i = 0; i < 6; i++) tone(300 + Math.random() * 500, i * 0.05, 0.05, 'square', 0.05);
  },
  step(n: number) {
    for (let i = 0; i < Math.min(n, 12); i++) tone(520, 0.45 + i * 0.16, 0.05, 'triangle', 0.06);
  },
  money() {
    tone(988, 0, 0.12, 'sine', 0.1);
    tone(1319, 0.08, 0.25, 'sine', 0.1);
  },
  pay() {
    tone(440, 0, 0.12, 'triangle', 0.1);
    tone(330, 0.1, 0.2, 'triangle', 0.1);
  },
  jail() {
    tone(220, 0, 0.25, 'sawtooth', 0.07);
    tone(165, 0.22, 0.4, 'sawtooth', 0.07);
  },
  turn() {
    tone(660, 0, 0.1);
    tone(880, 0.1, 0.18);
  },
  bid() {
    tone(740, 0, 0.08, 'square', 0.05);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.1));
  },
};

export function playForEvents(events: GameEvent[], me: string | null) {
  const types = new Set(events.map((e) => e.t));
  if (events.some((e) => e.t === 'roll')) sfx.dice();
  const mv = events.find((e) => e.t === 'move' && e.steps > 0);
  if (mv && mv.t === 'move') sfx.step(mv.steps);
  if (types.has('jail')) sfx.jail();
  else if (
    events.some(
      (e) =>
        (e.t === 'pay' && e.to === me) ||
        (e.t === 'collect' && e.playerId === me) ||
        (e.t === 'passGo' && e.playerId === me),
    )
  )
    sfx.money();
  else if (events.some((e) => e.t === 'pay' && e.from === me)) sfx.pay();
  if (types.has('bid')) sfx.bid();
  if (events.some((e) => e.t === 'turnStart' && e.playerId === me)) sfx.turn();
  if (types.has('gameOver')) sfx.win();
}
