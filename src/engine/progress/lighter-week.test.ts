import { describe, expect, it } from 'vitest';
import {
  PhaseSchema,
  type Answer,
  type Block,
  type Programme,
  type SessionLog,
} from '../../domain';
import {
  kg,
  makeLog,
  makeProgramme,
  reps,
  type EntrySpec,
  type LogSpec,
  type SetSpec,
} from '../../../tests/support/logs';
import { sessionForWeek } from '../week';
import { insertLighterWeek, lighterWeekSignal } from './lighter-week';

const NOW = new Date(2026, 10, 19, 12);
const DAY = 86_400_000;
const LIFTS = ['dumbbell-floor-press', 'bent-over-dumbbell-row', 'goblet-squat', 'push-up'];
const programme = makeProgramme();

const ok: SetSpec = { value: 10, goal: 10, rir: 2 };
const hard: SetSpec = { ...ok, feel: 'hard', chosen: true };
const miss1: SetSpec = { ...ok, value: 9, edited: true };

interface Build {
  /** Sets of a lift in session `log` (1-based, two sessions a week). */
  sets?: (log: number, lift: string) => SetSpec[];
  /** Days before now of each log, default every 3 days up to 3 days ago. */
  daysAgo?: (log: number, count: number) => number;
  extra?: (log: number) => Partial<LogSpec>;
  lifts?: string[];
}

function build(count: number, o: Build = {}): SessionLog[] {
  return Array.from({ length: count }, (_, k) => {
    const i = k + 1;
    const main: EntrySpec[] = (o.lifts ?? LIFTS).map((exerciseId) => ({
      exerciseId,
      ...(exerciseId !== 'push-up' && { load: kg(16) }),
      target: reps(8, 12),
      sets: (o.sets ?? (() => [ok, ok, ok]))(i, exerciseId),
    }));
    const days = o.daysAgo ? o.daysAgo(i, count) : (count - i + 1) * 3;
    return makeLog({
      id: `l${i}`,
      at: new Date(NOW.getTime() - days * DAY).toISOString(),
      source: { kind: 'programme', programmeId: 'p', week: Math.ceil(i / 2), sessionId: 'a' },
      main,
      ...o.extra?.(i),
    });
  });
}

const signal = (
  logs: SessionLog[],
  over: Partial<Programme> = {},
  answers: Answer[] = [],
  now = NOW,
) => lighterWeekSignal({ ...programme, ...over }, logs, answers, now);

const codes = (logs: SessionLog[], over: Partial<Programme> = {}, answers: Answer[] = []) =>
  signal(logs, over, answers)?.reasons.map((r) => r.code) ?? [];

describe('lighter week: hard sets', () => {
  const week3Hard = (share: SetSpec[]) => (log: number) => (log >= 5 ? share : [ok, ok, ok]);

  it('fires when most main sets of the last two sessions were hard or missed', () => {
    const logs = build(6, { sets: week3Hard([hard, hard, ok]) });
    const result = signal(logs)!;
    expect(result.startWeek).toBe(4);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toMatchObject({
      code: 'hard-sets',
      params: { sets: 24, misses: 16, sessions: 2 },
      logIds: ['l6', 'l5'],
    });
    expect(result.reasons[0]!.exerciseIds.sort()).toEqual([...LIFTS].sort());
  });

  it('counts reps two or more under the goal and a drop from the last time at the same load', () => {
    const low: SetSpec = { value: 8, goal: 10, rir: 2 };
    expect(codes(build(6, { sets: week3Hard([low, low, ok]) }))).toEqual(['hard-sets']);
    const worse = build(6, {
      sets: (log) =>
        log === 5
          ? [ok, ok, ok]
          : log === 6
            ? [
                { ...ok, value: 9 },
                { ...ok, value: 9 },
                { ...ok, value: 9 },
              ]
            : [ok, ok, ok],
    });
    // Two sessions needed: the earlier one has to be bad as well.
    expect(codes(worse)).toEqual([]);
    const bothDrop = build(6, {
      sets: (log) =>
        log === 5
          ? [{ ...ok, value: 9 }, { ...ok, value: 9 }, ok]
          : log === 6
            ? [
                { ...ok, value: 8, goal: 9 },
                { ...ok, value: 8, goal: 9 },
                { ...ok, value: 8, goal: 9 },
              ]
            : [ok, ok, ok],
    });
    expect(codes(bothDrop)).toEqual(['hard-sets']);
  });

  it('does not fire on sets meant to be hard, one-rep misses or a single bad session', () => {
    const hardAtOne: SetSpec = { ...hard, rir: 1 };
    expect(codes(build(6, { sets: week3Hard([hardAtOne, hardAtOne, hardAtOne]) }))).toEqual([]);
    expect(codes(build(6, { sets: week3Hard([miss1, miss1, miss1]) }))).toEqual([]);
    const oneBad = build(6, { sets: (log) => (log === 6 ? [hard, hard, hard] : [ok, ok, ok]) });
    expect(codes(oneBad)).toEqual([]);
    // 3 of 9 sets hard per session is a third, under the half.
    expect(codes(build(6, { sets: week3Hard([hard, ok, ok]) }))).toEqual([]);
  });

  it('counts planned sets not done in a session ended early', () => {
    const logs = build(6, {
      sets: (log) => (log >= 5 ? [ok] : [ok, ok, ok]),
      extra: (log) => (log >= 5 ? { endedEarly: true } : {}),
    }).map((l) =>
      l.endedEarly
        ? {
            ...l,
            plan: {
              ...l.plan,
              main: l.plan.main.map((b) => (b.type === 'straight' ? { ...b, sets: 3 } : b)),
            },
          }
        : l,
    );
    expect(signal(logs)?.reasons[0]).toMatchObject({
      code: 'hard-sets',
      params: { sets: 24, misses: 16 },
    });
  });

  it('looks past the cardio day', () => {
    const logs = [
      ...build(6, { sets: week3Hard([hard, hard, ok]) }),
      makeLog({
        id: 'cardio',
        at: new Date(NOW.getTime() - DAY).toISOString(),
        source: { kind: 'programme', programmeId: 'p', week: 4, sessionId: 'a' },
        main: [
          {
            exerciseId: 'treadmill-run',
            target: { kind: 'cardio', minMinutes: 20, maxMinutes: 20 },
            sets: [{ value: 20 }],
          },
        ],
      }),
    ];
    // One session of week 4 is done: the next week is the one that gets lighter.
    expect(signal(logs)?.startWeek).toBe(5);
    expect(codes(logs)).toEqual(['hard-sets']);
  });

  it('ignores the first exposure of each exercise and re-adaptation weeks', () => {
    // Only weeks 1-2 were bad: they are re-adaptation, and the first one is the calibration.
    const early = build(4, { sets: () => [hard, hard, hard] });
    expect(signal(early)).toBeUndefined();
    const calibrationOnly = build(3, {
      sets: (log) => (log === 1 ? [hard, hard, hard] : [ok, ok, ok]),
    });
    expect(signal(calibrationOnly)).toBeUndefined();
  });
});

describe('lighter week: stalled lifts', () => {
  /** Four logs of weeks 3-4 with a touched one-rep miss and no step: stalled. */
  const stalled = (log: number) => (log <= 4 ? [ok, ok, ok] : [miss1, miss1, ok]);
  const logs = (o: Build = {}) => build(8, { sets: stalled, ...o });

  it('fires when three main lifts miss touched and do not move for three sessions', () => {
    const result = signal(logs())!;
    expect(result.startWeek).toBe(5);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toMatchObject({
      code: 'stalled-lifts',
      params: { lifts: 4, of: 4, sessions: 3 },
    });
  });

  it('needs a touched miss: a prefilled one-tap that stalls is not evidence', () => {
    const untouched: SetSpec = { value: 9, goal: 10, rir: 2 };
    expect(
      codes(build(8, { sets: (log) => (log <= 4 ? [ok, ok, ok] : [untouched, untouched, ok]) })),
    ).toEqual([]);
  });

  it('does not count a lift that moved up in the window', () => {
    const moved = logs({
      extra: (log) =>
        log >= 6
          ? {
              progression: {
                'main/0/0': { code: 'load-up', params: {}, newLoad: true },
                'main/1/0': { code: 'reps-up', params: {} },
                'main/2/0': { code: 'load-up', params: {} },
              },
            }
          : {},
    });
    expect(codes(moved)).toEqual([]);
  });

  it('skips lifts at what the equipment allows', () => {
    const ceiling = (n: number) =>
      logs({
        extra: (log) =>
          log === 8
            ? {
                progression: Object.fromEntries(
                  [0, 1, 2, 3]
                    .slice(0, n)
                    .map((i) => [`main/${i}/0`, { code: 'ladder-end', params: {} }]),
                ),
              }
            : {},
      });
    expect(codes(ceiling(1))).toEqual(['stalled-lifts']);
    expect(codes(ceiling(2))).toEqual([]);
  });

  it('skips lifts held for pain', () => {
    const pain = (n: number) =>
      logs({
        sets: (log, lift) =>
          log === 8 && LIFTS.indexOf(lift) < n
            ? [miss1, { value: 5, flag: 'pain' }, { value: undefined, flag: 'pain' }]
            : stalled(log),
      });
    // Two pain stops also raise the pain reason; the stalled one drops below three lifts.
    expect(codes(pain(2))).toEqual(['pain-stops']);
    expect(codes(pain(1))).toEqual(['stalled-lifts']);
  });

  it('does not use the programme-only logs of other programmes', () => {
    const other = logs().map((l) => ({
      ...l,
      source: { kind: 'programme' as const, programmeId: 'other', week: 3, sessionId: 'a' },
    }));
    expect(signal(other)).toBeUndefined();
  });
});

describe('lighter week: pain', () => {
  const painLogs = (flags: Record<string, string[]>, daysAgo = 3) =>
    build(6, {
      sets: (log, lift) =>
        log === 6 && flags[lift]
          ? [
              ok,
              { value: undefined, flag: 'pain' as const },
              { value: undefined, flag: 'pain' as const },
            ]
          : [ok, ok, ok],
      daysAgo: (log, count) => (log === count ? daysAgo : (count - log + 1) * 3 + daysAgo),
    });

  it('fires on pain stops on two different exercises within two weeks', () => {
    const result = signal(painLogs({ 'goblet-squat': [], 'push-up': [] }))!;
    expect(result.reasons[0]).toMatchObject({
      code: 'pain-stops',
      params: { exercises: 2, days: 14 },
    });
    expect(result.startWeek).toBe(4);
  });

  it('needs different exercises, recent stops, and ignores exercises swapped away', () => {
    expect(codes(painLogs({ 'goblet-squat': [] }))).toEqual([]);
    const swapped: Answer = {
      id: 'x',
      exerciseId: 'push-up',
      kind: 'pain',
      logId: 'l6',
      answer: 'swap',
      substituteId: 'knee-push-up',
      at: NOW.toISOString(),
    };
    expect(codes(painLogs({ 'goblet-squat': [], 'push-up': [] }), {}, [swapped])).toEqual([]);
    // A "lighter" answer still counts.
    expect(
      codes(painLogs({ 'goblet-squat': [], 'push-up': [] }), {}, [
        { ...swapped, answer: 'lighter', substituteId: undefined } as Answer,
      ]),
    ).toEqual(['pain-stops']);
    expect(codes(painLogs({ 'goblet-squat': [], 'push-up': [] }, 20))).toEqual([]);
  });

  it('reads sessions of any kind', () => {
    const logs = [
      ...build(5),
      makeLog({
        id: 'q',
        at: new Date(NOW.getTime() - DAY).toISOString(),
        main: [
          { exerciseId: 'goblet-squat', load: kg(10), sets: [{ flag: 'pain', value: 3 }] },
          { exerciseId: 'push-up', sets: [{ flag: 'pain', value: 3 }] },
        ],
        status: 'abandoned',
      }),
    ];
    expect(codes(logs)).toEqual(['pain-stops']);
  });

  it('may fire from week 3 where the others wait for week 4', () => {
    const two = build(4, {
      sets: (log, lift) =>
        log === 4 && lift !== 'push-up'
          ? [ok, { value: undefined, flag: 'pain' as const }]
          : [hard, hard, hard],
    });
    const result = signal(two)!;
    expect(result.startWeek).toBe(3);
    expect(result.reasons.map((r) => r.code)).toEqual(['pain-stops']);
  });
});

describe('lighter week: limits', () => {
  const hardLogs = (count: number) =>
    build(count, { sets: (log) => (log >= count - 1 ? [hard, hard, ok] : [ok, ok, ok]) });

  it('waits for the start window and stops three weeks before the deload', () => {
    expect(signal(hardLogs(4))).toBeUndefined();
    expect(signal(hardLogs(6))?.startWeek).toBe(4);
    expect(signal(hardLogs(8))?.startWeek).toBe(5);
    expect(signal(hardLogs(10))).toBeUndefined();
  });

  it('moves the start window with the programme shape', () => {
    // No peak: re-adaptation runs to week 3, evidence starts in week 4, so the first start is week 5.
    const noPeak = {
      phases: [
        { ...programme.phases[0]!, toWeek: 3 },
        { ...programme.phases[1]!, fromWeek: 4, toWeek: 5 },
        { ...programme.phases[2]!, fromWeek: 6, toWeek: 7 },
        programme.phases[4]!,
      ],
    };
    expect(signal(hardLogs(6), noPeak)).toBeUndefined();
    expect(signal(hardLogs(8), noPeak)?.startWeek).toBe(5);
  });

  it('needs a scheduled deload to keep clear of', () => {
    expect(signal(hardLogs(6), { phases: programme.phases.slice(0, 4) })).toBeUndefined();
  });

  it('starts at the next week once the current one has a log', () => {
    const logs = [
      ...hardLogs(6),
      makeLog({
        id: 'abandoned',
        at: new Date(NOW.getTime() - DAY).toISOString(),
        source: { kind: 'programme', programmeId: 'p', week: 4, sessionId: 'a' },
        status: 'abandoned',
        main: [{ exerciseId: 'push-up', sets: [{ ...ok }] }],
      }),
    ];
    expect(signal(logs)?.startWeek).toBe(5);
  });

  it('comes once per programme', () => {
    const inserted = insertLighterWeek(programme, 4, NOW);
    expect(signal(hardLogs(6), inserted)).toBeUndefined();
  });

  it('stays quiet for two weeks after a dismissal and then reads only newer sessions', () => {
    const logs = hardLogs(6);
    const dismissedAt = (days: number) => ({
      lighterWeek: { dismissedAt: new Date(NOW.getTime() - days * DAY).toISOString() },
    });
    expect(signal(logs, dismissedAt(5))).toBeUndefined();
    // Dismissed 15 days ago: the bad sessions (3 and 6 days ago) came after it and count.
    expect(signal(logs, dismissedAt(15))?.reasons[0]?.code).toBe('hard-sets');
    // The bad sessions came before the dismissal: nothing new.
    expect(signal(logs, dismissedAt(2))).toBeUndefined();
    const later = new Date(NOW.getTime() + 16 * DAY);
    expect(signal(logs, dismissedAt(-1), [], later)).toBeUndefined();
  });

  it('ignores evidence across a break of two weeks or more', () => {
    const gap = build(6, {
      sets: (log) => (log >= 5 ? [hard, hard, ok] : [ok, ok, ok]),
      daysAgo: (log) => (log === 6 ? 2 : log === 5 ? 18 : 20 + (5 - log) * 3),
    });
    expect(signal(gap)).toBeUndefined();
  });
});

describe('insert a lighter week', () => {
  const covers = (p: Programme) => {
    const weeks = p.phases.flatMap((ph) =>
      Array.from({ length: ph.toWeek - ph.fromWeek + 1 }, (_, i) => ph.fromWeek + i),
    );
    expect(new Set(weeks).size).toBe(weeks.length);
    expect(Math.max(...weeks)).toBe(p.weeks);
    p.phases.forEach((ph) => PhaseSchema.parse(ph));
  };
  const span = (p: Programme) => p.phases.map((ph) => [ph.kind, ph.fromWeek, ph.toWeek, ph.origin]);

  it('shifts later phases and splits the one it lands in', () => {
    const result = insertLighterWeek(programme, 4, NOW);
    expect(result.weeks).toBe(9);
    expect(span(result)).toEqual([
      ['re-adaptation', 1, 2, undefined],
      ['volume', 3, 3, undefined],
      ['deload', 4, 4, 'early'],
      ['volume', 5, 5, undefined],
      ['intensity', 6, 7, undefined],
      ['peak', 8, 8, undefined],
      ['deload', 9, 9, undefined],
    ]);
    covers(result);
    expect(programme.weeks).toBe(8);
  });

  it('shifts whole phases when it lands on a boundary', () => {
    const result = insertLighterWeek(programme, 5, NOW);
    expect(span(result).slice(1, 5)).toEqual([
      ['volume', 3, 4, undefined],
      ['deload', 5, 5, 'early'],
      ['intensity', 6, 7, undefined],
      ['peak', 8, 8, undefined],
    ]);
    covers(result);
  });

  it('adjusts like the scheduled deload without its max test, intervals included', () => {
    const early = insertLighterWeek(programme, 4, NOW).phases.find((p) => p.origin === 'early')!;
    expect(early.name).toEqual({ fr: 'Semaine allégée', en: 'Lighter week' });
    expect(early.adjustments).toEqual([
      { kind: 'volume', factor: 0.6, intervals: true },
      { kind: 'rir', value: 3, scope: 'all-sets' },
    ]);
    const bare = insertLighterWeek(makeProgramme({ phases: programme.phases.slice(0, 3) }), 4, NOW);
    expect(bare.phases.find((p) => p.origin === 'early')!.adjustments).toEqual([
      { kind: 'volume', factor: 0.6, intervals: true },
      { kind: 'rir', value: 3, scope: 'all-sets' },
    ]);
  });

  it('rejects a week outside the programme', () => {
    expect(() => insertLighterWeek(programme, 0, NOW)).toThrow();
    expect(() => insertLighterWeek(programme, 9, NOW)).toThrow();
  });
});

describe('interval scaling in a lighter week', () => {
  const interval = (rounds: number): Block => ({
    type: 'straight',
    sets: 1,
    restSec: 0,
    item: {
      exerciseId: 'treadmill-run',
      target: { kind: 'interval', rounds, workSec: 30, recoverySec: 60 },
    },
  });
  const steady: Block = {
    type: 'straight',
    sets: 1,
    restSec: 0,
    item: { exerciseId: 'brisk-walk', target: { kind: 'cardio', minMinutes: 20, maxMinutes: 20 } },
  };
  const base = makeProgramme();
  const withBlocks = (volume: Programme['phases'][number]['adjustments']): Programme => ({
    ...base,
    rotation: [
      { ...base.rotation[0]!, finisher: [interval(10), interval(4), interval(3), steady] },
      base.rotation[1]!,
    ],
    phases: [
      { name: { fr: 'x', en: 'x' }, kind: 'deload', fromWeek: 1, toWeek: 8, adjustments: volume },
    ],
  });
  const rounds = (p: Programme) =>
    sessionForWeek(p, 'a', 1).session.finisher.map((b) =>
      b.type === 'straight' && b.item.target.kind === 'interval' ? b.item.target.rounds : undefined,
    );

  it('scales rounds by the factor, at least three, never up', () => {
    expect(rounds(withBlocks([{ kind: 'volume', factor: 0.6, intervals: true }]))).toEqual([
      6,
      3,
      3,
      undefined,
    ]);
  });

  it('leaves intervals and steady cardio alone otherwise', () => {
    expect(rounds(withBlocks([{ kind: 'volume', factor: 0.6 }]))).toEqual([10, 4, 3, undefined]);
    const steadyAfter = sessionForWeek(
      withBlocks([{ kind: 'volume', factor: 0.6, intervals: true }]),
      'a',
      1,
    ).session.finisher[3];
    expect(steadyAfter).toEqual(steady);
  });
});
