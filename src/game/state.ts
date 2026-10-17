import { BUILDINGS, START_GOLD, UNITS, WORLD_H, WORLD_W } from './config';
import type { Building, BuildingKind, GameState, Mine, Plot, Side, Unit, UnitKind } from './types';
import { BUILD_ORDER, EXPAND_T, FIRST_WAVE_T } from './ai';

let nextIdCounter = 1;
function nid(): number {
  return nextIdCounter++;
}

function makeUnit(side: Side, kind: UnitKind, x: number, y: number): Unit {
  const s = UNITS[kind];
  return {
    id: nid(),
    side,
    kind,
    x,
    y,
    hp: s.hp,
    maxHp: s.hp,
    state: 'idle',
    tx: x,
    ty: y,
    waypoints: [],
    targetId: -1,
    targetBuildingId: -1,
    attackCd: 0,
    deadT: 0,
    buffT: 0,
    abilityCd: 0,
    flashT: 0,
  };
}

function makeBuilding(side: Side, kind: BuildingKind, x: number, y: number, plotIndex: number, built: boolean): Building {
  const s = BUILDINGS[kind];
  return {
    id: nid(),
    side,
    kind,
    x,
    y,
    hp: s.hp,
    maxHp: s.hp,
    underConstruction: !built,
    buildT: built ? 0 : s.buildTime,
    queue: [],
    rallyX: x + (side === 0 ? 90 : -90),
    rallyY: y,
    plotIndex,
  };
}

const PLAYER_PLOTS: [number, number][] = [
  [170, 590],
  [170, 1010],
  [470, 600],
  [470, 1000],
];

function mirrorX(x: number): number {
  return WORLD_W - x;
}

export function createInitialState(): GameState {
  nextIdCounter = 1;
  const plots: Plot[] = [];
  const buildings: Building[] = [];
  const units: Unit[] = [];

  // Fortresses (pre-placed)
  buildings.push(makeBuilding(0, 'fortress', 300, WORLD_H / 2, -1, true));
  buildings.push(makeBuilding(1, 'fortress', WORLD_W - 300, WORLD_H / 2, -1, true));

  // Build plots
  PLAYER_PLOTS.forEach(([x, y], i) => {
    plots.push({ x, y, side: 0, buildingId: -1 });
    plots.push({ x: mirrorX(x), y, side: 1, buildingId: -1 });
    void i;
  });

  // Starting armies
  const pStart: [UnitKind, number, number][] = [
    ['infantry', 430, 730],
    ['infantry', 430, 780],
    ['infantry', 430, 830],
    ['infantry', 430, 880],
    ['archer', 370, 750],
    ['archer', 370, 860],
  ];
  for (const [kind, x, y] of pStart) {
    units.push(makeUnit(0, kind, x, y));
    units.push(makeUnit(1, kind, mirrorX(x), y));
  }

  // Mines: one owned each, three neutral (center one sits on the bridge crossing)
  const mines: Mine[] = [
    { x: 620, y: WORLD_H / 2, owner: 0, progress: 0, progSide: 0 },
    { x: WORLD_W - 620, y: WORLD_H / 2, owner: 1, progress: 0, progSide: 1 },
    { x: 1280, y: WORLD_H / 2, owner: -1, progress: 0, progSide: 0 },
    { x: 1280, y: 380, owner: -1, progress: 0, progSide: 0 },
    { x: 1280, y: 1220, owner: -1, progress: 0, progSide: 0 },
  ];

  return {
    time: 0,
    gold: [START_GOLD, START_GOLD],
    units,
    buildings,
    mines,
    plots,
    effects: [],
    nextId: 0,
    over: null,
    ai: {
      nextRecruitT: 5,
      recruitIndex: 0,
      buildQueue: BUILD_ORDER.map((b) => ({ ...b })),
      nextWaveT: FIRST_WAVE_T,
      waveNumber: 0,
      expandT: EXPAND_T,
      expanded: false,
      heroQueued: false,
    },
    stats: { lost: [0, 0], killed: [0, 0] },
  };
}

export { makeUnit, makeBuilding };
