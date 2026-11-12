import { describe, expect, it } from 'vitest';
import { CATALOGUE_FAMILIES, FAMILY_PATTERNS, catalogue, exerciseById } from '../src/catalogue';
import { ExerciseSchema, MOVEMENT_PATTERNS } from '../src/domain';

describe('exercise catalogue', () => {
  it('every entry matches the schema', () => {
    const failures = catalogue.flatMap((ex) => {
      const result = ExerciseSchema.safeParse(ex);
      return result.success
        ? []
        : result.error.issues.map((i) => `${ex.id}: ${i.path.join('.')} ${i.message}`);
    });
    expect(failures).toEqual([]);
  });

  it('ids are unique across families', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [family, exercises] of Object.entries(CATALOGUE_FAMILIES)) {
      for (const ex of exercises) {
        const other = seen.get(ex.id);
        if (other) duplicates.push(`${ex.id} in ${other} and ${family}`);
        seen.set(ex.id, family);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('assigns every movement pattern to exactly one family', () => {
    const assigned = Object.values(FAMILY_PATTERNS).flat();
    expect([...assigned].sort()).toEqual([...MOVEMENT_PATTERNS].sort());
  });

  it('keeps each exercise in the family that owns its pattern', () => {
    const misplaced = Object.entries(CATALOGUE_FAMILIES).flatMap(([family, exercises]) => {
      const allowed: readonly string[] = FAMILY_PATTERNS[family as keyof typeof FAMILY_PATTERNS];
      return exercises
        .filter((ex) => !allowed.includes(ex.pattern))
        .map((ex) => `${ex.id} (${ex.pattern}) is in ${family}`);
    });
    expect(misplaced).toEqual([]);
  });

  it('progression links point to existing exercises', () => {
    const dangling = catalogue.flatMap((ex) =>
      [...ex.easier, ...ex.harder]
        .filter((id) => !exerciseById.has(id))
        .map((id) => `${ex.id} → ${id}`),
    );
    expect(dangling).toEqual([]);
  });

  it('progression links are symmetric', () => {
    const asymmetric = catalogue.flatMap((ex) => [
      ...ex.harder
        .filter((id) => !exerciseById.get(id)?.easier.includes(ex.id))
        .map((id) => `${ex.id} lists ${id} as harder, but not the reverse`),
      ...ex.easier
        .filter((id) => !exerciseById.get(id)?.harder.includes(ex.id))
        .map((id) => `${ex.id} lists ${id} as easier, but not the reverse`),
    ]);
    expect(asymmetric).toEqual([]);
  });

  it('harder variants are at least as difficult', () => {
    const inverted = catalogue.flatMap((ex) =>
      ex.harder
        .filter((id) => (exerciseById.get(id)?.difficulty ?? Infinity) < ex.difficulty)
        .map((id) => `${id} is marked harder than ${ex.id} but has a lower difficulty`),
    );
    expect(inverted).toEqual([]);
  });
});
