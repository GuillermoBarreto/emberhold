// All tunable game constants in one place.

export const WORLD_W = 2560;
export const WORLD_H = 1600;

export const START_GOLD = 600;
export const MINE_INCOME_PER_SEC = 8;
export const CAPTURE_TIME = 2.5; // seconds a lone unit must hold a mine to flip it
export const CAPTURE_RADIUS = 95;

export const CP_CAP = 60;

export interface UnitSpec {
  hp: number;
  dmg: number;
  range: number; // attack range (px)
  speed: number; // px per second
  cost: number;
  cp: number;
  trainTime: number; // seconds
  attackCd: number; // seconds between attacks
  aggro: number; // auto-acquire radius
  radius: number; // body radius for rendering/selection
}

export const UNITS: Record<string, UnitSpec> = {
  infantry: { hp: 110, dmg: 12, range: 26, speed: 95, cost: 60, cp: 1, trainTime: 4, attackCd: 1.0, aggro: 260, radius: 11 },
  archer: { hp: 65, dmg: 11, range: 230, speed: 88, cost: 75, cp: 1, trainTime: 5, attackCd: 1.2, aggro: 300, radius: 10 },
  cavalry: { hp: 140, dmg: 15, range: 30, speed: 165, cost: 110, cp: 2, trainTime: 7, attackCd: 1.0, aggro: 280, radius: 12 },
  hero: { hp: 650, dmg: 32, range: 44, speed: 105, cost: 400, cp: 4, trainTime: 18, attackCd: 0.9, aggro: 320, radius: 15 },
};

export const TRIANGLE_BONUS = 1.5; // infantry>cavalry, cavalry>archer, archer>infantry
export const HERO_BONUS = 1.3; // hero deals bonus vs everything

// Hero ability: War-cry — nearby allies deal +40% damage for 8s. 30s cooldown.
export const WARCRY_RADIUS = 260;
export const WARCRY_DURATION = 8;
export const WARCRY_DMG_MULT = 1.4;
export const WARCRY_COOLDOWN = 30;

export interface BuildingSpec {
  hp: number;
  cost: number;
  buildTime: number;
  size: number; // half-extent of the square footprint
  trains: string[]; // unit kinds this building can produce
}

export const BUILDINGS: Record<string, BuildingSpec> = {
  fortress: { hp: 2600, cost: 0, buildTime: 0, size: 52, trains: ['hero'] },
  barracks: { hp: 850, cost: 200, buildTime: 14, size: 38, trains: ['infantry'] },
  archery: { hp: 750, cost: 225, buildTime: 14, size: 38, trains: ['archer'] },
  stables: { hp: 850, cost: 275, buildTime: 16, size: 38, trains: ['cavalry'] },
};

// River: vertical band around RIVER_X; units inside move slower except on the bridge.
export const RIVER_X = 1280;
export const RIVER_HALF = 70;
export const RIVER_SLOW = 0.55;
export const BRIDGE_Y0 = 700;
export const BRIDGE_Y1 = 900;

// Fixed-timestep simulation rate.
export const STEP = 1 / 60;

export const UNIT_NAMES: Record<string, string> = {
  infantry: 'Swordsman',
  archer: 'Archer',
  cavalry: 'Lancer',
  hero: 'Warden',
};

export const BUILDING_NAMES: Record<string, string> = {
  fortress: 'Fortress',
  barracks: 'Barracks',
  archery: 'Archery Range',
  stables: 'Stables',
};
