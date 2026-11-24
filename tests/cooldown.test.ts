import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import {
  isCooldownLog,
  SessionLogSchema,
  SessionSchema,
  type Exercise,
  type Programme,
  type SessionLog,
} from '../src/domain';
import {
  buildCooldown,
  calendarWeekActivity,
  COOLDOWN_BUDGET_SEC,
  COOLDOWN_CLOSERS,
  COOLDOWN_TRANSITION_SEC,
  MUSCLE_GROUPS,
  exerciseTimes,
  hardSetsOfLog,
  nextSession,
  pauseBetween,
  playSteps,
  pointsByExercise,
  programmeTimes,
  programmeWeekSets,
  recordPoints,
  sessionSeconds,
  trainedGroups,
  type CooldownInput,
} from '../src/engine';
import { exposuresOf } from '../src/engine/progress/exposures';
import { setsCsv } from '../src/db/csv';
import { referenceEquipment } from './fixtures/reference-equipment';
import { referenceProgramme } from './fixtures/reference-programme';
import { kg, makeLog, values } from './support/logs';

const programme = referenceProgramme as Programme & { id: string };
const T0 = Date.parse('2026-03-02T09:00:00.000Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(T0 + days * DAY).toISOString();

const done = (
  id: string,
  exercises: string[],
  over: Partial<Parameters<typeof makeLog>[0]> = {},
): SessionLog =>
  makeLog({
    id,
    at: at(0),
    main: exercises.map((exerciseId) => ({ exerciseId, sets: values(10, 10, 10) })),
    ...over,
  });

const build = (after: SessionLog, over: Partial<CooldownInput> = {}) =>
  buildCooldown({ after, profile: undefined, inventory: referenceEquipment, ...over });

const items = (s: ReturnType<typeof build>) =>
  s.main.map((b) => (b.type === 'straight' ? b.item : undefined)!);
const entries = (s: ReturnType<typeof build>) =>
  items(s).map((i) => ({ item: i, exercise: exerciseById.get(i.exerciseId)! }));
const stretches = (s: ReturnType<typeof build>) => entries(s).slice(0, -1);
const closerOf = (s: ReturnType<typeof build>) => entries(s).at(-1)!;

const seconds = (s: ReturnType<typeof build>) => {
  const list = entries(s);
  const total = list.reduce((n, { item, exercise }) => {
    const t = item.target as { maxSec: number };
    return n + (exercise.unilateral ? t.maxSec * 2 + 5 : t.maxSec);
  }, 0);
  return total + 10 * (list.length - 1);
};

const SQUAT_DAY = ['goblet-squat', 'romanian-deadlift', 'push-up', 'dumbbell-row'];

describe('stretch positions', () => {
  it('are set on every stretch and only there', () => {
    for (const e of exerciseById.values())
      expect(e.position !== undefined, e.id).toBe(e.tags.includes('stretch'));
  });
});

describe('buildCooldown', () => {
  it('is deterministic for the same session', () => {
    const log = done('log-1', SQUAT_DAY);
    expect(build(log)).toEqual(build(log));
  });

  it('is a valid session of single timed holds, no load and no RIR', () => {
    const s = build(done('log-1', SQUAT_DAY));
    expect(SessionSchema.safeParse(s).success).toBe(true);
    expect(s.name.en).toBe('Cooldown');
    expect(s.warmup).toEqual([]);
    expect(s.finisher).toEqual([]);
    for (const b of s.main) {
      expect(b.type === 'straight' && b.sets).toBe(1);
      const item = (b as { item: { target: { kind: string }; load?: unknown; rir?: unknown } })
        .item;
      expect(item.target.kind).toBe('time');
      expect(item.load).toBeUndefined();
      expect(item.rir).toBeUndefined();
    }
  });

  it('moves between stretches in its own short time, and fits its budget', () => {
    const s = build(done('log-1', SQUAT_DAY));
    expect(s.transitionSec).toBe(COOLDOWN_TRANSITION_SEC);
    const steps = playSteps(s);
    const into = steps.findIndex((step) => step.blockIndex === 1);
    expect(pauseBetween(steps[into - 1]!, steps[into])).toEqual({
      kind: 'block',
      seconds: COOLDOWN_TRANSITION_SEC,
    });
    expect(sessionSeconds(s)).toBeLessThanOrEqual(COOLDOWN_BUDGET_SEC);
  });

  it('varies between sessions', () => {
    const variants = new Set(
      Array.from({ length: 12 }, (_, i) =>
        stretches(build(done(`log-${i}`, SQUAT_DAY)))
          .map((e) => e.exercise.id)
          .join(),
      ),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it('stretches the trained groups, one each, from the first one worked', () => {
    const log = done('log-1', ['goblet-squat', 'push-up', 'dumbbell-row']);
    const order = trainedGroups(log);
    expect(order.slice(0, 3)).toEqual(['quads', 'glutes', 'chest']);
    const list = stretches(build(log));
    expect(new Set(list.map((e) => e.exercise.id)).size).toBe(list.length);
    // The leading groups are covered, in their order of appearance: stretches kept as many as fit.
    const covers = (g: string) =>
      list.some((e) =>
        e.exercise.primaryMuscles.some((m) =>
          ((MUSCLE_GROUPS as Record<string, readonly string[]>)[g] ?? [g]).includes(m),
        ),
      );
    const covered = order.map(covers);
    const firstGap = covered.indexOf(false);
    expect(covered.slice(0, firstGap < 0 ? covered.length : firstGap).every(Boolean)).toBe(true);
    expect(covered.slice(0, 3)).toEqual([true, true, true]);
  });

  it('ignores warm-up, cardio and flagged sets when finding what was trained', () => {
    const log = makeLog({
      id: 'log-1',
      at: at(0),
      warmup: [{ exerciseId: 'goblet-squat', sets: values(10) }],
      main: [
        { exerciseId: 'push-up', sets: values(10, 10) },
        { exerciseId: 'dumbbell-row', sets: [{ flag: 'pain' }] },
        {
          exerciseId: 'brisk-walk',
          target: { kind: 'cardio', minMinutes: 5, maxMinutes: 5 },
          sets: values(5),
        },
      ],
    });
    expect(trainedGroups(log)).toEqual(['chest']);
  });

  it('orders standing, then chair, then floor, with one closer always last', () => {
    for (let i = 0; i < 20; i++) {
      const s = build(done(`log-${i}`, SQUAT_DAY));
      const list = entries(s);
      const rank = { standing: 0, chair: 1, floor: 2 } as const;
      const body = list.slice(0, -1).map((e) => rank[e.exercise.position!]);
      expect(body).toEqual([...body].sort());
      const closers = list.filter((e) => COOLDOWN_CLOSERS.includes(e.exercise.id));
      expect(closers).toHaveLength(1);
      expect(COOLDOWN_CLOSERS).toContain(list.at(-1)!.exercise.id);
      expect(closerOf(s).item.target).toEqual({ kind: 'time', minSec: 60, maxSec: 60 });
    }
  });

  it('never picks a breathing drill for a muscle', () => {
    for (let i = 0; i < 20; i++) {
      const s = build(done(`log-${i}`, ['crunch', 'plank', 'deadlift']));
      expect(stretches(s).some((e) => COOLDOWN_CLOSERS.includes(e.exercise.id))).toBe(false);
    }
  });

  it('holds 30 s, 20 s for neck, wrist and forearm, and per side when one-sided', () => {
    for (let i = 0; i < 30; i++) {
      const s = build(done(`log-${i}`, ['pull-up', 'dumbbell-row', 'push-up', 'goblet-squat']));
      for (const { item, exercise } of stretches(s)) {
        const short = exercise.primaryMuscles.some((m) => m === 'forearms' || m === 'traps');
        expect((item.target as { maxSec: number }).maxSec).toBe(short ? 20 : 30);
        expect(item.perSide === true).toBe(exercise.unilateral);
      }
    }
  });

  it('gives beginners 20 s on stretches with a moderate joint, others 30 s', () => {
    const moderate = (e: Exercise) => Object.values(e.joints).includes('moderate');
    let seen = 0;
    for (let i = 0; i < 200 && seen < 3; i++) {
      const log = done(`log-${i}`, ['goblet-squat', 'push-up', 'dumbbell-row']);
      const beginner = stretches(build(log, { profile: { level: 'beginner' } }));
      const other = stretches(build(log, { profile: { level: 'intermediate' } }));
      for (const { item, exercise } of beginner)
        if (moderate(exercise)) {
          seen++;
          expect((item.target as { maxSec: number }).maxSec).toBe(20);
        }
      for (const { item, exercise } of other)
        if (moderate(exercise) && !exercise.primaryMuscles.some((m) => m === 'forearms'))
          expect((item.target as { maxSec: number }).maxSec).toBe(30);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('stays within about five minutes, closer and transitions included', () => {
    for (let i = 0; i < 30; i++) {
      const s = build(
        done(`log-${i}`, [
          'goblet-squat',
          'push-up',
          'dumbbell-row',
          'crunch',
          'pull-up',
          'lateral-raise',
        ]),
      );
      expect(seconds(s)).toBeLessThanOrEqual(COOLDOWN_BUDGET_SEC);
      expect(s.estimatedMinutes).toBe(Math.ceil(seconds(s) / 60));
    }
  });

  it('stops adding stretches before the budget would be exceeded', () => {
    const wide = done('log-1', [
      'goblet-squat',
      'romanian-deadlift',
      'push-up',
      'dumbbell-row',
      'crunch',
      'lateral-raise',
      'barbell-curl',
      'calf-raise',
    ]);
    const s = build(wide);
    expect(stretches(s).length).toBeLessThan(trainedGroups(wide).length);
    expect(seconds(s)).toBeLessThanOrEqual(COOLDOWN_BUDGET_SEC);
  });

  it('falls back to a general set for a cardio-only session', () => {
    const log = makeLog({
      id: 'cardio',
      at: at(0),
      main: [
        {
          exerciseId: 'brisk-walk',
          target: { kind: 'cardio', minMinutes: 20, maxMinutes: 20 },
          sets: values(20),
        },
      ],
    });
    expect(trainedGroups(log)).toEqual([]);
    const s = build(log);
    const muscles = stretches(s).flatMap((e) => e.exercise.primaryMuscles);
    expect(stretches(s).length).toBeGreaterThanOrEqual(3);
    expect(muscles).toEqual(expect.arrayContaining(['hip-flexors', 'hamstrings', 'chest']));
    expect(COOLDOWN_CLOSERS).toContain(closerOf(s).exercise.id);
  });

  it('keeps stretches that fit the constraints', () => {
    const profile = {
      level: 'intermediate' as const,
      limitations: [
        { region: 'knee' as const, since: '2026-01-01' },
        { region: 'shoulder' as const, since: '2026-01-01' },
      ],
    };
    for (let i = 0; i < 30; i++) {
      const s = build(
        done(`log-${i}`, ['goblet-squat', 'push-up', 'dumbbell-row', 'lateral-raise']),
        { profile },
      );
      const used = new Set<string>();
      for (const { exercise } of stretches(s)) {
        for (const region of ['knee', 'shoulder'] as const) {
          expect(exercise.joints[region]).not.toBe('high');
          if (exercise.joints[region] === 'moderate') {
            expect(used.has(region), `${exercise.id} ${region}`).toBe(false);
            used.add(region);
          }
        }
      }
    }
  });

  it('only picks stretches the equipment allows', () => {
    for (let i = 0; i < 20; i++) {
      const s = build(done(`log-${i}`, ['goblet-squat', 'push-up']), { inventory: [] });
      for (const { exercise } of entries(s))
        expect(
          exercise.equipment.some((alt) =>
            alt.every((r) => ['mat', 'chair', 'wall', 'door', 'table'].includes(r.kind)),
          ),
        ).toBe(true);
    }
  });

  it('is a log source old backups and new ones both parse', () => {
    const base = done('log-1', SQUAT_DAY);
    for (const source of [
      { kind: 'cooldown' as const },
      { kind: 'cooldown' as const, afterLogId: 'log-1' },
      { kind: 'quick' as const },
    ])
      expect(SessionLogSchema.safeParse({ ...base, source }).success).toBe(true);
  });
});

describe('cooldown logs are not training', () => {
  const cooldownOf = (id: string, days: number, exerciseId = 'push-up', n = 7): SessionLog =>
    done(id, [exerciseId], {
      at: at(days),
      source: { kind: 'cooldown' },
      main: [{ exerciseId, sets: values(...Array(n).fill(10)), load: kg(10) }],
    });

  it('is detected by its source', () => {
    expect(isCooldownLog(cooldownOf('c', 0))).toBe(true);
    expect(isCooldownLog(done('q', []))).toBe(false);
  });

  it('is never progression evidence, even for pain stops', () => {
    const flagged = cooldownOf('c', 1);
    flagged.sets[0]!.flag = 'pain';
    for (const anySource of [false, true])
      expect(
        exposuresOf('push-up', [cooldownOf('c0', 0), flagged], [programme], { anySource }),
      ).toEqual([]);
    const quick = done('q', ['push-up'], { at: at(2) });
    expect(exposuresOf('push-up', [flagged, quick], [programme], { anySource: true })).toHaveLength(
      1,
    );
  });

  it('never breaks a gap', () => {
    expect(programmeTimes([cooldownOf('c', 0, 'push-up', 8)])).toEqual([]);
    const press = exerciseById.get('push-up')!;
    expect(exerciseTimes(press, [cooldownOf('c', 0)], exerciseById)).toEqual([]);
    const quick = done('q', ['push-up'], { at: at(3) });
    expect(exerciseTimes(press, [cooldownOf('c', 0), quick], exerciseById)).toEqual([T0 + 3 * DAY]);
  });

  it('never counts in hard sets, weekly sets or activity', () => {
    const log = cooldownOf('c', 0);
    expect(Object.values(hardSetsOfLog(log)).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    const week = programmeWeekSets({
      programme,
      week: 1,
      logs: [log],
      programmeStartedAt: at(-1),
    });
    expect(week.rows.every((r) => r.done === 0)).toBe(true);
    const activity = calendarWeekActivity([log], new Date(T0 + 1000));
    expect(activity.sessions).toBe(0);
    expect(activity.bySource).toEqual({ programme: 0, custom: 0, quick: 0 });
    expect(activity.activeSeconds).toBe(0);
  });

  it('never makes exercise points or records', () => {
    const logs = [
      done('a', ['push-up'], { at: at(0) }),
      done('b', ['push-up'], { at: at(1) }),
      done('c', ['push-up'], { at: at(2) }),
      makeLog({
        id: 'cd',
        at: at(3),
        source: { kind: 'cooldown' },
        main: [{ exerciseId: 'push-up', sets: values(40, 40, 40) }],
      }),
    ];
    expect(
      pointsByExercise(logs, [])
        .get('push-up')!
        .map((p) => p.logId),
    ).toEqual(['a', 'b', 'c']);
    expect(recordPoints('push-up', logs, [])).toEqual([]);
  });

  it('never makes a record for a stretch, whatever the source', () => {
    const hold = (id: string, days: number, sec: number) =>
      makeLog({
        id,
        at: at(days),
        main: [
          {
            exerciseId: 'childs-pose',
            target: { kind: 'time', minSec: 20, maxSec: 60 },
            sets: values(sec),
          },
        ],
      });
    const logs = [hold('a', 0, 20), hold('b', 1, 25), hold('c', 2, 30), hold('d', 3, 55)];
    expect(recordPoints('childs-pose', logs, [])).toEqual([]);
  });

  it('never advances a rotation', () => {
    const own = done('p', ['push-up'], {
      at: at(0),
      source: {
        kind: 'programme',
        programmeId: programme.id,
        week: 1,
        sessionId: programme.rotation[0]!.id,
      },
    });
    const before = nextSession(programme, [own]);
    const after = nextSession(programme, [own, cooldownOf('c', 1), cooldownOf('c2', 2)]);
    expect(after).toEqual(before);
  });

  it('is in the CSV with its source kind', () => {
    const log = makeLog({
      id: 'cd',
      at: at(0),
      source: { kind: 'cooldown', afterLogId: 'x' },
      main: [
        {
          exerciseId: 'childs-pose',
          target: { kind: 'time', minSec: 30, maxSec: 30 },
          sets: values(30),
        },
      ],
    });
    const csv = setsCsv([log], 'en', () => undefined);
    expect(csv.split('\r\n')[1]!.split(',')[3]).toBe('cooldown');
  });
});
