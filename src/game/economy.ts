import { CP_CAP, MINE_INCOME_PER_SEC, UNITS } from './config';
import type { Side, Unit, UnitKind } from './types';

// Pure economy helpers — easy to unit test.

export function incomeForMines(minesHeld: number, dt: number): number {
  return minesHeld * MINE_INCOME_PER_SEC * dt;
}

export function unitCost(kind: UnitKind): number {
  return UNITS[kind].cost;
}

export function canAfford(gold: number, cost: number): boolean {
  return gold >= cost;
}

export function cpUsed(units: Unit[], side: Side): number {
  let used = 0;
  for (const u of units) {
    if (u.side === side && u.state !== 'dead') used += UNITS[u.kind].cp;
  }
  return used;
}

export function cpFree(units: Unit[], side: Side): number {
  return CP_CAP - cpUsed(units, side);
}

// Can this side recruit this unit kind right now?
export function canRecruit(units: Unit[], side: Side, kind: UnitKind, gold: number): boolean {
  return canAfford(gold, UNITS[kind].cost) && cpFree(units, side) >= UNITS[kind].cp;
}
