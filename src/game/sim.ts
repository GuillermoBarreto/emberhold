import {
  BUILDINGS,
  CAPTURE_RADIUS,
  CAPTURE_TIME,
  UNITS,
  WARCRY_COOLDOWN,
  WARCRY_DMG_MULT,
  WARCRY_DURATION,
  WARCRY_RADIUS,
} from './config';
import { computeDamage } from './combat';
import { canRecruit, incomeForMines } from './economy';
import {
  DEFENDERS_KEPT,
  EXPAND_T,
  HERO_T,
  RECRUIT_CYCLE,
  RECRUIT_INTERVAL,
  WAVE_INTERVAL,
  planWave,
  producerFor,
  waveSize,
} from './ai';
import { isBlocked, riverWaypoint, speedFactor, type Terrain } from './map';
import { makeBuilding, makeUnit } from './state';
import type { Building, BuildingKind, GameState, Mine, Plot, Side, Unit, UnitKind } from './types';
import { sfx } from './audio';

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function unitById(s: GameState, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id && u.state !== 'dead');
}

function buildingById(s: GameState, id: number): Building | undefined {
  return s.buildings.find((b) => b.id === id);
}

function aliveUnits(s: GameState, side: Side): Unit[] {
  return s.units.filter((u) => u.side === side && u.state !== 'dead');
}

// ---- movement ----

function tryMove(t: Terrain, u: Unit, dx: number, dy: number): void {
  const nx = u.x + dx;
  const ny = u.y + dy;
  if (!isBlocked(t, nx, ny)) {
    u.x = nx;
    u.y = ny;
    return;
  }
  if (!isBlocked(t, nx, u.y)) {
    u.x = nx;
    return;
  }
  if (!isBlocked(t, u.x, ny)) {
    u.y = ny;
  }
}

function stepToward(t: Terrain, u: Unit, tx: number, ty: number, dt: number): boolean {
  const d = dist(u.x, u.y, tx, ty);
  if (d < 10) return true;
  const spec = UNITS[u.kind];
  const sp = spec.speed * speedFactor(u.x, u.y) * dt;
  const step = Math.min(sp, d);
  tryMove(t, u, ((tx - u.x) / d) * step, ((ty - u.y) / d) * step);
  return false;
}

function setDestination(t: Terrain, u: Unit, x: number, y: number): void {
  u.waypoints = [];
  const wp = riverWaypoint(u.x, u.y, x, y);
  if (wp) u.waypoints.push(wp);
  u.tx = x;
  u.ty = y;
}

function currentTarget(u: Unit): { x: number; y: number } {
  if (u.waypoints.length > 0) return u.waypoints[0];
  return { x: u.tx, y: u.ty };
}

function advanceMove(t: Terrain, u: Unit, dt: number): boolean {
  // Returns true when the final destination is reached.
  const tgt = currentTarget(u);
  if (dist(u.x, u.y, tgt.x, tgt.y) < (u.waypoints.length > 0 ? 45 : 10)) {
    if (u.waypoints.length > 0) {
      u.waypoints.shift();
      return false;
    }
    return true;
  }
  stepToward(t, u, tgt.x, tgt.y, dt);
  return false;
}

// ---- combat ----

function nearestEnemyUnit(s: GameState, u: Unit, range: number): Unit | undefined {
  let best: Unit | undefined;
  let bd = range;
  for (const e of s.units) {
    if (e.side === u.side || e.state === 'dead') continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function nearestEnemyBuilding(s: GameState, u: Unit, range: number): Building | undefined {
  let best: Building | undefined;
  let bd = range;
  for (const b of s.buildings) {
    if (b.side === u.side) continue;
    const d = dist(u.x, u.y, b.x, b.y) - BUILDINGS[b.kind].size;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

function dealDamageToUnit(s: GameState, atk: Unit, target: Unit): void {
  const spec = UNITS[atk.kind];
  const dmg = computeDamage(spec.dmg, atk.kind, target.kind, atk.buffT > 0, WARCRY_DMG_MULT);
  target.hp -= dmg;
  target.flashT = 0.12;
  s.effects.push({ kind: 'hit', x: target.x, y: target.y, t: 0, total: 0.18, side: atk.side });
  if (target.hp <= 0 && target.state !== 'dead') {
    target.state = 'dead';
    target.deadT = 0.7;
    target.hp = 0;
    s.stats.lost[target.side]++;
    s.stats.killed[atk.side]++;
    s.effects.push({ kind: 'death', x: target.x, y: target.y, t: 0, total: 0.7, side: target.side });
  }
  sfx.attack();
}

function dealDamageToBuilding(s: GameState, atk: Unit, b: Building): void {
  const spec = UNITS[atk.kind];
  // Structures take flat damage — the combat triangle doesn't apply.
  const buffed = atk.buffT > 0 ? WARCRY_DMG_MULT : 1;
  b.hp -= spec.dmg * buffed;
  s.effects.push({ kind: 'hit', x: b.x, y: b.y, t: 0, total: 0.18, side: atk.side });
  sfx.attack();
}

function acquireTarget(s: GameState, u: Unit): boolean {
  const spec = UNITS[u.kind];
  const eu = nearestEnemyUnit(s, u, spec.aggro);
  if (eu) {
    u.state = 'attack';
    u.targetId = eu.id;
    u.targetBuildingId = -1;
    return true;
  }
  const eb = nearestEnemyBuilding(s, u, spec.aggro * 0.9);
  if (eb) {
    u.state = 'attack';
    u.targetId = -1;
    u.targetBuildingId = eb.id;
    return true;
  }
  return false;
}

function updateUnit(s: GameState, t: Terrain, u: Unit, dt: number): void {
  if (u.attackCd > 0) u.attackCd -= dt;
  if (u.buffT > 0) u.buffT -= dt;
  if (u.abilityCd > 0) u.abilityCd -= dt;
  if (u.flashT > 0) u.flashT -= dt;

  switch (u.state) {
    case 'idle':
      acquireTarget(s, u);
      break;
    case 'move':
      if (advanceMove(t, u, dt)) u.state = 'idle';
      break;
    case 'attackmove': {
      if (!acquireTarget(s, u)) {
        if (advanceMove(t, u, dt)) u.state = 'idle';
      }
      break;
    }
    case 'attack': {
      let tx = 0;
      let ty = 0;
      let inRange = false;
      let targetUnit: Unit | undefined;
      let targetBuilding: Building | undefined;
      const spec = UNITS[u.kind];
      if (u.targetId >= 0) {
        targetUnit = unitById(s, u.targetId);
        if (!targetUnit) {
          u.state = 'idle';
          u.targetId = -1;
          break;
        }
        tx = targetUnit.x;
        ty = targetUnit.y;
        inRange = dist(u.x, u.y, tx, ty) <= spec.range + UNITS[targetUnit.kind].radius;
      } else if (u.targetBuildingId >= 0) {
        targetBuilding = buildingById(s, u.targetBuildingId);
        if (!targetBuilding) {
          u.state = 'idle';
          u.targetBuildingId = -1;
          break;
        }
        tx = targetBuilding.x;
        ty = targetBuilding.y;
        inRange =
          dist(u.x, u.y, tx, ty) <= spec.range + BUILDINGS[targetBuilding.kind].size;
      } else {
        u.state = 'idle';
        break;
      }
      if (inRange) {
        if (u.attackCd <= 0) {
          u.attackCd = spec.attackCd;
          if (targetUnit) dealDamageToUnit(s, u, targetUnit);
          else if (targetBuilding) dealDamageToBuilding(s, u, targetBuilding);
        }
      } else {
        // chase the target's live position; route across the river via the bridge if needed
        const wp = riverWaypoint(u.x, u.y, tx, ty);
        if (wp && u.waypoints.length === 0) u.waypoints.push(wp);
        const wpt = u.waypoints.length > 0 ? u.waypoints[0] : { x: tx, y: ty };
        if (u.waypoints.length > 0 && dist(u.x, u.y, wpt.x, wpt.y) < 45) {
          u.waypoints.shift();
        } else {
          stepToward(t, u, wpt.x, wpt.y, dt);
        }
      }
      break;
    }
    case 'dead':
      u.deadT -= dt;
      break;
  }
}

function separation(s: GameState): void {
  const us = s.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    if (a.state === 'dead') continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (b.state === 'dead') continue;
      const ra = UNITS[a.kind].radius;
      const rb = UNITS[b.kind].radius;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const min = ra + rb - 2;
      if (d > 0.01 && d < min) {
        const push = ((min - d) / d) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }
}

// ---- buildings / production ----

function updateBuildings(s: GameState, dt: number): void {
  for (const b of s.buildings) {
    if (b.underConstruction) {
      b.buildT -= dt;
      if (b.buildT <= 0) {
        b.underConstruction = false;
        b.buildT = 0;
        s.effects.push({ kind: 'builddone', x: b.x, y: b.y, t: 0, total: 0.8, side: b.side });
        if (b.side === 0) sfx.build();
      }
      continue;
    }
    const q = b.queue[0];
    if (q) {
      q.t -= dt;
      if (q.t <= 0) {
        b.queue.shift();
        const spec = BUILDINGS[b.kind];
        const u = makeUnit(b.side, q.kind, b.x + (b.side === 0 ? spec.size + 20 : -spec.size - 20), b.y);
        u.state = 'move';
        u.tx = b.rallyX;
        u.ty = b.rallyY;
        s.units.push(u);
        if (b.side === 0) sfx.build();
      }
    }
  }
}

function removeDeadBuildings(s: GameState): void {
  const dead = s.buildings.filter((b) => b.hp <= 0);
  for (const b of dead) {
    s.effects.push({ kind: 'death', x: b.x, y: b.y, t: 0, total: 1.0, side: b.side });
    const plot = s.plots[b.plotIndex];
    if (plot) plot.buildingId = -1;
    if (b.kind === 'fortress' && !s.over) {
      s.over = { winner: (1 - b.side) as Side, reason: 'fortress' };
    }
  }
  s.buildings = s.buildings.filter((b) => b.hp > 0);
}

// ---- mines / economy ----

function updateMines(s: GameState, dt: number): void {
  const goldGain: [number, number] = [0, 0];
  for (const m of s.mines) {
    if (m.owner === 0) goldGain[0] += incomeForMines(1, dt);
    else if (m.owner === 1) goldGain[1] += incomeForMines(1, dt);

    let p = 0;
    let a = 0;
    for (const u of s.units) {
      if (u.state === 'dead') continue;
      if (dist(u.x, u.y, m.x, m.y) < CAPTURE_RADIUS) {
        if (u.side === 0) p++;
        else a++;
      }
    }
    if (p > 0 && a === 0) {
      if (m.progSide !== 0) {
        m.progSide = 0;
        m.progress = 0;
      }
      if (m.owner !== 0) {
        m.progress += dt;
        if (m.progress >= CAPTURE_TIME) {
          m.owner = 0;
          m.progress = 0;
          s.effects.push({ kind: 'capture', x: m.x, y: m.y, t: 0, total: 0.8, side: 0 });
          sfx.capture();
        }
      }
    } else if (a > 0 && p === 0) {
      if (m.progSide !== 1) {
        m.progSide = 1;
        m.progress = 0;
      }
      if (m.owner !== 1) {
        m.progress += dt;
        if (m.progress >= CAPTURE_TIME) {
          m.owner = 1;
          m.progress = 0;
          s.effects.push({ kind: 'capture', x: m.x, y: m.y, t: 0, total: 0.8, side: 1 });
        }
      }
    } else {
      m.progress = Math.max(0, m.progress - dt * 2);
    }
  }
  s.gold[0] += goldGain[0];
  s.gold[1] += goldGain[1];
}

// ---- AI ----

function aiBuildingReady(s: GameState, kind: BuildingKind): Building | undefined {
  return s.buildings.find((b) => b.side === 1 && b.kind === kind && !b.underConstruction);
}

function aiUpdate(s: GameState, t: Terrain, dt: number): void {
  const ai = s.ai;
  if (s.over) return;

  // Scheduled buildings
  for (let i = ai.buildQueue.length - 1; i >= 0; i--) {
    const item = ai.buildQueue[i];
    if (s.time >= item.t) {
      const plot = s.plots.find((p) => p.side === 1 && p.buildingId === -1);
      const cost = BUILDINGS[item.kind].cost;
      if (plot && s.gold[1] >= cost) {
        s.gold[1] -= cost;
        const b = makeBuilding(1, item.kind, plot.x, plot.y, s.plots.indexOf(plot), false);
        s.buildings.push(b);
        plot.buildingId = b.id;
        ai.buildQueue.splice(i, 1);
      } else if (!plot) {
        ai.buildQueue.splice(i, 1); // nowhere to build; drop it
      }
      // else: wait for gold, retry next tick
    }
  }

  // Recruitment
  if (s.time >= ai.nextRecruitT) {
    ai.nextRecruitT = s.time + RECRUIT_INTERVAL;
    const kind = RECRUIT_CYCLE[ai.recruitIndex % RECRUIT_CYCLE.length];
    ai.recruitIndex++;
    const b = aiBuildingReady(s, producerFor(kind));
    if (b && b.queue.length < 5 && canRecruit(s.units, 1, kind, s.gold[1])) {
      s.gold[1] -= UNITS[kind].cost;
      b.queue.push({ kind, t: UNITS[kind].trainTime, total: UNITS[kind].trainTime });
    }
  }

  // Hero
  if (!ai.heroQueued && s.time >= HERO_T && s.gold[1] >= UNITS['hero'].cost) {
    const f = aiBuildingReady(s, 'fortress');
    const hasHero = s.units.some((u) => u.side === 1 && u.kind === 'hero' && u.state !== 'dead');
    if (f && !hasHero && canRecruit(s.units, 1, 'hero', s.gold[1])) {
      s.gold[1] -= UNITS['hero'].cost;
      f.queue.push({ kind: 'hero', t: UNITS['hero'].trainTime, total: UNITS['hero'].trainTime });
      ai.heroQueued = true;
    }
  }

  // Expansion: grab the nearest neutral/enemy mine with a small squad
  if (!ai.expanded && s.time >= EXPAND_T) {
    ai.expanded = true;
    sendExpansionSquad(s, t);
  }
  // Re-expand if the AI is down to its home mine
  if (ai.expanded && s.time >= ai.expandT + 60) {
    const held = s.mines.filter((m) => m.owner === 1).length;
    if (held < 2) {
      ai.expandT = s.time;
      sendExpansionSquad(s, t);
    }
  }

  // Attack waves
  if (s.time >= ai.nextWaveT) {
    ai.nextWaveT = s.time + WAVE_INTERVAL;
    ai.waveNumber++;
    launchWave(s, t, ai.waveNumber);
  }
}

function sendExpansionSquad(s: GameState, t: Terrain): void {
  const fort = s.buildings.find((b) => b.side === 1 && b.kind === 'fortress');
  if (!fort) return;
  let target: Mine | undefined;
  let bd = Infinity;
  for (const m of s.mines) {
    if (m.owner === 1) continue;
    const d = dist(fort.x, fort.y, m.x, m.y);
    if (d < bd) {
      bd = d;
      target = m;
    }
  }
  if (!target) return;
  const squad = aliveUnits(s, 1)
    .filter((u) => u.kind === 'infantry')
    .slice(0, 3);
  for (const u of squad) {
    u.state = 'attackmove';
    setDestination(t, u, target.x + (Math.random() * 60 - 30), target.y + (Math.random() * 60 - 30));
    u.targetId = -1;
    u.targetBuildingId = -1;
  }
}

function launchWave(s: GameState, t: Terrain, waveNumber: number): void {
  const fort = s.buildings.find((b) => b.side === 1 && b.kind === 'fortress');
  const pfort = s.buildings.find((b) => b.side === 0 && b.kind === 'fortress');
  if (!fort || !pfort) return;
  const size = waveSize(waveNumber);
  // Keep DEFENDERS_KEPT closest-to-home units back; send the rest.
  // (Recruitment follows RECRUIT_CYCLE, so the mix stays balanced.)
  const candidates = aliveUnits(s, 1)
    .filter((u) => u.kind !== 'hero')
    .sort((a, b) => dist(a.x, a.y, fort.x, fort.y) - dist(b.x, b.y, fort.x, fort.y));
  const attackers = candidates.slice(DEFENDERS_KEPT, DEFENDERS_KEPT + size);
  for (const u of attackers) {
    u.state = 'attackmove';
    setDestination(
      t,
      u,
      pfort.x + (Math.random() * 160 - 80),
      pfort.y + (Math.random() * 160 - 80),
    );
    u.targetId = -1;
    u.targetBuildingId = -1;
  }
}

// ---- player/AI-agnostic commands (used by input.ts) ----

export function issueMove(s: GameState, t: Terrain, ids: number[], x: number, y: number): void {
  for (const id of ids) {
    const u = unitById(s, id);
    if (!u || u.side !== 0) continue;
    u.state = 'move';
    u.targetId = -1;
    u.targetBuildingId = -1;
    setDestination(t, u, x, y);
  }
  s.effects.push({ kind: 'move', x, y, t: 0, total: 0.5, side: 0 });
  sfx.move();
}

export function issueAttackMove(s: GameState, t: Terrain, ids: number[], x: number, y: number): void {
  for (const id of ids) {
    const u = unitById(s, id);
    if (!u || u.side !== 0) continue;
    u.state = 'attackmove';
    u.targetId = -1;
    u.targetBuildingId = -1;
    setDestination(t, u, x, y);
  }
  s.effects.push({ kind: 'move', x, y, t: 0, total: 0.5, side: 0 });
  sfx.move();
}

export function issueAttackUnit(s: GameState, ids: number[], targetId: number): void {
  for (const id of ids) {
    const u = unitById(s, id);
    if (!u || u.side !== 0) continue;
    u.state = 'attack';
    u.targetId = targetId;
    u.targetBuildingId = -1;
    u.waypoints = [];
  }
  sfx.move();
}

export function issueAttackBuilding(s: GameState, ids: number[], buildingId: number): void {
  for (const id of ids) {
    const u = unitById(s, id);
    if (!u || u.side !== 0) continue;
    u.state = 'attack';
    u.targetId = -1;
    u.targetBuildingId = buildingId;
    u.waypoints = [];
  }
  sfx.move();
}

export function setRally(s: GameState, buildingId: number, x: number, y: number): void {
  const b = buildingById(s, buildingId);
  if (b && b.side === 0) {
    b.rallyX = x;
    b.rallyY = y;
    s.effects.push({ kind: 'move', x, y, t: 0, total: 0.5, side: 0 });
    sfx.move();
  }
}

export function startBuild(s: GameState, plot: Plot, kind: BuildingKind): boolean {
  const cost = BUILDINGS[kind].cost;
  if (plot.buildingId !== -1 || s.gold[0] < cost) {
    sfx.error();
    return false;
  }
  s.gold[0] -= cost;
  const b = makeBuilding(0, kind, plot.x, plot.y, s.plots.indexOf(plot), false);
  s.buildings.push(b);
  plot.buildingId = b.id;
  sfx.build();
  return true;
}

export function queueUnit(s: GameState, buildingId: number, kind: UnitKind): boolean {
  const b = buildingById(s, buildingId);
  if (!b || b.side !== 0 || b.underConstruction) {
    sfx.error();
    return false;
  }
  if (!BUILDINGS[b.kind].trains.includes(kind)) {
    sfx.error();
    return false;
  }
  if (b.queue.length >= 5) {
    sfx.error();
    return false;
  }
  if (!canRecruit(s.units, 0, kind, s.gold[0])) {
    sfx.error();
    return false;
  }
  s.gold[0] -= UNITS[kind].cost;
  b.queue.push({ kind, t: UNITS[kind].trainTime, total: UNITS[kind].trainTime });
  return true;
}

export function useWarcry(s: GameState, heroId: number): boolean {
  const h = unitById(s, heroId);
  if (!h || h.kind !== 'hero' || h.side !== 0 || h.abilityCd > 0) {
    sfx.error();
    return false;
  }
  h.abilityCd = WARCRY_COOLDOWN;
  for (const u of s.units) {
    if (u.side === 0 && u.state !== 'dead' && dist(u.x, u.y, h.x, h.y) <= WARCRY_RADIUS) {
      u.buffT = WARCRY_DURATION;
    }
  }
  s.effects.push({ kind: 'warcry', x: h.x, y: h.y, t: 0, total: 0.9, side: 0 });
  sfx.build();
  return true;
}

// ---- queries for input/render ----

export function unitAt(s: GameState, x: number, y: number, maxD = 22): Unit | undefined {
  let best: Unit | undefined;
  let bd = maxD;
  for (const u of s.units) {
    if (u.state === 'dead') continue;
    const d = dist(x, y, u.x, u.y);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

export function enemyAt(s: GameState, x: number, y: number, maxD = 26): Unit | undefined {
  const u = unitAt(s, x, y, maxD);
  return u && u.side === 1 ? u : undefined;
}

export function buildingAt(s: GameState, x: number, y: number): Building | undefined {
  for (const b of s.buildings) {
    const half = BUILDINGS[b.kind].size;
    if (Math.abs(x - b.x) < half && Math.abs(y - b.y) < half) return b;
  }
  return undefined;
}

export function plotAt(s: GameState, x: number, y: number): Plot | undefined {
  for (const p of s.plots) {
    if (dist(x, y, p.x, p.y) < 34) return p;
  }
  return undefined;
}

// ---- main step ----

export function updateGame(s: GameState, t: Terrain, dt: number): void {
  if (!s.over) {
    s.time += dt;
    updateMines(s, dt);
    updateBuildings(s, dt);
    aiUpdate(s, t, dt);
  }
  for (const u of s.units) updateUnit(s, t, u, dt);
  separation(s);
  // cull finished deaths
  s.units = s.units.filter((u) => u.state !== 'dead' || u.deadT > 0);
  removeDeadBuildings(s);
  // age effects
  for (const e of s.effects) e.t += dt;
  s.effects = s.effects.filter((e) => e.t < e.total);
}
