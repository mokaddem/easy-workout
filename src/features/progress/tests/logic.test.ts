import { describe, expect, it } from 'vitest';
import { catalogue } from '@/catalogue';
import type { ProgrammeRecord } from '@/db';
import type { MaxTest } from '@/domain';
import { contextOf, matchesName, testableExercises } from './logic';

const test = (over: Partial<MaxTest>): MaxTest => ({
  id: 't',
  date: '2026-11-08',
  at: '2026-11-08T10:00:00.000Z',
  exerciseId: 'push-up',
  context: 'fresh',
  result: { kind: 'reps', reps: 20 },
  ...over,
});

describe('testableExercises', () => {
  it('keeps only whitelisted bodyweight moves and holds, no warm-up drills', () => {
    const list = testableExercises(catalogue, [], 'intermediate');
    expect(list.length).toBeGreaterThan(3);
    expect(list.some((e) => e.id === 'push-up')).toBe(true);
    expect(list.every((e) => !e.tags.includes('warmup') && !e.tags.includes('isolation'))).toBe(
      true,
    );
    expect(list.some((e) => /handstand|negative/.test(e.id))).toBe(false);
  });
  it('respects the level cap', () => {
    const beginner = testableExercises(catalogue, [], 'beginner');
    const advanced = testableExercises(catalogue, [], 'advanced');
    expect(advanced.length).toBeGreaterThanOrEqual(beginner.length);
  });
});

describe('matchesName', () => {
  it('ignores accents and case, in either language', () => {
    const e = catalogue.find((x) => x.id === 'push-up')!;
    expect(matchesName(e, 'POMPE', 'en')).toBe(true);
    expect(matchesName(e, 'push', 'fr')).toBe(true);
    expect(matchesName(e, 'zzz', 'fr')).toBe(false);
    expect(matchesName(e, '', 'fr')).toBe(true);
  });
});

describe('contextOf', () => {
  const programmes = [
    { id: 'p1', startedAt: '2026-10-01T10:00:00.000Z', generation: { cycle: 2 } },
  ] as unknown as ProgrammeRecord[];
  it('marks a fresh test before the first programme', () => {
    expect(contextOf(test({ at: '2026-09-01T10:00:00.000Z' }), programmes)).toEqual({
      kind: 'fresh',
      beforeProgramme: true,
    });
    expect(contextOf(test({}), programmes)).toEqual({ kind: 'fresh', beforeProgramme: false });
  });
  it('names the cycle of a session test', () => {
    expect(contextOf(test({ context: 'session', programmeId: 'p1' }), programmes)).toEqual({
      kind: 'session',
      cycle: 2,
    });
    expect(contextOf(test({ context: 'session' }), programmes)).toEqual({ kind: 'session' });
  });
});
