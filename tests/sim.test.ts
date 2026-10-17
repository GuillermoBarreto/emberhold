import { describe, expect, it } from 'vitest';
import { createTerrain } from '../src/game/map';
import {
  issueAttackBuilding,
  issueAttackMove,
  queueUnit,
  startBuild,
  updateGame,
} from '../src/game/sim';
import { createInitialState } from '../src/game/state';

// Full headless skirmish: drives the real simulation without a browser.

describe('headless skirmish', () => {
  it('runs 5 minutes without errors; economy and AI progress', () => {
    const s = createInitialState();
    const t = createTerrain();

    // Player builds a barracks on the first plot and queues infantry.
    const plot = s.plots.find((p) => p.side === 0)!;
    expect(startBuild(s, plot, 'barracks')).toBe(true);
    for (let i = 0; i < 14 * 60; i++) updateGame(s, t, 1 / 60);
    const b = s.buildings.find((bb) => bb.id === plot.buildingId)!;
    expect(b.underConstruction).toBe(false);
    for (let i = 0; i < 5; i++) expect(queueUnit(s, b.id, 'infantry')).toBe(true);

    // Send the whole army at the AI fortress.
    const pfort = s.buildings.find((bb) => bb.side === 1 && bb.kind === 'fortress')!;
    const ids = s.units.filter((u) => u.side === 0).map((u) => u.id);
    issueAttackMove(s, t, ids, pfort.x, pfort.y);

    let steps = 0;
    for (let i = 0; i < 300 * 60; i++) {
      updateGame(s, t, 1 / 60);
      steps++;
      for (const u of s.units) {
        expect(Number.isFinite(u.x), 'unit x is finite').toBe(true);
        expect(Number.isFinite(u.y), 'unit y is finite').toBe(true);
        expect(u.hp).toBeLessThanOrEqual(u.maxHp);
      }
      if (s.over) break;
    }
    expect(steps).toBeGreaterThan(60);
    // AI progressed: waves launched and barracks built.
    expect(s.ai.waveNumber).toBeGreaterThan(0);
    expect(s.buildings.some((bb) => bb.side === 1 && bb.kind === 'barracks')).toBe(true);
    // Gold income ticked for both sides.
    expect(s.gold[0] + s.gold[1]).toBeGreaterThan(0);
  }, 30000);

  it('destroying the enemy fortress wins the game', () => {
    const s = createInitialState();
    const t = createTerrain();
    const afort = s.buildings.find((b) => b.side === 1 && b.kind === 'fortress')!;
    afort.hp = 5;
    // isolate: teleport attacker next to the fortress, move defenders away
    const attacker = s.units.find((u) => u.side === 0)!;
    attacker.x = afort.x - 100;
    attacker.y = afort.y;
    for (const u of s.units) if (u.side === 1) u.x = 2400;
    issueAttackBuilding(s, [attacker.id], afort.id);
    for (let i = 0; i < 20 * 60 && !s.over; i++) updateGame(s, t, 1 / 60);
    expect(s.over).not.toBeNull();
    expect(s.over!.winner).toBe(0);
    expect(s.over!.reason).toBe('fortress');
  });

  it('losing your fortress loses the game', () => {
    const s = createInitialState();
    const t = createTerrain();
    const pfort = s.buildings.find((b) => b.side === 0 && b.kind === 'fortress')!;
    pfort.hp = 5;
    const attacker = s.units.find((u) => u.side === 1)!;
    attacker.x = pfort.x + 100;
    attacker.y = pfort.y;
    for (const u of s.units) if (u.side === 0) u.x = 100;
    attacker.state = 'attack';
    attacker.targetBuildingId = pfort.id;
    for (let i = 0; i < 30 * 60 && !s.over; i++) updateGame(s, t, 1 / 60);
    expect(s.over).not.toBeNull();
    expect(s.over!.winner).toBe(1);
  });

  it('mines flip when held and pay their owner', () => {
    const s = createInitialState();
    const t = createTerrain();
    const mine = s.mines.find((m) => m.owner === -1)!;
    const u = s.units.find((x) => x.side === 0)!;
    u.x = mine.x;
    u.y = mine.y;
    u.state = 'idle';
    // keep AI units away from this mine
    for (const e of s.units) if (e.side === 1) e.x = 2400;
    const goldBefore = s.gold[0];
    for (let i = 0; i < 4 * 60; i++) updateGame(s, t, 1 / 60);
    expect(mine.owner).toBe(0);
    expect(s.gold[0]).toBeGreaterThan(goldBefore);
  });
});
