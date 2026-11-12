import { describe, expect, it } from 'vitest';
import { generateProgramme, programmeChanges } from '../src/engine';
import { equipmentSets } from './fixtures/equipment-sets';
import { referenceEquipment } from './fixtures/reference-equipment';

const profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 55,
} as const;

describe('programmeChanges', () => {
  it('finds nothing between identical inputs', () => {
    const a = generateProgramme({ profile, equipment: referenceEquipment });
    expect(
      programmeChanges(a, generateProgramme({ profile, equipment: referenceEquipment })),
    ).toEqual([]);
  });

  it('another variation changes some slots but never a main lift', () => {
    for (const equipment of Object.values(equipmentSets)) {
      const before = generateProgramme({ profile, equipment });
      const after = generateProgramme({ profile, equipment, seed: 1 });
      const changes = programmeChanges(before, after);
      const mainSlots = new Set(
        (before.generation?.notes ?? [])
          .filter((n) => n.code.startsWith('exercise-') && String(n.params.slot).includes('main'))
          .map((n) => `${n.ref?.sessionId}|${String(n.params.slot)}`),
      );
      for (const c of changes) expect(mainSlots.has(`${c.sessionId}|${c.slot}`)).toBe(false);
    }
  });

  it('reports exercises gained and lost when equipment changes', () => {
    const before = generateProgramme({ profile, equipment: [] });
    const after = generateProgramme({ profile, equipment: referenceEquipment });
    const changes = programmeChanges(before, after);
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) expect(c.from ?? c.to).toBeTruthy();
  });
});

describe('equipment reasons', () => {
  it('says which first choice the equipment ruled out, and why', () => {
    const programme = generateProgramme({ profile, equipment: referenceEquipment });
    const instead = (programme.generation?.notes ?? []).filter(
      (n) => n.code === 'exercise-preferred' && n.params.instead,
    );
    expect(instead.length).toBeGreaterThan(0);
    // The reference equipment has no bench: bench moves give way to floor versions.
    expect(instead.some((n) => String(n.params.missing).split(',').includes('bench'))).toBe(true);
    for (const n of instead) expect(n.params.instead).not.toBe(n.params.exerciseId);
  });
});
