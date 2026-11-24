import { describe, expect, it } from 'vitest';
import { generateProgramme } from '@/engine';
import type { EquipmentInventory, Profile } from '@/domain';
import { equipmentSets } from '../../../../tests/fixtures/equipment-sets';
import { referenceEquipment } from '../../../../tests/fixtures/reference-equipment';
import { coverageOf, PAUSE_BELOW } from './coverage';

const profile: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
};
const programme = generateProgramme({ profile, equipment: referenceEquipment });

describe('travel kit coverage', () => {
  it('the whole home kit covers every session', () => {
    const coverage = coverageOf(programme, referenceEquipment, profile);
    expect(coverage.rows).toHaveLength(programme.rotation.length);
    expect(coverage.mean).toBe(1);
    expect(coverage.suggestPause).toBe(false);
    expect(coverage.rows.every((r) => r.swapped === 0 && r.dropped === 0 && !r.low)).toBe(true);
  });

  it('an empty kit swaps or drops what needs equipment', () => {
    const coverage = coverageOf(programme, [], profile);
    expect(coverage.mean).toBeLessThan(1);
    expect(coverage.rows.some((r) => r.swapped > 0 || r.dropped > 0)).toBe(true);
    for (const row of coverage.rows) {
      expect(row.share).toBeGreaterThanOrEqual(0);
      expect(row.share).toBeLessThanOrEqual(1);
      expect(row.low).toBe(row.share < PAUSE_BELOW);
    }
  });

  it('is the mean of the sessions, and suggests a pause under half', () => {
    const coverage = coverageOf(programme, [], profile);
    const mean = coverage.rows.reduce((n, r) => n + r.share, 0) / coverage.rows.length;
    expect(coverage.mean).toBeCloseTo(mean, 10);
    expect(coverage.suggestPause).toBe(mean < PAUSE_BELOW);
  });

  it('a bodyweight programme loses nothing with an empty kit', () => {
    const bodyweight: EquipmentInventory = equipmentSets.bodyweight!;
    const own = generateProgramme({ profile, equipment: bodyweight });
    expect(coverageOf(own, [], profile).mean).toBeGreaterThan(0.9);
  });
});
