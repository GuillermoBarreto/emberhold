import { STEP, WORLD_H, WORLD_W } from './config';
import { createTerrain, type Terrain } from './map';
import { renderMinimap } from './render';
import { updateGame } from './sim';
import { createInitialState } from './state';
import type { GameState, Plot } from './types';
import type { Camera } from './render';

const CAM_SPEED = 750;

export class Game {
  state: GameState;
  terrain: Terrain;
  cam: Camera;
  selectedUnits = new Set<number>();
  selectedBuildings = new Set<number>();
  selectedPlot: Plot | null = null;
  attackMoveMode = false;
  uiDirty = true;
  keys = new Set<string>();
  edge = { x: 0, y: 0 };
  mouseOnCanvas = false;
  dragRect: { x0: number; y0: number; x1: number; y1: number } | null = null;
  lastWaveSeen = 0;
  endShown = false;

  constructor(w: number, h: number) {
    this.terrain = createTerrain();
    this.state = createInitialState();
    this.cam = { x: 0, y: 0, w, h };
    this.centerCamera(300, WORLD_H / 2);
  }

  centerCamera(x: number, y: number): void {
    this.cam.x = Math.max(0, Math.min(WORLD_W - this.cam.w, x - this.cam.w / 2));
    this.cam.y = Math.max(0, Math.min(WORLD_H - this.cam.h, y - this.cam.h / 2));
  }

  clearSelection(): void {
    this.selectedUnits.clear();
    this.selectedBuildings.clear();
    this.selectedPlot = null;
    this.attackMoveMode = false;
    this.uiDirty = true;
  }

  reset(): void {
    this.state = createInitialState();
    this.clearSelection();
    this.lastWaveSeen = 0;
    this.endShown = false;
    this.centerCamera(300, WORLD_H / 2);
  }

  pruneSelection(): void {
    const aliveU = new Set(this.state.units.filter((u) => u.state !== 'dead').map((u) => u.id));
    for (const id of this.selectedUnits) if (!aliveU.has(id)) this.selectedUnits.delete(id);
    const aliveB = new Set(this.state.buildings.map((b) => b.id));
    for (const id of this.selectedBuildings) if (!aliveB.has(id)) this.selectedBuildings.delete(id);
    if (this.selectedPlot && this.selectedPlot.buildingId !== -1) this.selectedPlot = null;
  }

  update(dt: number): void {
    // camera
    let dx = 0;
    let dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.mouseOnCanvas) {
      dx += this.edge.x;
      dy += this.edge.y;
    }
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.cam.x += (dx / len) * CAM_SPEED * dt;
      this.cam.y += (dy / len) * CAM_SPEED * dt;
      this.cam.x = Math.max(0, Math.min(Math.max(0, WORLD_W - this.cam.w), this.cam.x));
      this.cam.y = Math.max(0, Math.min(Math.max(0, WORLD_H - this.cam.h), this.cam.y));
    }
    updateGame(this.state, this.terrain, dt);
    this.pruneSelection();
  }
}

export { STEP, renderMinimap };
