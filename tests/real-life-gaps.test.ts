import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { Limitation, MaxTest, Programme, SessionLog } from '../src/domain';
import {
  applyReentry,
  exerciseTimes,
  lastGapEnd,
  longestGapDays,
  playSteps,
  prepareSession,
  programmeTimes,
  REENTRY_FACTOR,
  reentryFor,
  restartOffer,
  scheduledTest,
  sessionForWeek,
  setAdjustments,
  skippedTest,
  testPlacement,
  testSkippedWeeks,
  type ProgressContext,
  type TestContext,
} from '../src/engine';
import { referenceEquipment } from './fixtures/reference-equipment';
import { referenceProgramme } from './fixtures/reference-programme';
import { kg, makeLog, reps, values } from './support/logs';

const DAY = 86_400_000;
const T0 = Date.parse('2026-03-02T09:00:00.000Z');
const at = (days: number) => new Date(T0 + days * DAY).toISOString();
const NOW = (days: number) => new Date(T0 + days * DAY);

const programme = referenceProgramme as Programme & { id: string };
const perWeek = programme.sessionsPerWeek;

const progLog = (
  id: string,
  days: number,
  over: Partial<Parameters<typeof makeLog>[0]> = {},
): SessionLog =>
  makeLog({
    id,
    at: at(days),
    source: { kind: 'programme', programmeId: programme.id, week: 1, sessionId: 'a-push' },
    main: [{ exerciseId: 'dumbbell-floor-press', load: kg(10), sets: values(10, 10, 10) }],
    ...over,
  });

const quickLog = (id: string, days: number, setCount: number, exerciseId = 'push-up') =>
  makeLog({
    id,
    at: at(days),
    main: [{ exerciseId, sets: values(...Array(setCount).fill(10)) }],
  });

describe('gap timelines', () => {
  it('keeps the programme going with completed programme sessions or enough working sets', () => {
    const logs = [
      progLog('done', 0),
      progLog('abandoned-short', 1, {
        status: 'abandoned',
        main: [{ exerciseId: 'push-up', sets: values(8, 8) }],
      }),
      progLog('abandoned-long', 2, {
        status: 'abandoned',
        main: [{ exerciseId: 'push-up', sets: values(8, 8, 8, 8, 8, 8) }],
      }),
      quickLog('quick-short', 3, 5),
      quickLog('quick-long', 4, 6),
    ];
    expect(programmeTimes(logs)).toEqual([0, 2, 4].map((d) => T0 + d * DAY));
  });

  it('does not count warm-up, cardio or flagged sets as working sets', () => {
    const log = makeLog({
      id: 'x',
      at: at(0),
      warmup: [{ exerciseId: 'arm-circles', sets: values(10, 10, 10) }],
      main: [
        {
          exerciseId: 'push-up',
          sets: [{ value: 8 }, { value: 8 }, { flag: 'pain' }, { flag: 'pain' }],
        },
        {
          exerciseId: 'brisk-walk',
          target: { kind: 'cardio', minMinutes: 15, maxMinutes: 15 },
          sets: values(900),
        },
      ],
    });
    expect(programmeTimes([log])).toEqual([]);
  });

  it('counts a quick session for an exercise from 3 working sets on its primary muscles', () => {
    const press = exerciseById.get('dumbbell-floor-press')!;
    expect(press.primaryMuscles).toContain('chest');
    const logs = [
      quickLog('three', 10, 3, 'push-up'),
      quickLog('two', 11, 2, 'push-up'),
      quickLog('legs', 12, 5, 'goblet-squat'),
    ];
    expect(exerciseTimes(press, logs, exerciseById)).toEqual([T0 + 10 * DAY]);
  });

  it('does not let a travel session that dropped the exercise break its gap', () => {
    const press = exerciseById.get('dumbbell-floor-press')!;
    const travel = progLog('trip', 20, {
      adjustments: { travel: { substitutions: {}, dropped: ['main/0/0:dumbbell-floor-press:3'] } },
    });
    const other = progLog('trip-other', 21, {
      adjustments: { travel: { substitutions: {}, dropped: ['main/1/0:goblet-squat:3'] } },
    });
    expect(exerciseTimes(press, [travel, other], exerciseById)).toEqual([T0 + 21 * DAY]);
  });

  it('measures every boundary as strictly more than the limit', () => {
    expect(lastGapEnd([T0, T0 + 28 * DAY], T0 + 28 * DAY)).toBeUndefined();
    expect(lastGapEnd([T0, T0 + 28 * DAY + 1], T0 + 28 * DAY + 1)).toBe(T0 + 28 * DAY + 1);
    expect(lastGapEnd([T0], T0 + 28 * DAY)).toBeUndefined();
    expect(lastGapEnd([T0], T0 + 29 * DAY)).toBe(T0 + 29 * DAY);
    expect(restartOffer([progLog('a', 0)], NOW(84))).toBeUndefined();
    expect(restartOffer([progLog('a', 0)], NOW(85))?.days).toBe(85);
  });

  it('counts paused days in the gap', () => {
    // 20 days without a session, 12 of them paused: still a 20 day gap.
    expect(longestGapDays([T0], T0, T0 + 20 * DAY)).toBe(20);
  });
});

describe('re-entry rotation', () => {
  it('starts when the session being prepared ends a gap over 28 days', () => {
    expect(reentryFor([progLog('a', 0)], perWeek, NOW(28))).toBeUndefined();
    expect(reentryFor([progLog('a', 0)], perWeek, NOW(29))).toBe(REENTRY_FACTOR);
    expect(reentryFor([], perWeek, NOW(100))).toBeUndefined();
  });

  it('anchors on a quick session that ended the gap, and runs the programme sessions after it', () => {
    const logs = [progLog('a', 0), quickLog('quick', 40, 6)];
    // 10 days after the quick session: the first programme session back is still reduced.
    expect(reentryFor(logs, perWeek, NOW(50))).toBe(REENTRY_FACTOR);
    // A second gap over 28 days after the quick session moves the anchor to now.
    expect(reentryFor(logs, perWeek, NOW(75))).toBe(REENTRY_FACTOR);
  });

  it('is used up by the first sessionsPerWeek counted programme sessions', () => {
    const stamped = (n: number, days: number, over: Partial<Parameters<typeof makeLog>[0]> = {}) =>
      progLog(`r${n}`, days, { adjustments: { reentry: 0.7 }, ...over });
    const base = [progLog('a', 0)];
    const some = Array.from({ length: perWeek - 1 }, (_, i) => stamped(i, 40 + i));
    expect(reentryFor([...base, ...some], perWeek, NOW(50))).toBe(REENTRY_FACTOR);
    expect(reentryFor([...base, ...some, stamped(9, 49)], perWeek, NOW(50))).toBeUndefined();
  });

  it('is not used up by abandoned sessions or ones not counted as done', () => {
    const stamped = (id: string, days: number, over: Partial<Parameters<typeof makeLog>[0]> = {}) =>
      progLog(id, days, { adjustments: { reentry: 0.7 }, ...over });
    const logs = [
      progLog('a', 0),
      stamped('first', 40),
      ...Array.from({ length: perWeek }, (_, i) =>
        stamped(`ab${i}`, 41 + i, { status: 'abandoned' }),
      ),
    ];
    expect(reentryFor(logs, perWeek, NOW(60))).toBe(REENTRY_FACTOR);
    const notCounted = { ...stamped('nc', 42), countsAsDone: false };
    expect(reentryFor([progLog('a', 0), stamped('first', 40), notCounted], perWeek, NOW(60))).toBe(
      REENTRY_FACTOR,
    );
  });

  it('ends once a session ran at the full volume after the break', () => {
    const logs = [progLog('a', 0), progLog('plain', 40)];
    expect(reentryFor(logs, perWeek, NOW(45))).toBeUndefined();
  });

  it('reads the stamps, so deleting a session does not reopen or move the rotation', () => {
    const stamped = Array.from({ length: perWeek }, (_, i) =>
      progLog(`r${i}`, 40 + i, { adjustments: { reentry: 0.7 } }),
    );
    const logs = [progLog('a', 0), quickLog('q', 20, 6), ...stamped];
    expect(reentryFor(logs, perWeek, NOW(60))).toBeUndefined();
    // The quick session in the old gap goes: the gap before the stamped sessions only gets longer.
    const without = logs.filter((l) => l.id !== 'q');
    expect(reentryFor(without, perWeek, NOW(60))).toBeUndefined();
    expect(without.filter((l) => l.adjustments?.reentry === 0.7)).toHaveLength(perWeek);
  });

  const aSession = sessionForWeek(programme, 'a-push', 1).session;
  const sets = (s: { main: { type: string; sets?: number; rounds?: number }[] }) =>
    s.main.map((b) => b.sets ?? b.rounds);

  it('runs sets at 70 % to the nearest, minimum 1, interval rounds at least 3, steady cardio as is', () => {
    const out = applyReentry(aSession);
    aSession.main.forEach((b, i) => {
      const was = b.type === 'straight' ? b.sets : b.rounds;
      const now =
        out.main[i]!.type === 'straight'
          ? (out.main[i] as { sets: number }).sets
          : (out.main[i] as { rounds: number }).rounds;
      expect(now).toBe(Math.max(1, Math.round(was * 0.7)));
    });
    expect(out.warmup).toEqual(aSession.warmup);
    expect(out.finisher).toEqual(aSession.finisher);

    const intervals = {
      ...aSession,
      finisher: [
        {
          type: 'straight' as const,
          sets: 1,
          restSec: 0,
          item: {
            exerciseId: 'treadmill-run',
            target: { kind: 'interval' as const, rounds: 6, workSec: 30, recoverySec: 60 },
          },
        },
        {
          type: 'straight' as const,
          sets: 1,
          restSec: 0,
          item: {
            exerciseId: 'brisk-walk',
            target: { kind: 'cardio' as const, minMinutes: 20, maxMinutes: 20 },
          },
        },
      ],
    };
    const done = applyReentry(intervals);
    const rounds = (done.finisher[0] as { item: { target: { rounds: number } } }).item.target
      .rounds;
    expect(rounds).toBe(4);
    expect(done.finisher[1]).toEqual(intervals.finisher[1]);
    const short = {
      ...intervals,
      finisher: [
        {
          ...intervals.finisher[0]!,
          item: {
            ...intervals.finisher[0]!.item,
            target: { kind: 'interval' as const, rounds: 4, workSec: 30, recoverySec: 60 },
          },
        },
      ],
    };
    expect(
      (applyReentry(short).finisher[0] as { item: { target: { rounds: number } } }).item.target
        .rounds,
    ).toBe(3);
  });

  it('takes the smaller factor in a deload week and never multiplies', () => {
    const deload = sessionForWeek(programme, 'a-push', 8);
    const base = programme.rotation.find((s) => s.id === 'a-push')!;
    // The deload (0.6) is already below 0.7: nothing more is taken off.
    expect(sets(applyReentry(deload.session, { base, weekFactor: 0.6 }))).toEqual(
      sets(deload.session),
    );
    // A lighter week at 0.8: the smaller of 0.8 and 0.7, taken from the usual sets.
    const lighter = {
      ...deload.session,
      main: base.main.map((b) =>
        b.type === 'straight'
          ? { ...b, sets: Math.max(1, Math.round(b.sets * 0.8)) }
          : { ...b, rounds: Math.max(1, Math.round(b.rounds * 0.8)) },
      ),
    };
    const out = applyReentry(lighter, { base, weekFactor: 0.8 });
    expect(sets(out)).toEqual(
      base.main.map((b) =>
        Math.max(1, Math.round((b.type === 'straight' ? b.sets : b.rounds) * 0.7)),
      ),
    );
  });
});

describe('re-entry in a prepared session', () => {
  const ctx = (logs: SessionLog[], days: number): ProgressContext => ({
    logs,
    programmes: [programme],
    answers: [],
    inventory: referenceEquipment,
    profile: { level: 'intermediate' },
    now: NOW(days),
  });
  const plan = sessionForWeek(programme, 'a-push', 1);
  const place = { programme, week: 1 };

  it('changes nothing without a break', () => {
    const logs = [progLog('a', 0)];
    const plain = prepareSession(plan.session, ctx(logs, 3), 'programme');
    const placed = prepareSession(plan.session, ctx(logs, 3), 'programme', { place });
    expect(placed).toEqual(plain);
    expect(placed.reentry).toBeUndefined();
  });

  it('runs the session at 70 % and returns the stamp for the log', () => {
    const logs = [progLog('a', 0)];
    const prepared = prepareSession(plan.session, ctx(logs, 40), 'programme', { place });
    expect(prepared.reentry).toBe(REENTRY_FACTOR);
    const first = prepared.session.main[0]!;
    const was = plan.session.main[0]!;
    expect((first as { sets: number }).sets).toBe(
      Math.max(1, Math.round((was as { sets: number }).sets * 0.7)),
    );
    const adjustments = setAdjustments(
      { ...plan, session: prepared.session },
      referenceEquipment,
      undefined,
      prepared.doseCapped,
      prepared,
    );
    expect(adjustments?.reentry).toBe(REENTRY_FACTOR);
  });

  it('holds sets in a deload week at the deload volume', () => {
    const deload = sessionForWeek(programme, 'a-push', 8);
    const logs = [progLog('a', 0)];
    const prepared = prepareSession(deload.session, ctx(logs, 40), 'programme', {
      role: 'deload',
      place: { programme, week: 8 },
    });
    expect(prepared.reentry).toBe(REENTRY_FACTOR);
    deload.session.main.forEach((b, i) =>
      expect(prepared.session.main[i]).toMatchObject(
        b.type === 'straight' ? { sets: b.sets } : { rounds: b.rounds },
      ),
    );
  });

  it('keeps the first and last set at 2 reps in reserve or more', () => {
    const session = {
      ...plan.session,
      main: [
        {
          type: 'straight' as const,
          sets: 3,
          restSec: 90,
          item: {
            exerciseId: 'dumbbell-floor-press',
            target: reps(8, 10),
            rir: 3,
            load: kg(10),
          },
        },
      ],
      warmup: [],
      finisher: [],
    };
    const peak = { session, setRir: { first: 0, last: 0 } };
    const rirs = (stamp: { reentry?: number }) =>
      playSteps(session, setAdjustments(peak, referenceEquipment, undefined, [], stamp)).map(
        (s) => s.planned.rir,
      );
    expect(rirs({})).toEqual([1, 3, 1]);
    expect(rirs({ reentry: 0.7 })).toEqual([2, 3, 2]);
  });

  it('raises any item under 2 reps in reserve in a peak week', () => {
    const hard = {
      ...plan.session,
      main: plan.session.main.map((b) =>
        b.type === 'straight' ? { ...b, item: { ...b.item, rir: 0 } } : b,
      ),
    };
    const prepared = prepareSession(hard, ctx([progLog('a', 0)], 40), 'programme', {
      role: 'peak',
      place,
    });
    for (const b of prepared.session.main)
      if (b.type === 'straight' && b.item.rir !== undefined)
        expect(b.item.rir).toBeGreaterThanOrEqual(2);
  });
});

describe('the scheduled test', () => {
  const testCtx = (extra: Partial<TestContext> = {}): TestContext => ({
    logs: [],
    programmes: [programme],
    answers: [],
    maxTests: [],
    inventory: referenceEquipment,
    level: 'intermediate',
    ...extra,
  });
  const where = testPlacement(programme, 8, 'push-up', testCtx())!;

  it('is skipped at the re-entry volume and offered as Test now', () => {
    expect(scheduledTest(programme, where.sessionId, 8, testCtx())?.kind).toBe('run');
    expect(
      scheduledTest(programme, where.sessionId, 8, testCtx({ reentry: true })),
    ).toBeUndefined();
    expect(skippedTest(programme, where.sessionId, 8, testCtx({ reentry: true }))).toEqual({
      kind: 'reentry',
      exerciseId: 'push-up',
    });
    expect(skippedTest(programme, where.sessionId, 8, testCtx())).toBeUndefined();
  });

  it('lists test weeks skipped by a re-entry session until a test is done', () => {
    const logs = [
      progLog('r', 50, {
        adjustments: { reentry: 0.7 },
        source: {
          kind: 'programme',
          programmeId: programme.id,
          week: 8,
          sessionId: where.sessionId,
        },
      }),
    ];
    expect(testSkippedWeeks(programme, logs, [])).toEqual([8]);
    const done: MaxTest = {
      id: 't',
      date: '2026-05-01',
      at: '2026-05-01T10:00:00.000Z',
      exerciseId: 'push-up',
      context: 'session',
      programmeId: programme.id,
      result: { kind: 'reps', reps: 20 },
    };
    expect(testSkippedWeeks(programme, logs, [done])).toEqual([]);
  });
});

describe('easing back in after a lifted limitation', () => {
  const squat = 'goblet-squat';
  const ctx = (logs: SessionLog[], limitations: Limitation[], days: number): ProgressContext => ({
    logs,
    programmes: [programme],
    answers: [],
    inventory: referenceEquipment,
    profile: { level: 'intermediate', limitations },
    now: NOW(days),
  });
  const withSquat = (days: number) =>
    progLog(`sq${days}`, days, {
      main: [
        {
          exerciseId: squat,
          load: kg(16),
          rir: 2,
          sets: [
            { value: 12, goal: 12, feel: 'right' },
            { value: 12, goal: 12, feel: 'right' },
            { value: 12, goal: 12, feel: 'right' },
          ],
        },
      ],
    });
  const others = [10, 20, 30, 40, 45].map((d) => progLog(`other${d}`, d));
  const session = {
    ...sessionForWeek(programme, 'a-push', 1).session,
    warmup: [],
    finisher: [],
    main: [
      {
        type: 'straight' as const,
        sets: 3,
        restSec: 90,
        item: { exerciseId: squat, target: reps(8, 12), rir: 2, load: kg(16), goal: 12 },
      },
    ],
  };
  const region = Object.keys(exerciseById.get(squat)!.joints)[0] as Limitation['region'];
  const lifted = (days: number): Limitation => ({
    region,
    since: at(-100),
    liftedAt: at(days),
  });

  it('steps back and caps the first exposure after a lift when the exercise was left 28+ days before it', () => {
    // Last done on day 0; training went on with other sessions; the limitation was lifted on day 50.
    const logs = [withSquat(0), ...others];
    const eased = prepareSession(session, ctx(logs, [lifted(50)], 52), 'programme');
    expect(eased.doseCapped).toContain('main/0/0');
    expect(eased.notes['main/0/0']?.code).toBe('welcome-back');
    const plain = prepareSession(session, ctx(logs, [], 52), 'programme');
    expect(plain.doseCapped).toEqual([]);
    expect(plain.notes['main/0/0']?.code).not.toBe('welcome-back');
  });

  it('keeps the cap for a second exposure but drops the step back', () => {
    const logs = [withSquat(0), ...others, withSquat(52)];
    const second = prepareSession(session, ctx(logs, [lifted(50)], 59), 'programme');
    expect(second.doseCapped).toContain('main/0/0');
    expect(second.notes['main/0/0']?.code).not.toBe('welcome-back');
    const third = prepareSession(
      session,
      ctx([...logs, withSquat(59)], [lifted(50)], 66),
      'programme',
    );
    expect(third.doseCapped).toEqual([]);
  });

  it('leaves an exercise alone that was done within 28 days of the lift', () => {
    const logs = [withSquat(30), ...others];
    const prepared = prepareSession(session, ctx(logs, [lifted(50)], 52), 'programme');
    expect(prepared.doseCapped).toEqual([]);
  });
});
