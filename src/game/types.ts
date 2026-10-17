export type Side = 0 | 1; // 0 = player (Emberhold, blue), 1 = AI (Ashen Horde, red)
export type UnitKind = 'infantry' | 'archer' | 'cavalry' | 'hero';
export type BuildingKind = 'fortress' | 'barracks' | 'archery' | 'stables';
export type MineOwner = Side | -1; // -1 = neutral

export type UnitState = 'idle' | 'move' | 'attackmove' | 'attack' | 'dead';

export interface Unit {
  id: number;
  side: Side;
  kind: UnitKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  tx: number; // current move target
  ty: number;
  waypoints: { x: number; y: number }[];
  targetId: number; // unit id being attacked, -1 = none
  targetBuildingId: number; // building id being attacked, -1 = none
  attackCd: number; // time until next attack allowed
  deadT: number; // death fade timer
  buffT: number; // war-cry damage buff remaining
  abilityCd: number; // hero ability cooldown
  flashT: number; // hit flash timer (rendering)
}

export interface BuildOrder {
  kind: UnitKind;
  t: number; // time remaining
  total: number;
}

export interface Building {
  id: number;
  side: Side;
  kind: BuildingKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  underConstruction: boolean;
  buildT: number; // time remaining on construction
  queue: BuildOrder[];
  rallyX: number;
  rallyY: number;
  plotIndex: number; // index into plots, -1 for pre-placed fortress
}

export interface Plot {
  x: number;
  y: number;
  side: Side;
  buildingId: number; // -1 = empty
}

export interface Mine {
  x: number;
  y: number;
  owner: MineOwner;
  progress: number; // 0..CAPTURE_TIME toward progSide
  progSide: Side;
}

export interface Effect {
  kind: 'move' | 'hit' | 'death' | 'warcry' | 'capture' | 'builddone';
  x: number;
  y: number;
  t: number; // age
  total: number; // lifetime
  side: Side;
}

export interface AIState {
  nextRecruitT: number;
  recruitIndex: number;
  buildQueue: { t: number; kind: BuildingKind }[];
  nextWaveT: number;
  waveNumber: number;
  expandT: number;
  expanded: boolean;
  heroQueued: boolean;
}

export interface GameState {
  time: number;
  gold: [number, number];
  units: Unit[];
  buildings: Building[];
  mines: Mine[];
  plots: Plot[];
  effects: Effect[];
  nextId: number;
  over: { winner: Side; reason: string } | null;
  ai: AIState;
  stats: { lost: [number, number]; killed: [number, number] };
}
