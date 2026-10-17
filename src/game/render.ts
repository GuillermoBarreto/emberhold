import { BUILDINGS, BUILDING_NAMES, UNITS, WORLD_H, WORLD_W } from './config';
import { createTerrain, inRiver, type Terrain } from './map';
import type { Building, GameState, Mine, Side, Unit } from './types';

export interface Camera {
  x: number; // top-left world coords
  y: number;
  w: number; // viewport size (set from canvas)
  h: number;
}

const TEAM = ['#3b82f6', '#ef4444'] as const; // blue player, red AI
const TEAM_DARK = ['#1d4ed8', '#b91c1c'] as const;

let terrainCanvas: HTMLCanvasElement | null = null;
let miniCanvas: HTMLCanvasElement | null = null;

function teamColor(side: Side): string {
  return TEAM[side];
}

export function getTerrain(): Terrain {
  return createTerrain();
}

// ---- terrain pre-render ----

export function prerenderTerrain(t: Terrain): void {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const g = c.getContext('2d')!;

  // grass base
  g.fillStyle = '#2d4a22';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  for (const b of t.blobs) {
    g.fillStyle = b.shade > 0.5 ? 'rgba(70,110,50,0.35)' : 'rgba(35,60,28,0.35)';
    g.beginPath();
    g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    g.fill();
  }

  // river
  g.fillStyle = '#1e5f8a';
  g.fillRect(1280 - 70, 0, 140, WORLD_H);
  g.fillStyle = 'rgba(120,190,230,0.25)';
  for (let y = 0; y < WORLD_H; y += 46) {
    g.fillRect(1280 - 70, y, 140, 8);
  }
  // bridge (the crossing)
  g.fillStyle = '#7a5c38';
  g.fillRect(1280 - 70, 700, 140, 200);
  g.fillStyle = '#5d452a';
  for (let y = 700; y < 900; y += 25) g.fillRect(1280 - 70, y, 140, 4);
  g.strokeStyle = '#3d2f1c';
  g.lineWidth = 6;
  g.strokeRect(1280 - 70, 700, 140, 200);

  // forests
  for (const tr of t.trees) {
    const s = tr.s;
    g.fillStyle = '#1e3d1a';
    g.beginPath();
    g.arc(tr.x, tr.y, 13 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2f5c26';
    g.beginPath();
    g.arc(tr.x - 3 * s, tr.y - 4 * s, 8 * s, 0, Math.PI * 2);
    g.fill();
  }

  // mountains (blocked)
  for (const m of t.mountains) {
    const grad = g.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.1, m.x, m.y, m.r);
    grad.addColorStop(0, '#8a8f96');
    grad.addColorStop(1, '#4a4e55');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(m.x - m.r * 0.25, m.y - m.r * 0.3, m.r * 0.28, 0, Math.PI * 2);
    g.fill();
  }

  terrainCanvas = c;

  // minimap base
  const mc = document.createElement('canvas');
  mc.width = 220;
  mc.height = 138;
  const mg = mc.getContext('2d')!;
  mg.drawImage(c, 0, 0, 220, 138);
  miniCanvas = mc;
}

// ---- world rendering ----

function drawUnitShape(g: CanvasRenderingContext2D, u: Unit): void {
  const r = UNITS[u.kind].radius;
  g.fillStyle = teamColor(u.side);
  g.strokeStyle = TEAM_DARK[u.side];
  g.lineWidth = 2;
  switch (u.kind) {
    case 'infantry':
      g.beginPath();
      g.arc(u.x, u.y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = '#e5e7eb';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(u.x - 4, u.y + 5);
      g.lineTo(u.x + 4, u.y - 5);
      g.stroke();
      break;
    case 'archer':
      g.beginPath();
      g.moveTo(u.x, u.y - r);
      g.lineTo(u.x + r, u.y);
      g.lineTo(u.x, u.y + r);
      g.lineTo(u.x - r, u.y);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'cavalry':
      g.beginPath();
      g.moveTo(u.x, u.y - r - 2);
      g.lineTo(u.x + r, u.y + r);
      g.lineTo(u.x - r, u.y + r);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'hero':
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (-Math.PI / 2 + (i * 2 * Math.PI) / 5) as number;
        const px = u.x + Math.cos(a) * (r + 3);
        const py = u.y + Math.sin(a) * (r + 3);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#fbbf24';
      g.beginPath();
      g.arc(u.x, u.y, 4, 0, Math.PI * 2);
      g.fill();
      break;
  }
  // war-cry buff ring
  if (u.buffT > 0) {
    g.strokeStyle = 'rgba(251,191,36,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(u.x, u.y, r + 5, 0, Math.PI * 2);
    g.stroke();
  }
  // hit flash
  if (u.flashT > 0) {
    g.fillStyle = `rgba(255,255,255,${Math.min(0.7, u.flashT * 5)})`;
    g.beginPath();
    g.arc(u.x, u.y, r + 2, 0, Math.PI * 2);
    g.fill();
  }
}

function drawBuilding(g: CanvasRenderingContext2D, b: Building): void {
  const spec = BUILDINGS[b.kind];
  const half = spec.size;
  const col = teamColor(b.side);
  if (b.underConstruction) {
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(b.x - half, b.y - half, half * 2, half * 2);
    g.setLineDash([]);
    const done = 1 - b.buildT / spec.buildTime;
    g.fillStyle = 'rgba(120,90,50,0.85)';
    g.fillRect(b.x - half, b.y - half, half * 2 * Math.max(0.05, done), half * 2);
  } else {
    g.fillStyle = '#3f3a33';
    g.fillRect(b.x - half, b.y - half, half * 2, half * 2);
    g.fillStyle = col;
    g.fillRect(b.x - half, b.y - half, half * 2, 10);
    g.strokeStyle = TEAM_DARK[b.side];
    g.lineWidth = 3;
    g.strokeRect(b.x - half, b.y - half, half * 2, half * 2);
    // kind glyph
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const glyph = b.kind === 'fortress' ? '♜' : b.kind === 'barracks' ? '⚔' : b.kind === 'archery' ? '➶' : '♞';
    g.fillText(glyph, b.x, b.y + 2);
    g.font = '11px sans-serif';
    g.fillStyle = '#fff';
    g.fillText(BUILDING_NAMES[b.kind], b.x, b.y + half + 12);
  }
  // hp bar
  const w = half * 2;
  const pct = Math.max(0, b.hp / b.maxHp);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(b.x - half, b.y - half - 10, w, 6);
  g.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#ef4444';
  g.fillRect(b.x - half, b.y - half - 10, w * pct, 6);
  // rally flag
  if (!b.underConstruction && b.kind !== 'fortress') {
    g.strokeStyle = col;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(b.rallyX, b.rallyY - 12);
    g.lineTo(b.rallyX, b.rallyY + 6);
    g.stroke();
    g.fillStyle = col;
    g.fillRect(b.rallyX, b.rallyY - 12, 10, 7);
  }
}

function drawMine(g: CanvasRenderingContext2D, m: Mine): void {
  g.fillStyle = '#6b5b2e';
  g.beginPath();
  g.arc(m.x, m.y, 26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fbbf24';
  g.beginPath();
  g.arc(m.x, m.y, 15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#92690f';
  g.font = 'bold 16px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', m.x, m.y + 1);
  // owner ring
  const ring = m.owner === -1 ? 'rgba(160,160,160,0.7)' : teamColor(m.owner as Side);
  g.strokeStyle = ring;
  g.lineWidth = 3;
  g.setLineDash(m.owner === -1 ? [8, 6] : []);
  g.beginPath();
  g.arc(m.x, m.y, 34, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  // capture progress
  if (m.progress > 0 && m.owner !== m.progSide) {
    g.strokeStyle = teamColor(m.progSide);
    g.lineWidth = 5;
    g.beginPath();
    g.arc(m.x, m.y, 42, -Math.PI / 2, -Math.PI / 2 + (m.progress / 2.5) * Math.PI * 2);
    g.stroke();
  }
}

function drawEffect(g: CanvasRenderingContext2D, e: GameState['effects'][number]): void {
  const k = e.t / e.total;
  switch (e.kind) {
    case 'move':
      g.strokeStyle = `rgba(74,222,128,${1 - k})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(e.x, e.y, 6 + k * 18, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'hit':
      g.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
      g.beginPath();
      g.arc(e.x, e.y, 4 + k * 10, 0, Math.PI * 2);
      g.fill();
      break;
    case 'death':
      g.fillStyle = `rgba(60,40,30,${0.7 * (1 - k)})`;
      g.beginPath();
      g.arc(e.x, e.y, 10 + k * 14, 0, Math.PI * 2);
      g.fill();
      break;
    case 'warcry':
      g.strokeStyle = `rgba(251,191,36,${1 - k})`;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(e.x, e.y, 20 + k * 240, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'capture':
      g.strokeStyle = `rgba(251,191,36,${1 - k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(e.x, e.y, 34 + k * 30, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'builddone':
      g.fillStyle = `rgba(74,222,128,${0.5 * (1 - k)})`;
      g.beginPath();
      g.arc(e.x, e.y, 20 + k * 50, 0, Math.PI * 2);
      g.fill();
      break;
  }
}

export function renderWorld(
  g: CanvasRenderingContext2D,
  s: GameState,
  cam: Camera,
  selected: Set<number>,
  selBuildings: Set<number>,
  dragRect: { x0: number; y0: number; x1: number; y1: number } | null,
): void {
  if (!terrainCanvas) return;
  g.clearRect(0, 0, cam.w, cam.h);
  g.drawImage(terrainCanvas, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
  g.save();
  g.translate(-cam.x, -cam.y);

  // build plots
  for (const p of s.plots) {
    if (p.buildingId !== -1) continue;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.strokeRect(p.x - 30, p.y - 30, 60, 60);
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = '16px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('+', p.x, p.y);
  }

  for (const m of s.mines) drawMine(g, m);
  for (const b of s.buildings) drawBuilding(g, b);

  // selection circles under units
  for (const u of s.units) {
    if (u.state === 'dead') continue;
    if (selected.has(u.id)) {
      g.strokeStyle = '#4ade80';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(u.x, u.y, UNITS[u.kind].radius + 6, 0, Math.PI * 2);
      g.stroke();
    }
  }
  for (const b of s.buildings) {
    if (selBuildings.has(b.id)) {
      const half = BUILDINGS[b.kind].size;
      g.strokeStyle = '#4ade80';
      g.lineWidth = 2.5;
      g.strokeRect(b.x - half - 5, b.y - half - 5, half * 2 + 10, half * 2 + 10);
    }
  }

  for (const u of s.units) {
    if (u.state === 'dead') {
      g.save();
      g.globalAlpha = Math.max(0, u.deadT / 0.7) * 0.7;
      drawUnitShape(g, u);
      g.restore();
      continue;
    }
    drawUnitShape(g, u);
    // hp bar when damaged or selected
    if (u.hp < u.maxHp || selected.has(u.id)) {
      const w = 26;
      const pct = Math.max(0, u.hp / u.maxHp);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(u.x - w / 2, u.y - UNITS[u.kind].radius - 10, w, 5);
      g.fillStyle = u.side === 0 ? '#4ade80' : '#ef4444';
      g.fillRect(u.x - w / 2, u.y - UNITS[u.kind].radius - 10, w * pct, 5);
    }
  }

  for (const e of s.effects) drawEffect(g, e);

  g.restore();

  // drag-select rectangle (screen space)
  if (dragRect) {
    const x = Math.min(dragRect.x0, dragRect.x1);
    const y = Math.min(dragRect.y0, dragRect.y1);
    const w = Math.abs(dragRect.x1 - dragRect.x0);
    const h = Math.abs(dragRect.y1 - dragRect.y0);
    g.fillStyle = 'rgba(74,222,128,0.12)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#4ade80';
    g.lineWidth = 1.5;
    g.strokeRect(x, y, w, h);
  }
}

export function renderMinimap(
  mg: CanvasRenderingContext2D,
  s: GameState,
  cam: Camera,
  w: number,
  h: number,
): void {
  if (!miniCanvas) return;
  mg.clearRect(0, 0, w, h);
  mg.drawImage(miniCanvas, 0, 0, w, h);
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  for (const m of s.mines) {
    mg.fillStyle = m.owner === -1 ? '#9ca3af' : teamColor(m.owner as Side);
    mg.fillRect(m.x * sx - 2, m.y * sy - 2, 4, 4);
  }
  for (const b of s.buildings) {
    mg.fillStyle = teamColor(b.side);
    const bs = BUILDINGS[b.kind].size * sx * 2;
    mg.fillRect(b.x * sx - bs / 2, b.y * sy - bs / 2, bs, bs);
  }
  for (const u of s.units) {
    if (u.state === 'dead') continue;
    mg.fillStyle = teamColor(u.side);
    mg.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
  }
  // camera viewport
  mg.strokeStyle = '#fff';
  mg.lineWidth = 1.5;
  mg.strokeRect(cam.x * sx, cam.y * sy, cam.w * sx, cam.h * sy);
}

export function worldFromMinimap(mx: number, my: number, w: number, h: number): { x: number; y: number } {
  return { x: (mx / w) * WORLD_W, y: (my / h) * WORLD_H };
}

export { inRiver };
