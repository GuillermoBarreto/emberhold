// Tiny Web Audio synth for game sound effects. No assets needed.

let ctx: AudioContext | null = null;
let muted = false;
let lastAttackT = 0;

export function initAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.12, when = 0): void {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  select() {
    tone(660, 0.07, 'sine', 0.08);
  },
  move() {
    tone(440, 0.09, 'sine', 0.08);
  },
  attack() {
    const now = performance.now() / 1000;
    if (now - lastAttackT < 0.09) return; // throttle battle noise
    lastAttackT = now;
    tone(180 + Math.random() * 60, 0.08, 'sawtooth', 0.05);
  },
  build() {
    tone(392, 0.1, 'triangle', 0.1);
    tone(523, 0.1, 'triangle', 0.1, 0.09);
    tone(659, 0.14, 'triangle', 0.1, 0.18);
  },
  error() {
    tone(140, 0.15, 'square', 0.07);
  },
  capture() {
    tone(880, 0.12, 'sine', 0.1);
    tone(1174, 0.16, 'sine', 0.1, 0.1);
  },
  victory() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.16));
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.18));
  },
};
