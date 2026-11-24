import { describe, expect, it } from 'vitest';
import { stretchLowerExercises } from '../src/catalogue/stretch-lower';
import { stretchUpperExercises } from '../src/catalogue/stretch-upper';
import { ExerciseSchema } from '../src/domain';

const stretches = [...stretchLowerExercises, ...stretchUpperExercises];

describe('stretch entries', () => {
  it('match the schema', () => {
    const failures = stretches.flatMap((ex) => {
      const result = ExerciseSchema.safeParse(ex);
      return result.success
        ? []
        : result.error.issues.map((i) => `${ex.id}: ${i.path.join('.')} ${i.message}`);
    });
    expect(failures).toEqual([]);
  });

  it('are unloaded timed holds, never hard on a joint', () => {
    const banned = [
      'warmup',
      'compound',
      'isolation',
      'isometric',
      'plyometric',
      'ballistic',
      'impact',
    ];
    const wrong = stretches.flatMap((ex) =>
      ex.pattern !== 'mobility' ||
      !ex.tags.includes('mobility') ||
      !ex.tags.includes('stretch') ||
      ex.metric !== 'time' ||
      (ex.loadType !== 'bodyweight' && ex.loadType !== 'band') ||
      ex.tags.some((tag) => banned.includes(tag)) ||
      Object.values(ex.joints).includes('high')
        ? [ex.id]
        : [],
    );
    expect(wrong).toEqual([]);
  });

  it('say where they are held', () => {
    expect(stretches.filter((ex) => ex.position === undefined).map((ex) => ex.id)).toEqual([]);
  });

  it('link only to other stretches, both ways', () => {
    const ids = new Set(stretches.map((ex) => ex.id));
    const byId = new Map(stretches.map((ex) => [ex.id, ex]));
    const bad = stretches.flatMap((ex) => [
      ...ex.easier
        .filter((id) => !ids.has(id) || !byId.get(id)?.harder.includes(ex.id))
        .map((id) => `${ex.id} easier ${id}`),
      ...ex.harder
        .filter((id) => !ids.has(id) || !byId.get(id)?.easier.includes(ex.id))
        .map((id) => `${ex.id} harder ${id}`),
    ]);
    expect(bad).toEqual([]);
  });
});
