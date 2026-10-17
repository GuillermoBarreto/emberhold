import { HERO_BONUS, TRIANGLE_BONUS } from './config';
import type { UnitKind } from './types';

// Classic RTS combat triangle: infantry > cavalry > archer > infantry.
// The hero is strong against everything.
export function damageMultiplier(attacker: UnitKind, target: UnitKind): number {
  if (attacker === 'hero') return HERO_BONUS;
  if (attacker === 'infantry' && target === 'cavalry') return TRIANGLE_BONUS;
  if (attacker === 'cavalry' && target === 'archer') return TRIANGLE_BONUS;
  if (attacker === 'archer' && target === 'infantry') return TRIANGLE_BONUS;
  return 1;
}

// Buildings take flat damage (no triangle bonus applies to structures).
export function computeDamage(
  base: number,
  attacker: UnitKind,
  target: UnitKind,
  buffed: boolean,
  buffMult: number,
): number {
  let dmg = base * damageMultiplier(attacker, target);
  if (buffed) dmg *= buffMult;
  return dmg;
}
