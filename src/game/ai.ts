import type { BuildingKind, UnitKind } from './types';

// Pure AI planning helpers — deterministic and unit-testable.
// The stateful controller lives in sim.ts and calls these.

export const WAVE_INTERVAL = 90; // seconds between attack waves
export const FIRST_WAVE_T = 75; // first wave at this game time
export const RECRUIT_INTERVAL = 7; // AI tries to train a unit every N seconds
export const EXPAND_T = 20; // AI sends its first expansion squad at this time
export const DEFENDERS_KEPT = 5; // AI always keeps this many units home
export const HERO_T = 100; // earliest the AI queues its hero

export const BUILD_ORDER: { t: number; kind: BuildingKind }[] = [
  { t: 8, kind: 'barracks' },
  { t: 35, kind: 'archery' },
  { t: 65, kind: 'stables' },
];

// Recruit cycle keeps a balanced mixed army.
export const RECRUIT_CYCLE: UnitKind[] = [
  'infantry',
  'infantry',
  'archer',
  'cavalry',
  'infantry',
  'archer',
];

// Wave size grows over time but is capped so waves stay beatable.
export function waveSize(waveNumber: number): number {
  return Math.min(4 + waveNumber * 2, 22);
}

// Deterministic wave composition: ~40% infantry, 30% archers, 30% cavalry.
export function planWave(waveNumber: number): UnitKind[] {
  const size = waveSize(waveNumber);
  const comp: UnitKind[] = [];
  for (let i = 0; i < size; i++) {
    const r = i % 10;
    if (r < 4) comp.push('infantry');
    else if (r < 7) comp.push('archer');
    else comp.push('cavalry');
  }
  return comp;
}

// Which building trains a unit kind (used to check the AI owns the producer).
export function producerFor(kind: UnitKind): BuildingKind {
  switch (kind) {
    case 'infantry':
      return 'barracks';
    case 'archer':
      return 'archery';
    case 'cavalry':
      return 'stables';
    case 'hero':
      return 'fortress';
  }
}
