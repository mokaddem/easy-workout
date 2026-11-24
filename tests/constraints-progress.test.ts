import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { Exercise, JointRegion, Profile, SessionItem, Session } from '../src/domain';
import { constraintsOf, prepareSession, type ProgressContext } from '../src/engine';
import type { Exposure } from '../src/engine/progress/exposures';
import { progressItem } from '../src/engine/progress/rules';
import { referenceEquipment } from './fixtures/reference-equipment';
import { kg, makeLog, reps } from './support/logs';

const SINCE = '2026-01-01T00:00:00.000Z';
const NOW = new Date('2026-06-01T09:00:00.000Z');

const limit = (...regions: JointRegion[]): Partial<Profile> => ({
  limitations: regions.map((region) => ({ region, since: SINCE })),
});

const exposure = (
  exercise: Exercise,
  item: SessionItem,
  evidence: Exposure['evidence'],
): Exposure => ({
  logId: 'log-1',
  at: '2026-05-25T09:00:00.000Z',
  role: 'build',
  exerciseId: exercise.id,
  key: `${exercise.id}|r8-12|straight`,
  itemKey: 'main/0/0',
  item,
  context: 'straight',
  evidence,
  pain: false,
  noEquipment: false,
  touched: true,
});

const sets = (value: number, extra: Partial<Exposure['evidence'][number]> = {}) =>
  [1, 2, 3].map((set) => ({
    set,
    value,
    goal: 12,
    rir: 2,
    feel: 0,
    easy: false,
    hard: false,
    touched: true,
    ...extra,
  }));

describe('progression of an exercise sparing a joint', () => {
  const goblet = exerciseById.get('goblet-squat')!;
  const base: SessionItem = {
    exerciseId: 'goblet-squat',
    target: reps(8, 12),
    rir: 2,
    goal: 12,
    load: kg(12),
  };
  const run = (hard: boolean, doseCap: boolean) => {
    const e = exposure(
      goblet,
      { ...base, goal: 12 },
      sets(14, hard ? { feel: -1, hard: true } : {}),
    );
    return progressItem({
      base,
      section: 'main',
      exercise: goblet,
      exposures: [e],
      all: [e],
      inventory: referenceEquipment,
      level: 'intermediate',
      now: NOW.getTime(),
      ...(doseCap && { doseCap: true }),
    });
  };

  it('steps up as usual without the cap', () => {
    const result = run(true, false);
    expect(result.item.load).toMatchObject({ kind: 'kg' });
    expect((result.item.load as { kg: number }).kg).toBeGreaterThan(12);
  });

  it('holds the weight right after a set picked hard, with a note that counts as at the limit', () => {
    const result = run(true, true);
    expect(result.item.load).toEqual(kg(12));
    expect(result.note?.code).toBe('dose-cap-hold');
  });

  it('steps up when the sets were not picked hard', () => {
    const result = run(false, true);
    expect((result.item.load as { kg: number }).kg).toBeGreaterThan(12);
  });
});

describe('end of a ladder with the harder variants ruled out', () => {
  const wide = exerciseById.get('wide-push-up')!;
  const base: SessionItem = { exerciseId: wide.id, target: reps(8, 12), rir: 2, goal: 12 };
  const staged = { down: 3, pause: 1, up: 1 };
  const run = (constraints?: ReturnType<typeof constraintsOf>) => {
    const e = exposure(wide, { ...base, tempo: staged }, sets(14));
    return progressItem({
      base,
      section: 'main',
      exercise: wide,
      exposures: [e],
      all: [e],
      inventory: [],
      level: 'intermediate',
      now: NOW.getTime(),
      ...(constraints && { constraints }),
    });
  };

  it('offers the harder variant as usual', () => {
    const result = run();
    expect(result.note?.code).toBe('ladder-end');
    expect(result.ladderEnd).toMatchObject({ kind: 'harder' });
  });

  it('stops at more reps with a why when a limitation rules the variant out', () => {
    const result = run(constraintsOf({ ...limit('wrist') }));
    expect(result.note?.code).toBe('ladder-end-limited');
    expect(result.ladderEnd).toEqual({ kind: 'none', limited: true });
  });
});

describe('pain card data', () => {
  const session = (id: string): Session => ({
    id: 's',
    name: { fr: 's', en: 's' },
    estimatedMinutes: 20,
    warmup: [],
    main: [
      {
        type: 'straight',
        item: { exerciseId: id, target: reps(8, 12), rir: 2, load: kg(8) },
        sets: 3,
        restSec: 60,
      },
    ],
    finisher: [],
  });
  const painLogs = (id: string, ats: string[] = ['2026-05-20T09:00:00.000Z']) =>
    ats.map((at, i) =>
      makeLog({
        id: `pain-${i}`,
        at,
        main: [{ exerciseId: id, sets: [{ value: 8, load: kg(8) }, { flag: 'pain' }] }],
      }),
    );
  const proposalFor = (
    id: string,
    extra: Partial<Profile> = {},
    over: Partial<ProgressContext> = {},
    ats?: string[],
  ) => {
    const prepared = prepareSession(session(id), {
      logs: painLogs(id, ats),
      programmes: [],
      answers: [],
      inventory: referenceEquipment,
      profile: { level: 'intermediate', ...extra },
      now: NOW,
      ...over,
    });
    return prepared.proposals.find((p) => p.kind === 'pain');
  };

  it('suggests the joint the exercise is hardest on', () => {
    expect(proposalFor('goblet-squat')?.limitation).toMatchObject({ region: 'knee' });
    expect(proposalFor('goblet-squat')?.limitation?.removes).toBeUndefined();
  });

  it('suggests none when the exercise has no grade, so the card shows a picker', () => {
    expect(exerciseById.get('plank')!.joints).toEqual({});
    const limitation = proposalFor('plank')?.limitation;
    expect(limitation).toBeDefined();
    expect(limitation?.region).toBeUndefined();
  });

  it('skips a joint that is already limited', () => {
    const goblet = exerciseById.get('goblet-squat')!;
    const second = Object.keys(goblet.joints).find((r) => r !== 'knee');
    const limitation = proposalFor('goblet-squat', limit('knee'))?.limitation;
    expect(limitation?.region).toBe(second);
  });

  it('answers as a swap when adding the limitation removes the exercise', () => {
    const limitation = proposalFor('pistol-squat')?.limitation;
    expect(limitation).toMatchObject({ region: 'knee', removes: true });
    const substitute = exerciseById.get(limitation!.substituteId!)!;
    expect(substitute.joints.knee).not.toBe('high');
    expect(substitute.pattern).toBe('squat');
  });

  it('shows the option first on a second stop', () => {
    const ats = ['2026-05-10T09:00:00.000Z', '2026-05-24T09:00:00.000Z'];
    const proposal = proposalFor('dumbbell-bench-press', {}, {}, ats);
    expect(proposal?.repeated).toBe(true);
    expect(proposal?.limitation?.first).toBe(true);
    expect(proposalFor('dumbbell-bench-press')?.limitation?.first).toBeUndefined();
  });

  it('treats a stop on an exercise sparing a limited joint as a second stop', () => {
    const proposal = proposalFor('goblet-squat', limit('knee'));
    expect(proposal?.repeated).toBe(true);
    expect(proposal?.limitation?.first).toBe(true);
    expect(proposalFor('goblet-squat')?.repeated).toBeUndefined();
  });

  it('offers a substitute within the level and the constraints', () => {
    const proposal = proposalFor('goblet-squat', { ...limit('knee'), level: 'beginner' });
    const substitute = exerciseById.get(proposal!.substituteId!)!;
    expect(substitute.difficulty).toBeLessThanOrEqual(2);
    expect(substitute.joints.knee).not.toBe('high');
  });
});
