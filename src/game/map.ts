import { BRIDGE_Y0, BRIDGE_Y1, RIVER_HALF, RIVER_SLOW, RIVER_X, WORLD_H, WORLD_W } from './config';

export interface Terrain {
  mountains: { x: number; y: number; r: number }[];
  forests: { x: number; y: number; r: number }[];
  // deterministic pseudo-random offsets for pretty rendering
  blobs: { x: number; y: number; r: number; shade: number }[];
  trees: { x: number; y: number; s: number }[];
}

// Deterministic PRNG so the map looks the same every game.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTerrain(): Terrain {
  const rnd = mulberry32(1337);
  const mountains = [
    { x: 180, y: 180, r: 110 },
    { x: WORLD_W - 180, y: 180, r: 110 },
    { x: 180, y: WORLD_H - 180, r: 110 },
    { x: WORLD_W - 180, y: WORLD_H - 180, r: 110 },
    { x: RIVER_X, y: 110, r: 90 },
    { x: RIVER_X, y: WORLD_H - 110, r: 90 },
  ];
  const forestCenters = [
    { x: 760, y: 320 },
    { x: 1800, y: 1280 },
    { x: 660, y: 1260 },
    { x: 1920, y: 340 },
    { x: 420, y: 800 },
    { x: 2140, y: 800 },
  ];
  const forests = forestCenters.map((c) => ({ ...c, r: 120 + rnd() * 60 }));
  const blobs: Terrain['blobs'] = [];
  for (let i = 0; i < 90; i++) {
    blobs.push({
      x: rnd() * WORLD_W,
      y: rnd() * WORLD_H,
      r: 40 + rnd() * 130,
      shade: rnd(),
    });
  }
  const trees: Terrain['trees'] = [];
  for (const f of forests) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * f.r;
      trees.push({ x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, s: 0.7 + rnd() * 0.7 });
    }
  }
  return { mountains, forests, blobs, trees };
}

export function isBlocked(t: Terrain, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return true;
  for (const m of t.mountains) {
    const dx = x - m.x;
    const dy = y - m.y;
    if (dx * dx + dy * dy < (m.r - 6) * (m.r - 6)) return true;
  }
  return false;
}

export function inRiver(x: number, y: number): boolean {
  return Math.abs(x - RIVER_X) < RIVER_HALF && !(y > BRIDGE_Y0 - 20 && y < BRIDGE_Y1 + 20);
}

export function speedFactor(x: number, y: number): number {
  return inRiver(x, y) ? RIVER_SLOW : 1;
}

// If the straight path crosses the river, route via the bridge first.
export function riverWaypoint(x: number, y: number, tx: number, ty: number): { x: number; y: number } | null {
  const a = x - RIVER_X;
  const b = tx - RIVER_X;
  if (a === 0 || b === 0 || Math.sign(a) === Math.sign(b)) return null;
  if (Math.abs(a) < RIVER_HALF + 30) return null; // already at the crossing
  return { x: RIVER_X, y: 800 };
}
