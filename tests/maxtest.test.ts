import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { Answer, MaxTest, Programme, SessionItem, SessionLog, SetLog } from '../src/domain';
import {
  defaultTestExercise,
  generateProgramme,
  isTestable,
  liftFromTest,
  previousTest,
  scheduledTest,
  testBlockedByPain,
  testExerciseFor,
  testPlacement,
  type TestContext,
} from '../src/engine';
import type { Exposure } from '../src/engine/progress/exposures';
import { referenceEquipment } from './fixtures/reference-equipment';
import { referenceProgramme } from './fixtures/reference-programme';

const ex = (id: string) => {
  const e = exerciseById.get(id);
  if (!e) throw new Error(`unknown ${id}`);
  return e;
};

const ctx = (extra: Partial<TestContext> = {}): TestContext => ({
  logs: [],
  programmes: [referenceProgramme],
  answers: [],
  maxTests: [],
  inventory: referenceEquipment,
  level: 'intermediate',
  ...extra,
});

let day = 0;
/** A quick session of 3 sets of one exercise, the last one stopped for pain when asked. */
const logOf = (exerciseId: string, pain = false): SessionLog => {
  day += 1;
  const at = new Date(Date.UTC(2026, 9, day, 18)).toISOString();
  const set = (n: number, flag?: 'pain'): SetLog => ({
    section: 'main',
    blockIndex: 0,
    itemIndex: 0,
    set: n,
    exerciseId,
    planned: { target: { kind: 'reps', min: 8, max: 12 }, goal: 10 },
    ...(flag ? { flag } : { actual: { reps: 10 } }),
    at,
  });
  return {
    id: `log-${day}`,
    source: { kind: 'quick' },
    plan: {
      id: 'q',
      name: { fr: 'Q', en: 'Q' },
      estimatedMinutes: 20,
      warmup: [],
      main: [
        {
          type: 'straight',
          item: { exerciseId, target: { kind: 'reps', min: 8, max: 12 } },
          sets: 3,
          restSec: 60,
        },
      ],
      finisher: [],
    },
    status: 'completed',
    startedAt: at,
    endedAt: at,
    sets: [set(1), set(2), set(3, pain ? 'pain' : undefined)],
  };
};

const answer = (exerciseId: string, substituteId: string, kind: Answer['kind']): Answer => ({
  id: `a-${exerciseId}`,
  exerciseId,
  kind,
  logId: 'log-x',
  answer: 'swap',
  substituteId,
  at: '2026-10-01T10:00:00.000Z',
});

describe('max tests', () => {
  it('only tests bodyweight presses, pulls and squats on both sides, and a few holds', () => {
    for (const id of [
      'push-up',
      'knee-push-up',
      'pull-up',
      'bodyweight-squat',
      'plank',
      'wall-sit',
    ])
      expect(isTestable(ex(id)), id).toBe(true);
    for (const id of [
      'negative-pull-up',
      'nordic-curl-eccentric',
      'wall-handstand-hold',
      'side-plank',
      'jump-squat',
      'goblet-squat',
      'bulgarian-split-squat',
      'good-morning',
    ])
      expect(isTestable(ex(id)), id).toBe(false);
    expect(isTestable(ex('archer-push-up'), 'beginner')).toBe(false);
  });

  it("follows the programme's exercise, its swap, or stops after a pain swap", () => {
    expect(testExerciseFor(referenceProgramme, 8, ctx())).toBe('push-up');
    expect(testExerciseFor(referenceProgramme, 3, ctx())).toBeUndefined();
    const swapped = ctx({ answers: [answer('push-up', 'knee-push-up', 'easier')] });
    expect(testExerciseFor(referenceProgramme, 8, swapped)).toBe('knee-push-up');
    const hurt = ctx({ answers: [answer('push-up', 'incline-push-up', 'pain')] });
    expect(testExerciseFor(referenceProgramme, 8, hurt)).toBeUndefined();
  });

  it('runs at the end of a session that leaves the tested muscles alone', () => {
    const at = testPlacement(referenceProgramme, 8, 'push-up', ctx())!;
    expect(at.placement).toBe('end');
    const session = referenceProgramme.rotation.find((s) => s.id === at.sessionId)!;
    const chestWork = [...session.main, ...session.finisher]
      .flatMap((b) => (b.type === 'straight' ? [b.item] : b.items))
      .some((i) => ex(i.exerciseId).primaryMuscles.includes('chest'));
    expect(chestWork).toBe(false);
  });

  it('runs right after the warm-up when every session of the week works those muscles', () => {
    const programme: Programme = generateProgramme({
      profile: { goal: 'muscle', level: 'intermediate', daysPerWeek: 2, sessionMinutes: 45 },
      equipment: referenceEquipment,
    });
    const week = programme.weeks;
    const exerciseId = testExerciseFor(programme, week, ctx({ programmes: [programme] }))!;
    const at = testPlacement(programme, week, exerciseId, ctx({ programmes: [programme] }))!;
    expect(at).toEqual({ sessionId: programme.rotation[0]!.id, placement: 'after-warmup' });
  });

  it('waits for two pain-free sessions of the movement after a pain stop', () => {
    const hurt = logOf('incline-push-up', true);
    expect(testBlockedByPain('push-up', ctx({ logs: [hurt] }))).toBe(true);
    const one = logOf('push-up');
    expect(testBlockedByPain('push-up', ctx({ logs: [hurt, one] }))).toBe(true);
    const two = logOf('push-up');
    expect(testBlockedByPain('push-up', ctx({ logs: [hurt, one, two] }))).toBe(false);
    // A row hurting says nothing about pressing.
    expect(testBlockedByPain('push-up', ctx({ logs: [logOf('pull-up', true)] }))).toBe(false);
  });

  it('counts a test stopped for pain as a pain stop', () => {
    const stopped: MaxTest = {
      id: 't1',
      date: '2026-10-20',
      at: '2026-10-20T18:00:00.000Z',
      exerciseId: 'push-up',
      context: 'fresh',
      result: { kind: 'reps', reps: 6 },
      stopped: 'pain',
    };
    expect(testBlockedByPain('push-up', ctx({ maxTests: [stopped] }))).toBe(true);
  });

  it('schedules the test once, in its session, unless the movement hurt lately', () => {
    const at = testPlacement(referenceProgramme, 8, 'push-up', ctx())!;
    expect(scheduledTest(referenceProgramme, at.sessionId, 8, ctx())).toEqual({
      kind: 'run',
      test: { exerciseId: 'push-up', kind: 'reps', placement: 'end' },
    });
    const other = referenceProgramme.rotation.find((s) => s.id !== at.sessionId)!;
    expect(scheduledTest(referenceProgramme, other.id, 8, ctx())).toBeUndefined();
    const done: MaxTest = {
      id: 't',
      date: '2026-12-01',
      at: '2026-12-01T18:00:00.000Z',
      exerciseId: 'push-up',
      context: 'session',
      programmeId: referenceProgramme.id,
      result: { kind: 'reps', reps: 24 },
    };
    expect(
      scheduledTest(referenceProgramme, at.sessionId, 8, ctx({ maxTests: [done] })),
    ).toBeUndefined();
    const hurt = ctx({ logs: [logOf('push-up', true)] });
    expect(scheduledTest(referenceProgramme, at.sessionId, 8, hurt)).toEqual({
      kind: 'pain',
      exerciseId: 'push-up',
    });
  });

  it('compares like with like and offers a sensible default', () => {
    const t = (id: string, at: string, context: MaxTest['context'], reps: number): MaxTest => ({
      id,
      date: at.slice(0, 10),
      at,
      exerciseId: 'push-up',
      context,
      result: { kind: 'reps', reps },
    });
    const all = [
      t('a', '2026-09-01T18:00:00.000Z', 'session', 18),
      t('b', '2026-10-01T18:00:00.000Z', 'fresh', 22),
      t('c', '2026-11-01T18:00:00.000Z', 'session', 24),
    ];
    expect(previousTest(all[2]!, all)?.id).toBe('a');
    expect(defaultTestExercise(referenceProgramme, ctx())).toBe('push-up');
    expect(defaultTestExercise(undefined, ctx({ level: 'beginner' }))).toBe('knee-push-up');
    expect(
      defaultTestExercise(
        undefined,
        ctx({ maxTests: [t('d', '2026-11-02T00:00:00.000Z', 'fresh', 9)] }),
      ),
    ).toBe('push-up');
  });
});

describe('a max test lifts the goal', () => {
  const pushUp = {
    exerciseId: 'push-up',
    target: { kind: 'reps', min: 8, max: 12 },
    rir: 2,
  } as const;
  const plank = { exerciseId: 'plank', target: { kind: 'time', minSec: 30, maxSec: 60 } } as const;
  const exposure = { at: '2026-11-01T18:00:00.000Z' } as Exposure;
  const test = (result: MaxTest['result'], at = '2026-11-05T18:00:00.000Z'): MaxTest => ({
    id: at,
    date: at.slice(0, 10),
    at,
    exerciseId: result.kind === 'reps' ? 'push-up' : 'plank',
    context: 'fresh',
    result,
  });
  const lift = (
    item: SessionItem,
    tests: MaxTest[],
    extra: Partial<Parameters<typeof liftFromTest>[1]> = {},
  ) =>
    liftFromTest(
      { item },
      {
        base: item,
        exercise: ex(item.exerciseId),
        exposures: [exposure],
        context: 'straight',
        tests,
        ...extra,
      },
    );

  it('by two reps at most, within the range, from the test minus the reserve', () => {
    const out = lift({ ...pushUp, goal: 9 }, [test({ kind: 'reps', reps: 20 })]);
    expect(out.item.goal).toBe(11);
    expect(out.note?.code).toBe('from-test');
    expect(lift({ ...pushUp, goal: 11 }, [test({ kind: 'reps', reps: 30 })]).item.goal).toBe(12);
    // 12 reps at the limit: 9 at two in reserve, under the current goal.
    expect(lift({ ...pushUp, goal: 10 }, [test({ kind: 'reps', reps: 12 })]).item.goal).toBe(10);
  });

  it('holds to 70 % of the test, ten seconds at most', () => {
    expect(lift({ ...plank, goal: 40 }, [test({ kind: 'time', seconds: 90 })]).item.goal).toBe(50);
    expect(lift({ ...plank, goal: 40 }, [test({ kind: 'time', seconds: 60 })]).item.goal).toBe(40);
  });

  it('only from a newer test, at bodyweight, in straight sets, outside a deload', () => {
    const newer = [test({ kind: 'reps', reps: 20 })];
    const older = [test({ kind: 'reps', reps: 20 }, '2026-10-01T18:00:00.000Z')];
    expect(lift({ ...pushUp, goal: 9 }, older).item.goal).toBe(9);
    expect(lift({ ...pushUp, goal: 9 }, newer, { role: 'deload' }).item.goal).toBe(9);
    expect(lift({ ...pushUp, goal: 9 }, newer, { context: 'group' }).item.goal).toBe(9);
    expect(lift({ ...pushUp, goal: 9, load: { kind: 'added-kg', kg: 5 } }, newer).item.goal).toBe(
      9,
    );
    const stopped = [{ ...newer[0]!, stopped: 'pain' as const }];
    expect(lift({ ...pushUp, goal: 9 }, stopped).item.goal).toBe(9);
  });
});

describe('a test stopped for pain', () => {
  it('holds the exercise and offers nothing harder until it goes well twice', async () => {
    const { prepareSession } = await import('../src/engine');
    const { simulate, oneTap } = await import('./support/simulate');
    const sim = simulate(referenceProgramme, referenceEquipment, oneTap, { sessions: 24 });
    const session = referenceProgramme.rotation.find((s) =>
      s.main.some((b) => b.type === 'straight' && b.item.exerciseId === 'push-up'),
    );
    if (!session) return;
    const at = new Date(Date.parse(sim.logs.at(-1)!.startedAt) + 3_600_000).toISOString();
    const stopped: MaxTest = {
      id: 'hurt',
      date: at.slice(0, 10),
      at,
      exerciseId: 'push-up',
      context: 'fresh',
      result: { kind: 'reps', reps: 4 },
      stopped: 'pain',
    };
    const prepared = prepareSession(session, {
      logs: sim.logs,
      programmes: [referenceProgramme],
      answers: [],
      maxTests: [stopped],
      inventory: referenceEquipment,
      now: new Date(Date.parse(at) + 86_400_000),
    });
    const notes = Object.values(prepared.notes).filter((n) => n.code === 'hold-pain');
    expect(notes.length).toBeGreaterThan(0);
    expect(prepared.proposals.some((p) => p.exerciseId === 'push-up')).toBe(false);
  });
});
