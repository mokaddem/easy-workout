import { describe, expect, it } from 'vitest';
import type {
  CheckIn,
  Load,
  MaxTest,
  Programme,
  SessionItem,
  SessionLog,
  SetLog,
  Target,
} from '../src/domain';
import {
  bodyTrend,
  bodyweightOffer,
  bucketByWeek,
  calendarWeekActivity,
  changeTimeline,
  exerciseHistory,
  exerciseList,
  hardSetsOfLog,
  highlights,
  maxTestHistory,
  programmeWeekSets,
  programmeWeekStart,
  checkInDue,
} from '../src/engine/stats';

const reps = (min: number, max: number): Target => ({ kind: 'reps', min, max });
const kg = (n: number): Load => ({ kind: 'kg', kg: n });

interface SetSpec {
  value?: number;
  load?: Load;
  side?: 'left' | 'right';
  flag?: SetLog['flag'];
  feel?: SetLog['feel'];
  set?: number;
}

interface LogOpts {
  id: string;
  at: string;
  source?: SessionLog['source'];
  status?: SessionLog['status'];
  main?: { exerciseId: string; target?: Target; sets: SetSpec[]; load?: Load }[];
  warmup?: { exerciseId: string; sets: SetSpec[] }[];
  finisher?: { exerciseId: string; target?: Target; sets: SetSpec[] }[];
  progression?: SessionLog['progression'];
  adjustments?: SessionLog['adjustments'];
  endedAt?: string;
}

/** A log with one straight block per entry; set n of an entry is entries' sets in order. */
function makeLog(o: LogOpts): SessionLog {
  const sets: SetLog[] = [];
  const blocks = (section: 'warmup' | 'main' | 'finisher', list: NonNullable<LogOpts['main']>) =>
    list.map((entry, blockIndex) => {
      const target = entry.target ?? reps(8, 12);
      const item: SessionItem = {
        exerciseId: entry.exerciseId,
        target,
        ...(entry.load && { load: entry.load }),
      };
      entry.sets.forEach((s, i) => {
        const base: SetLog = {
          section,
          blockIndex,
          itemIndex: 0,
          set: s.set ?? i + 1,
          ...(s.side && { side: s.side }),
          exerciseId: entry.exerciseId,
          planned: { target, ...((s.load ?? entry.load) && { load: (s.load ?? entry.load)! }) },
          ...(s.flag && { flag: s.flag }),
          ...(s.feel && { feel: s.feel }),
          at: o.at,
        };
        if (!s.flag || s.value !== undefined)
          base.actual = {
            ...(target.kind === 'time'
              ? { durationSec: s.value }
              : target.kind === 'interval'
                ? { rounds: s.value }
                : { reps: s.value }),
            ...((s.load ?? entry.load) && { load: (s.load ?? entry.load)! }),
          };
        sets.push(base);
      });
      return {
        type: 'straight' as const,
        item,
        sets: entry.sets.length,
        restSec: 60,
      };
    });
  const warmup = blocks('warmup', (o.warmup ?? []) as NonNullable<LogOpts['main']>);
  const main = blocks('main', o.main ?? []);
  const finisher = blocks('finisher', (o.finisher ?? []) as NonNullable<LogOpts['main']>);
  return {
    id: o.id,
    source: o.source ?? { kind: 'quick' },
    plan: {
      id: 'sess',
      name: { fr: 'S', en: 'S' },
      estimatedMinutes: 30,
      warmup,
      main,
      finisher,
    },
    status: o.status ?? 'completed',
    startedAt: o.at,
    endedAt: o.endedAt ?? new Date(Date.parse(o.at) + 30 * 60_000).toISOString(),
    ...(o.progression && { progression: o.progression }),
    ...(o.adjustments && { adjustments: o.adjustments }),
    sets,
  };
}

const local = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();
const sets = (...values: number[]): SetSpec[] => values.map((value) => ({ value }));

describe('hard sets of a log', () => {
  it('counts performed strength sets per group, warm-up and flagged sets aside', () => {
    const log = makeLog({
      id: 'a',
      at: local(2026, 11, 10),
      warmup: [{ exerciseId: 'push-up', sets: sets(10) }],
      main: [
        { exerciseId: 'push-up', sets: [{ value: 10 }, { value: 9 }, { flag: 'pain', value: 3 }] },
        { exerciseId: 'bodyweight-squat', sets: sets(15) },
        { exerciseId: 'goblet-squat', sets: [{ flag: 'no-equipment' }] },
      ],
      finisher: [
        {
          exerciseId: 'brisk-walk',
          target: { kind: 'cardio', minMinutes: 10, maxMinutes: 10 },
          sets: [{ value: 0 }],
        },
      ],
    });
    const counts = hardSetsOfLog(log);
    expect(counts.chest).toBe(2);
    expect(counts.quads).toBe(1);
    expect(counts.arms).toBe(0);
    expect(counts.core).toBe(0);
  });

  it('counts a per-side set once', () => {
    const log = makeLog({
      id: 'a',
      at: local(2026, 11, 10),
      main: [
        {
          exerciseId: 'side-plank',
          target: { kind: 'time', minSec: 20, maxSec: 40 },
          sets: [
            { value: 30, side: 'left', set: 1 },
            { value: 25, side: 'right', set: 1 },
          ],
        },
      ],
    });
    expect(hardSetsOfLog(log).core).toBe(1);
  });
});

describe('calendar week activity', () => {
  const logs = [
    makeLog({ id: 'sun', at: local(2026, 11, 8, 20) }),
    makeLog({ id: 'mon', at: local(2026, 11, 9, 0), source: { kind: 'quick' } }),
    makeLog({
      id: 'wed',
      at: local(2026, 11, 11),
      source: { kind: 'custom', sessionId: 'x' },
    }),
    makeLog({ id: 'abandoned', at: local(2026, 11, 12), status: 'abandoned' }),
    makeLog({ id: 'next', at: local(2026, 11, 16, 0) }),
  ];

  it('starts on Monday and leaves out abandoned sessions and other weeks', () => {
    const week = calendarWeekActivity(logs, new Date(2026, 10, 13, 9));
    expect(week.startDate).toBe('2026-11-09');
    expect(week.endDate).toBe('2026-11-15');
    expect(week.sessions).toBe(2);
    expect(week.bySource).toEqual({ programme: 0, custom: 1, quick: 1 });
    expect(week.activeSeconds).toBe(2 * 30 * 60);
  });

  it('puts a Sunday in the week that began the Monday before', () => {
    const week = calendarWeekActivity(logs, new Date(2026, 10, 8, 21));
    expect(week.startDate).toBe('2026-11-02');
    expect(week.sessions).toBe(1);
  });
});

describe('programme week sets', () => {
  const programme: Programme = {
    id: 'p',
    name: { fr: 'P', en: 'P' },
    goal: 'muscle',
    weeks: 2,
    sessionsPerWeek: 1,
    rotation: [
      {
        id: 's1',
        name: { fr: 'A', en: 'A' },
        estimatedMinutes: 30,
        warmup: [],
        main: [
          {
            type: 'straight',
            item: { exerciseId: 'push-up', target: reps(8, 12) },
            sets: 3,
            restSec: 60,
          },
        ],
        finisher: [],
      },
    ],
    phases: [],
    progression: { upperBodyIncrementKg: 2.5, lowerBodyIncrementKg: 5 } as Programme['progression'],
  } as Programme;
  const own = (id: string, week: number, at: string, extra: Partial<LogOpts> = {}) =>
    makeLog({
      id,
      at,
      source: { kind: 'programme', programmeId: 'p', week, sessionId: 's1' },
      main: [{ exerciseId: 'push-up', sets: sets(10, 10) }],
      ...extra,
    });

  it('reports every group, done against planned, with outside sessions after the week began', () => {
    const logs = [
      own('w1', 1, local(2026, 11, 2)),
      own('w2', 2, local(2026, 11, 10)),
      makeLog({
        id: 'q-before',
        at: local(2026, 11, 9),
        main: [{ exerciseId: 'push-up', sets: sets(10) }],
      }),
      makeLog({
        id: 'q-after',
        at: local(2026, 11, 11),
        main: [{ exerciseId: 'push-up', sets: sets(10, 10, 10) }],
      }),
    ];
    const week = programmeWeekSets({
      programme,
      week: 2,
      logs,
      programmeStartedAt: local(2026, 11, 1),
    });
    expect(week.rows).toHaveLength(9);
    const chest = week.rows.find((r) => r.group === 'chest')!;
    expect(chest).toEqual({ group: 'chest', done: 5, planned: 3 });
    expect(week.rows.find((r) => r.group === 'hamstrings')).toEqual({
      group: 'hamstrings',
      done: 0,
      planned: 0,
    });
  });

  it('finds the week start: first log of the week, else the previous week last log, else the programme start', () => {
    const logs = [
      own('w1', 1, local(2026, 11, 2), { endedAt: local(2026, 11, 2, 11) }),
      own('w2a', 2, local(2026, 11, 10)),
      own('w2b', 2, local(2026, 11, 12)),
    ];
    expect(programmeWeekStart(programme, 2, logs, local(2026, 11, 1))).toBe(local(2026, 11, 10));
    expect(programmeWeekStart(programme, 2, [logs[0]!], local(2026, 11, 1))).toBe(
      local(2026, 11, 2, 11),
    );
    expect(programmeWeekStart(programme, 1, [], local(2026, 11, 1))).toBe(local(2026, 11, 1));
  });
});

describe('exercise history', () => {
  it('lists exercises newest first with count and last date', () => {
    const logs = [
      makeLog({
        id: 'a',
        at: local(2026, 11, 1),
        main: [{ exerciseId: 'push-up', sets: sets(10) }],
      }),
      makeLog({
        id: 'b',
        at: local(2026, 11, 5),
        main: [{ exerciseId: 'push-up', sets: sets(11) }],
        finisher: [
          { exerciseId: 'plank', target: { kind: 'time', minSec: 20, maxSec: 40 }, sets: sets(30) },
        ],
        warmup: [{ exerciseId: 'glute-bridge', sets: sets(10) }],
      }),
    ];
    const list = exerciseList(logs, []);
    expect(list.map((i) => [i.exerciseId, i.sessions])).toEqual([
      ['plank', 1],
      ['push-up', 2],
    ]);
    expect(list[1]!.latest?.value).toBe(11);
  });

  it('takes the most reps at the heaviest load and ignores back-off sets', () => {
    const log = makeLog({
      id: 'a',
      at: local(2026, 11, 1),
      main: [
        {
          exerciseId: 'goblet-squat',
          load: kg(20),
          sets: [{ value: 8 }, { value: 12, load: kg(18) }, { value: 11, load: kg(18) }],
        },
      ],
      adjustments: { backOffLoads: { 'main/0/0': kg(18) } },
    });
    const [point] = exerciseHistory('goblet-squat', [log], []);
    expect(point!.best).toMatchObject({ value: 8, level: 20, unit: 'reps' });
    expect(point!.sets.map((s) => [s.value, s.backOff])).toEqual([
      [8, false],
      [12, true],
      [11, true],
    ]);
    expect(point!.range).toEqual({ min: 8, max: 12 });
  });

  it('takes the worse side, the longest hold and band level plus reps', () => {
    const sideLog = makeLog({
      id: 'a',
      at: local(2026, 11, 1),
      main: [
        {
          exerciseId: 'side-plank',
          target: { kind: 'time', minSec: 20, maxSec: 40 },
          sets: [
            { value: 30, side: 'left', set: 1 },
            { value: 25, side: 'right', set: 1 },
            { value: 28, side: 'left', set: 2 },
            { value: 28, side: 'right', set: 2 },
          ],
        },
      ],
    });
    const [side] = exerciseHistory('side-plank', [sideLog], []);
    expect(side!.best).toMatchObject({ value: 28, unit: 'seconds' });
    expect(side!.sets[0]!.weakerSide).toBe('right');

    const bandLog = makeLog({
      id: 'b',
      at: local(2026, 11, 2),
      main: [
        {
          exerciseId: 'band-assisted-pull-up',
          sets: [
            { value: 8, load: { kind: 'band', level: 'heavy' } },
            { value: 5, load: { kind: 'band', level: 'medium' } },
          ],
        },
      ],
    });
    const [band] = exerciseHistory('band-assisted-pull-up', [bandLog], []);
    // Assisted: the lighter band is further along, even with fewer reps.
    expect(band!.best).toMatchObject({ value: 5, load: { kind: 'band', level: 'medium' } });
  });

  it('marks the first build exposure of a programme as calibration', () => {
    const programme = {
      id: 'p',
      weeks: 8,
      phases: [],
      rotation: [],
    } as unknown as Programme;
    const mk = (id: string, day: number, week: number) =>
      makeLog({
        id,
        at: local(2026, 11, day),
        source: { kind: 'programme', programmeId: 'p', week, sessionId: 's' },
        main: [{ exerciseId: 'push-up', sets: sets(10) }],
      });
    const history = exerciseHistory(
      'push-up',
      [mk('b', 5, 1), mk('a', 1, 1), mk('c', 9, 2)],
      [programme],
    );
    expect(history.map((p) => [p.logId, p.calibration])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);
  });

  it('buckets points per week, best of the week', () => {
    const logs = [
      makeLog({
        id: 'a',
        at: local(2026, 11, 9),
        main: [{ exerciseId: 'push-up', sets: sets(10) }],
      }),
      makeLog({
        id: 'b',
        at: local(2026, 11, 12),
        main: [{ exerciseId: 'push-up', sets: sets(12) }],
      }),
      makeLog({
        id: 'c',
        at: local(2026, 11, 16),
        main: [{ exerciseId: 'push-up', sets: sets(9) }],
      }),
    ];
    const buckets = bucketByWeek(exerciseHistory('push-up', logs, []));
    expect(buckets.map((b) => [b.weekStart, b.best.logId, b.count])).toEqual([
      ['2026-11-09', 'b', 2],
      ['2026-11-16', 'c', 1],
    ]);
  });
});

describe('change timeline', () => {
  it('returns the notes of the exercise, newest first', () => {
    const note = (code: string) => ({ code, params: {} });
    const logs = [
      makeLog({
        id: 'a',
        at: local(2026, 11, 1),
        main: [
          { exerciseId: 'push-up', sets: sets(10) },
          { exerciseId: 'plank', sets: sets(30) },
        ],
        progression: { 'main/0/0': note('reps-up'), 'main/1/0': note('hold') },
      }),
      makeLog({
        id: 'b',
        at: local(2026, 11, 5),
        main: [{ exerciseId: 'push-up', sets: sets(11) }],
        progression: { 'main/0/0': note('beyond-range') },
      }),
    ];
    expect(changeTimeline('push-up', logs).map((e) => [e.logId, e.note.code])).toEqual([
      ['b', 'beyond-range'],
      ['a', 'reps-up'],
    ]);
  });
});

describe('highlights', () => {
  const now = new Date(2026, 10, 20, 12);
  const note = (code: string) => ({ code, params: {} });

  it('keeps one row per exercise, band-lighter only on assisted moves, beyond-range once', () => {
    const logs = [
      makeLog({
        id: 'a',
        at: local(2026, 11, 10),
        main: [
          { exerciseId: 'push-up', sets: sets(10) },
          { exerciseId: 'band-assisted-pull-up', sets: sets(5) },
          { exerciseId: 'goblet-squat', sets: sets(10) },
        ],
        progression: {
          'main/0/0': note('beyond-range'),
          'main/1/0': note('band-lighter'),
          'main/2/0': note('band-lighter'),
        },
      }),
      makeLog({
        id: 'b',
        at: local(2026, 11, 14),
        main: [{ exerciseId: 'push-up', sets: sets(11) }],
        progression: { 'main/0/0': note('beyond-range') },
      }),
    ];
    const rows = highlights(logs, [], [], now);
    expect(rows.map((r) => [r.exerciseId, r.kind === 'note' ? r.note.code : r.kind, r.at])).toEqual(
      [
        ['band-assisted-pull-up', 'band-lighter', local(2026, 11, 10)],
        ['push-up', 'beyond-range', local(2026, 11, 10)],
      ],
    );
  });

  it('needs two earlier sessions for a new best and never counts a calibration', () => {
    const mk = (id: string, day: number, value: number, week = 1) =>
      makeLog({
        id,
        at: local(2026, 11, day),
        source: { kind: 'programme', programmeId: 'p', week, sessionId: 's' },
        main: [{ exerciseId: 'push-up', sets: sets(value) }],
      });
    const programme = { id: 'p', weeks: 8, phases: [], rotation: [] } as unknown as Programme;
    // Calibration is the best so far at the second point; the third has only 1 non-calibration before... but 2 earlier.
    const two = [mk('a', 10, 8), mk('b', 12, 9)];
    expect(highlights(two, [programme], [], now)).toEqual([]);
    const three = [...two, mk('c', 14, 11)];
    const rows = highlights(three, [programme], [], now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'best', logId: 'c' });
    // A calibration exposure is never a best, even late in the window.
    const lateCalibration = [
      makeLog({
        id: 'x',
        at: local(2026, 11, 2),
        main: [{ exerciseId: 'push-up', sets: sets(5) }],
      }),
      makeLog({
        id: 'y',
        at: local(2026, 11, 3),
        main: [{ exerciseId: 'push-up', sets: sets(5) }],
      }),
      mk('z', 15, 6),
    ];
    expect(highlights(lateCalibration, [programme], [], now)).toEqual([]);
  });

  it('includes a recent max test and drops old ones', () => {
    const test = (id: string, day: number): MaxTest => ({
      id,
      date: `2026-11-${String(day).padStart(2, '0')}`,
      at: local(2026, 11, day),
      exerciseId: 'push-up',
      context: 'fresh',
      result: { kind: 'reps', reps: 20 },
    });
    expect(highlights([], [], [test('t', 15)], now)).toHaveLength(1);
    expect(highlights([], [], [test('t', 2)], now)).toHaveLength(0);
  });
});

describe('body trends', () => {
  const ci = (date: string, weightKg?: number): CheckIn => ({
    id: date,
    date,
    ...(weightKg !== undefined && { weightKg }),
  });

  it('gives a delta only with 3+ check-ins over 4+ weeks, rounded to 0.5', () => {
    const rows = [
      ci('2026-10-01', 80),
      ci('2026-10-15', 79.6),
      ci('2026-10-29', 78.2),
      ci('2026-11-05', 77.7),
    ];
    const trend = bodyTrend(rows, 'weightKg');
    // mean(80, 79.6) = 79.8; mean(78.2, 77.7) = 77.95; difference -1.85 -> -2
    expect(trend.delta).toEqual({ value: -2, weeks: 5 });
    expect(bodyTrend(rows.slice(0, 3), 'weightKg').delta).toEqual({ value: -1, weeks: 4 });
    expect(bodyTrend(rows.slice(0, 2), 'weightKg').delta).toBeUndefined();
    const short = [ci('2026-10-01', 80), ci('2026-10-08', 79), ci('2026-10-20', 78)];
    expect(bodyTrend(short, 'weightKg').delta).toBeUndefined();
  });

  it('leaves out check-ins without the field', () => {
    const trend = bodyTrend(
      [ci('2026-10-01', 80), ci('2026-10-02'), ci('2026-10-09', 79)],
      'weightKg',
    );
    expect(trend.points).toHaveLength(2);
    expect(bodyTrend([ci('2026-10-01')], 'waistCm').points).toEqual([]);
  });

  it('offers the bodyweight from the mean of the last two when it differs by 2 kg', () => {
    const rows = [ci('2026-10-01', 70), ci('2026-10-08', 74), ci('2026-10-15', 74.4)];
    expect(bodyweightOffer(rows, 70)).toEqual({ kg: 74, differenceKg: 4 });
    expect(bodyweightOffer(rows, 72.5)).toBeUndefined();
    expect(bodyweightOffer([], 70)).toBeUndefined();
  });
});

describe('max test history', () => {
  const t = (id: string, day: number, context: MaxTest['context'], reps: number): MaxTest => ({
    id,
    date: `2026-11-${String(day).padStart(2, '0')}`,
    at: local(2026, 11, day),
    exerciseId: 'push-up',
    context,
    result: { kind: 'reps', reps },
  });

  it('compares each test with the previous one of the same context', () => {
    const series = maxTestHistory(
      [
        t('c', 9, 'session', 22),
        t('a', 1, 'fresh', 20),
        t('b', 5, 'session', 18),
        t('d', 12, 'fresh', 21),
      ],
      'push-up',
    );
    const session = series.find((s) => s.context === 'session')!;
    expect(session.entries.map((e) => [e.test.id, e.change])).toEqual([
      ['b', undefined],
      ['c', 4],
    ]);
    const fresh = series.find((s) => s.context === 'fresh')!;
    expect(fresh.entries[1]).toMatchObject({ previous: { id: 'a' }, change: 1 });
  });
});

describe('weekly check-in card', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  const done = [{ status: 'completed' }];
  const on = { checkInPrompt: true };
  it('waits for a first session, a week after a check-in or a dismissal, and stays off when off', () => {
    expect(checkInDue([], on, done, now)).toBe(true);
    expect(checkInDue([], on, [], now)).toBe(false);
    expect(checkInDue([], { checkInPrompt: false }, done, now)).toBe(false);
    expect(checkInDue([{ id: 'a', date: '2026-11-14' }], on, done, now)).toBe(false);
    expect(checkInDue([{ id: 'a', date: '2026-11-08' }], on, done, now)).toBe(true);
    expect(checkInDue([], { ...on, checkInDismissedAt: '2026-11-15T10:00:00Z' }, done, now)).toBe(
      false,
    );
    expect(checkInDue([], { ...on, checkInDismissedAt: '2026-11-09T10:00:00Z' }, done, now)).toBe(
      true,
    );
  });
});
