import { describe, expect, it } from 'vitest';
import { canAfford, canRecruit, cpFree, cpUsed, incomeForMines, unitCost } from '../src/game/economy';
import { CP_CAP, MINE_INCOME_PER_SEC, START_GOLD, UNITS } from '../src/game/config';
import { makeUnit } from '../src/game/state';
import type { Unit } from '../src/game/types';

function unitsOf(side: 0 | 1, kinds: ('infantry' | 'archer' | 'cavalry' | 'hero')[]): Unit[] {
  return kinds.map((kind, i) => makeUnit(side, kind, i * 10, 0));
}

describe('gold income', () => {
  it('each held mine pays MINE_INCOME_PER_SEC gold per second', () => {
    expect(incomeForMines(1, 1)).toBe(MINE_INCOME_PER_SEC);
    expect(incomeForMines(3, 10)).toBe(3 * MINE_INCOME_PER_SEC * 10);
  });
  it('no mines means no income', () => {
    expect(incomeForMines(0, 60)).toBe(0);
  });
  it('starting gold matches config', () => {
    expect(canAfford(START_GOLD, UNITS['infantry'].cost)).toBe(true);
    expect(START_GOLD).toBe(600);
  });
});

describe('command points', () => {
  it('counts cp per unit kind', () => {
    const us = unitsOf(0, ['infantry', 'infantry', 'cavalry', 'hero']);
    // 1 + 1 + 2 + 4
    expect(cpUsed(us, 0)).toBe(8);
  });
  it('is tracked per side', () => {
    const us = [...unitsOf(0, ['infantry']), ...unitsOf(1, ['cavalry'])];
    expect(cpUsed(us, 0)).toBe(1);
    expect(cpUsed(us, 1)).toBe(2);
  });
  it('dead units free their command points', () => {
    const us = unitsOf(0, ['cavalry']);
    us[0].state = 'dead';
    expect(cpUsed(us, 0)).toBe(0);
  });
  it('cpFree respects the cap', () => {
    expect(cpFree([], 0)).toBe(CP_CAP);
  });
});

describe('canRecruit', () => {
  it('allows recruiting when gold and cap allow', () => {
    expect(canRecruit([], 0, 'infantry', 1000)).toBe(true);
  });
  it('blocks when gold is short', () => {
    expect(canRecruit([], 0, 'hero', 10)).toBe(false);
  });
  it('blocks when the cap is reached', () => {
    const us = unitsOf(0, Array(60).fill('infantry') as ('infantry')[]);
    expect(cpUsed(us, 0)).toBe(60);
    expect(canRecruit(us, 0, 'infantry', 100000)).toBe(false);
  });
  it('blocks a 2-cp unit with only 1 cp free', () => {
    const us = unitsOf(0, [...Array(59).fill('infantry')] as ('infantry')[]);
    expect(cpFree(us, 0)).toBe(1);
    expect(canRecruit(us, 0, 'cavalry', 100000)).toBe(false);
    expect(canRecruit(us, 0, 'archer', 100000)).toBe(true);
  });
  it('unitCost matches config', () => {
    expect(unitCost('infantry')).toBe(UNITS['infantry'].cost);
  });
});
