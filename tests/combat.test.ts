import { describe, expect, it } from 'vitest';
import { computeDamage, damageMultiplier } from '../src/game/combat';
import { HERO_BONUS, TRIANGLE_BONUS, WARCRY_DMG_MULT } from '../src/game/config';

describe('combat triangle', () => {
  it('infantry beats cavalry', () => {
    expect(damageMultiplier('infantry', 'cavalry')).toBe(TRIANGLE_BONUS);
  });
  it('cavalry beats archers', () => {
    expect(damageMultiplier('cavalry', 'archer')).toBe(TRIANGLE_BONUS);
  });
  it('archers beat infantry', () => {
    expect(damageMultiplier('archer', 'infantry')).toBe(TRIANGLE_BONUS);
  });
  it('off-triangle matchups deal flat damage', () => {
    expect(damageMultiplier('infantry', 'archer')).toBe(1);
    expect(damageMultiplier('cavalry', 'infantry')).toBe(1);
    expect(damageMultiplier('archer', 'cavalry')).toBe(1);
    expect(damageMultiplier('infantry', 'infantry')).toBe(1);
  });
  it('hero is strong vs everything', () => {
    for (const t of ['infantry', 'archer', 'cavalry', 'hero'] as const) {
      expect(damageMultiplier('hero', t)).toBe(HERO_BONUS);
    }
  });
  it('everyone deals flat damage to the hero', () => {
    expect(damageMultiplier('infantry', 'hero')).toBe(1);
    expect(damageMultiplier('archer', 'hero')).toBe(1);
    expect(damageMultiplier('cavalry', 'hero')).toBe(1);
  });
});

describe('computeDamage', () => {
  it('applies the triangle multiplier to base damage', () => {
    expect(computeDamage(12, 'infantry', 'cavalry', false, WARCRY_DMG_MULT)).toBeCloseTo(
      12 * TRIANGLE_BONUS,
    );
  });
  it('applies the war-cry buff multiplicatively', () => {
    expect(computeDamage(12, 'infantry', 'cavalry', true, WARCRY_DMG_MULT)).toBeCloseTo(
      12 * TRIANGLE_BONUS * WARCRY_DMG_MULT,
    );
  });
  it('flat damage without bonus or buff', () => {
    expect(computeDamage(10, 'archer', 'archer', false, WARCRY_DMG_MULT)).toBe(10);
  });
});
