import { BUILDINGS } from './config';
import { Game } from './game';
import {
  buildingAt,
  enemyAt,
  issueAttackBuilding,
  issueAttackMove,
  issueAttackUnit,
  issueMove,
  plotAt,
  setRally,
  startBuild,
  queueUnit,
  unitAt,
  useWarcry,
} from './sim';
import { worldFromMinimap } from './render';
import { isMuted, sfx, toggleMute } from './audio';
import type { BuildingKind, Plot, UnitKind } from './types';

export function screenToWorld(game: Game, sx: number, sy: number): { x: number; y: number } {
  return { x: sx + game.cam.x, y: sy + game.cam.y };
}

export function attachInput(
  game: Game,
  canvas: HTMLCanvasElement,
  mini: HTMLCanvasElement,
  onMuteChange: () => void,
): void {
  let dragging = false;
  let downX = 0;
  let downY = 0;
  let aDownT = 0;
  let lastClickT = 0;
  let lastClickKind: string | null = null;

  const canvasPos = (e: MouseEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mouseenter', () => {
    game.mouseOnCanvas = true;
  });
  canvas.addEventListener('mouseleave', () => {
    game.mouseOnCanvas = false;
    game.edge.x = 0;
    game.edge.y = 0;
  });

  canvas.addEventListener('mousemove', (e) => {
    const p = canvasPos(e);
    // edge pan
    const M = 14;
    game.edge.x = p.x < M ? -1 : p.x > canvas.width - M ? 1 : 0;
    game.edge.y = p.y < M ? -1 : p.y > canvas.height - M ? 1 : 0;
    if (dragging) {
      game.dragRect = { x0: downX, y0: downY, x1: p.x, y1: p.y };
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (game.state.over) return;
    const p = canvasPos(e);
    if (e.button === 0) {
      dragging = true;
      downX = p.x;
      downY = p.y;
      game.dragRect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    } else if (e.button === 2) {
      handleRightClick(p.x, p.y);
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !dragging) return;
    dragging = false;
    const p = canvasPos(e);
    const moved = Math.hypot(p.x - downX, p.y - downY);
    game.dragRect = null;
    if (moved > 8) {
      boxSelect(Math.min(downX, p.x), Math.min(downY, p.y), Math.max(downX, p.x), Math.max(downY, p.y));
    } else {
      handleLeftClick(p.x, p.y);
    }
  });

  function boxSelect(x0: number, y0: number, x1: number, y1: number): void {
    const w0 = screenToWorld(game, x0, y0);
    const w1 = screenToWorld(game, x1, y1);
    game.clearSelection();
    let n = 0;
    for (const u of game.state.units) {
      if (u.side !== 0 || u.state === 'dead') continue;
      if (u.x >= w0.x && u.x <= w1.x && u.y >= w0.y && u.y <= w1.y) {
        game.selectedUnits.add(u.id);
        n++;
      }
    }
    if (n > 0) sfx.select();
    game.uiDirty = true;
  }

  function handleLeftClick(sx: number, sy: number): void {
    const { x, y } = screenToWorld(game, sx, sy);
    const now = performance.now();

    // attack-move mode: click issues the order
    if (game.attackMoveMode) {
      const eu = enemyAt(game.state, x, y);
      if (eu) {
        issueAttackUnit(game.state, [...game.selectedUnits], eu.id);
      } else {
        const eb = buildingAt(game.state, x, y);
        if (eb && eb.side === 1) issueAttackBuilding(game.state, [...game.selectedUnits], eb.id);
        else issueAttackMove(game.state, game.terrain, [...game.selectedUnits], x, y);
      }
      game.attackMoveMode = false;
      canvas.style.cursor = 'default';
      return;
    }

    // own unit?
    const u = unitAt(game.state, x, y);
    if (u && u.side === 0) {
      const isDouble = now - lastClickT < 350 && lastClickKind === u.kind;
      lastClickT = now;
      lastClickKind = u.kind;
      game.clearSelection();
      if (isDouble) {
        // select all of this type on screen
        for (const o of game.state.units) {
          if (o.side !== 0 || o.kind !== u.kind || o.state === 'dead') continue;
          if (
            o.x >= game.cam.x &&
            o.x <= game.cam.x + game.cam.w &&
            o.y >= game.cam.y &&
            o.y <= game.cam.y + game.cam.h
          ) {
            game.selectedUnits.add(o.id);
          }
        }
      } else {
        game.selectedUnits.add(u.id);
      }
      sfx.select();
      game.uiDirty = true;
      return;
    }
    lastClickT = now;
    lastClickKind = null;

    // own building?
    const b = buildingAt(game.state, x, y);
    if (b && b.side === 0) {
      game.clearSelection();
      game.selectedBuildings.add(b.id);
      sfx.select();
      game.uiDirty = true;
      return;
    }

    // empty build plot?
    const p = plotAt(game.state, x, y);
    if (p && p.side === 0 && p.buildingId === -1) {
      game.clearSelection();
      game.selectedPlot = p;
      sfx.select();
      game.uiDirty = true;
      return;
    }

    game.clearSelection();
  }

  function handleRightClick(sx: number, sy: number): void {
    const { x, y } = screenToWorld(game, sx, sy);
    // rally point for selected building
    if (game.selectedBuildings.size > 0) {
      const id = [...game.selectedBuildings][0];
      setRally(game.state, id, x, y);
      return;
    }
    if (game.selectedUnits.size === 0) return;
    const ids = [...game.selectedUnits];
    const eu = enemyAt(game.state, x, y);
    if (eu) {
      issueAttackUnit(game.state, ids, eu.id);
      return;
    }
    const eb = buildingAt(game.state, x, y);
    if (eb && eb.side === 1) {
      issueAttackBuilding(game.state, ids, eb.id);
      return;
    }
    issueMove(game.state, game.terrain, ids, x, y);
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    game.keys.add(k);
    if (k === 'a' && aDownT === 0) aDownT = performance.now();

    if (game.state.over) return;
    if (k === 'escape') {
      game.clearSelection();
    } else if (k === 'm') {
      toggleMute();
      onMuteChange();
    } else if (k === 't') {
      // hero ability
      for (const id of game.selectedUnits) {
        const u = game.state.units.find((uu) => uu.id === id);
        if (u && u.kind === 'hero') {
          if (useWarcry(game.state, id)) game.uiDirty = true;
          break;
        }
      }
    } else if (k === 'q') {
      trainFirst();
    } else if (k === '1' || k === '2' || k === '3') {
      if (game.selectedPlot) {
        const kinds: BuildingKind[] = ['barracks', 'archery', 'stables'];
        const kind = kinds[parseInt(k, 10) - 1];
        const plot: Plot = game.selectedPlot;
        if (startBuild(game.state, plot, kind)) {
          const b = game.state.buildings.find((bb) => bb.id === plot.buildingId);
          game.selectedPlot = null;
          game.selectedBuildings.clear();
          if (b) game.selectedBuildings.add(b.id);
          game.uiDirty = true;
        } else game.uiDirty = true;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    game.keys.delete(k);
    if (k === 'a') {
      // tap (not hold) arms attack-move; holding 'a' pans the camera
      const held = performance.now() - aDownT;
      aDownT = 0;
      if (held < 300 && game.selectedUnits.size > 0 && !game.state.over) {
        game.attackMoveMode = true;
        canvas.style.cursor = 'crosshair';
      }
    }
  });

  function trainFirst(): void {
    if (game.selectedBuildings.size === 0) return;
    const id = [...game.selectedBuildings][0];
    const b = game.state.buildings.find((bb) => bb.id === id);
    if (!b || b.underConstruction) return;
    const kind = BUILDINGS[b.kind].trains[0] as UnitKind;
    if (queueUnit(game.state, id, kind)) game.uiDirty = true;
    else game.uiDirty = true;
  }

  // minimap click-to-jump
  mini.addEventListener('mousedown', (e) => {
    const r = mini.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const w = worldFromMinimap(mx, my, r.width, r.height);
    game.centerCamera(w.x, w.y);
  });
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function isMutedNow(): boolean {
  return isMuted();
}
