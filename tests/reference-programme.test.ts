import { describe, expect, it } from 'vitest';
import { catalogue, exerciseById } from '../src/catalogue';
import { ProgrammeSchema, type Block, type Programme } from '../src/domain';
import { equipmentCapabilities, isExerciseAvailable } from '../src/engine';
import { referenceEquipment } from './fixtures/reference-equipment';
import { referenceProgramme } from './fixtures/reference-programme';

const blockExerciseIds = (block: Block): string[] =>
  block.type === 'straight' ? [block.item.exerciseId] : block.items.map((i) => i.exerciseId);

const programmeExerciseIds = (programme: Programme): string[] => [
  ...new Set(
    programme.rotation.flatMap((s) =>
      [...s.warmup, ...s.main, ...s.finisher].flatMap(blockExerciseIds),
    ),
  ),
];

describe('reference programme fixture', () => {
  it('matches the programme schema', () => {
    const result = ProgrammeSchema.safeParse(referenceProgramme);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it.skipIf(catalogue.length === 0)('only uses exercises from the catalogue', () => {
    const missing = programmeExerciseIds(referenceProgramme).filter((id) => !exerciseById.has(id));
    expect(missing).toEqual([]);
  });

  it.skipIf(catalogue.length === 0)('can be done with the equipment it was written for', () => {
    const capabilities = equipmentCapabilities(referenceEquipment);
    const unavailable = programmeExerciseIds(referenceProgramme).filter((id) => {
      const exercise = exerciseById.get(id);
      return exercise && !isExerciseAvailable(exercise, capabilities);
    });
    expect(unavailable).toEqual([]);
  });
});
