import { describe, expect, it } from 'vitest';
import {
  DEFENDERS_KEPT,
  FIRST_WAVE_T,
  RECRUIT_CYCLE,
  WAVE_INTERVAL,
  planWave,
  producerFor,
  waveSize,
} from '../src/game/ai';

describe('wave sizing', () => {
  it('grows with the wave number', () => {
    expect(waveSize(1)).toBe(6);
    expect(waveSize(2)).toBe(8);
    expect(waveSize(5)).toBe(14);
  });
  it('is capped so waves stay beatable', () => {
    expect(waveSize(100)).toBe(22);
    expect(waveSize(9)).toBe(22);
  });
});

describe('planWave', () => {
  it('returns exactly waveSize units', () => {
    for (const n of [1, 3, 7]) {
      expect(planWave(n)).toHaveLength(waveSize(n));
    }
  });
  it('mixes infantry, archers and cavalry', () => {
    const comp = planWave(3);
    expect(comp).toContain('infantry');
    expect(comp).toContain('archer');
    expect(comp).toContain('cavalry');
  });
  it('is deterministic', () => {
    expect(planWave(4)).toEqual(planWave(4));
  });
  it('leans on infantry as the backbone (~40%)', () => {
    const comp = planWave(5); // 14 units
    const inf = comp.filter((k) => k === 'infantry').length;
    expect(inf / comp.length).toBeGreaterThanOrEqual(0.35);
  });
});

describe('AI pacing constants', () => {
  it('first wave comes after the expansion window', () => {
    expect(FIRST_WAVE_T).toBeGreaterThan(60);
  });
  it('waves are spaced enough to rebuild between them', () => {
    expect(WAVE_INTERVAL).toBeGreaterThanOrEqual(60);
  });
  it('defenders are always kept home', () => {
    expect(DEFENDERS_KEPT).toBeGreaterThan(0);
  });
  it('recruit cycle only uses trainable kinds', () => {
    for (const k of RECRUIT_CYCLE) {
      expect(producerFor(k)).toBeDefined();
    }
  });
  it('every unit kind maps to its producer building', () => {
    expect(producerFor('infantry')).toBe('barracks');
    expect(producerFor('archer')).toBe('archery');
    expect(producerFor('cavalry')).toBe('stables');
    expect(producerFor('hero')).toBe('fortress');
  });
});
