import { describe, expect, it } from 'vitest';
import type { Block, EquipmentInventory, Profile, Session, SessionItem, SetLog } from '../domain';
import { exerciseById } from '../catalogue';
import { setLogKey, SessionSchema } from '../domain';
import { BLOCK_TRANSITION_SEC, SIDE_SWITCH_SEC, WARMUP_TRANSITION_SEC } from './duration';
import { generateProgramme } from './generate';
import {
  activeSeconds,
  asPlanned,
  countsAsDoneByDefault,
  exerciseCount,
  itemKey,
  loadOptions,
  pauseBetween,
  playSteps,
  restOfExercise,
  resumeIndex,
  sessionTotals,
  setAdjustments,
  setLogBase,
  type PlayStep,
} from './play';
import { sessionForWeek } from './week';

const item = (exerciseId: string, extra: Partial<SessionItem> = {}): SessionItem => ({
  exerciseId,
  target: { kind: 'reps', min: 8, max: 10 },
  ...extra,
});

const straight = (it: SessionItem, sets: number, restSec: number): Block => ({
  type: 'straight',
  item: it,
  sets,
  restSec,
});

const session: Session = {
  id: 's',
  name: { fr: 'Séance', en: 'Session' },
  estimatedMinutes: 30,
  warmup: [
    {
      type: 'group',
      style: 'circuit',
      items: [
        item('arm-circles', { target: { kind: 'time', minSec: 30, maxSec: 30 } }),
        item('bodyweight-squat'),
      ],
      rounds: 1,
      restBetweenItemsSec: 0,
      restAfterRoundSec: 0,
    },
  ],
  main: [
    straight(item('dumbbell-floor-press', { load: { kind: 'kg', kg: 14 }, rir: 2 }), 3, 90),
    {
      type: 'group',
      style: 'superset',
      items: [
        item('one-arm-dumbbell-row', { perSide: true, load: { kind: 'kg', kg: 16 } }),
        item('plank', { target: { kind: 'time', minSec: 30, maxSec: 45 } }),
      ],
      rounds: 2,
      restBetweenItemsSec: 15,
      restAfterRoundSec: 60,
    },
  ],
  finisher: [
    straight(
      item('treadmill-walk', {
        target: { kind: 'cardio', minMinutes: 10, maxMinutes: 15, inclinePct: 8 },
      }),
      1,
      0,
    ),
  ],
};

const done = (step: PlayStep, extra: Partial<SetLog> = {}): SetLog => ({
  ...setLogBase(step),
  actual: asPlanned(step.planned) ?? { reps: 6 },
  feel: 'right',
  at: '2026-11-12T10:00:00Z',
  ...extra,
});

const flagged = (step: PlayStep, flag: SetLog['flag']): SetLog => ({
  ...setLogBase(step),
  flag,
  at: '2026-11-12T10:00:00Z',
});

describe('playSteps', () => {
  const steps = playSteps(session);
  const label = (s: PlayStep) =>
    `${s.section[0]}${s.blockIndex}.${s.itemIndex} ${s.set}/${s.sets}${s.side ? ` ${s.side}` : ''}`;

  it('runs warm-up, main and finisher, round by round and side by side', () => {
    expect(steps.map(label)).toEqual([
      'w0.0 1/1',
      'w0.1 1/1',
      'm0.0 1/3',
      'm0.0 2/3',
      'm0.0 3/3',
      'm1.0 1/2 left',
      'm1.0 1/2 right',
      'm1.1 1/2',
      'm1.0 2/2 left',
      'm1.0 2/2 right',
      'm1.1 2/2',
      'f0.0 1/1',
    ]);
  });

  it('numbers exercises across sections', () => {
    expect(steps.map((s) => s.exercise)).toEqual([0, 1, 2, 2, 2, 3, 3, 4, 3, 3, 4, 5]);
    expect(exerciseCount(steps)).toBe(6);
  });

  it('pauses according to what comes next', () => {
    const pauses = steps.map((s, i) => pauseBetween(s, steps[i + 1]));
    expect(pauses).toEqual([
      { kind: 'item', seconds: 0 },
      { kind: 'block', seconds: BLOCK_TRANSITION_SEC },
      { kind: 'rest', seconds: 90 },
      { kind: 'rest', seconds: 90 },
      { kind: 'block', seconds: 90 },
      { kind: 'side', seconds: SIDE_SWITCH_SEC },
      { kind: 'item', seconds: 15 },
      { kind: 'rest', seconds: 60 },
      { kind: 'side', seconds: SIDE_SWITCH_SEC },
      { kind: 'item', seconds: 15 },
      { kind: 'block', seconds: 60 },
      { kind: 'end', seconds: 0 },
    ]);
  });

  it('uses the warm-up transition between warm-up blocks', () => {
    const twoWarmups = playSteps({
      warmup: [straight(item('a'), 1, 0), straight(item('b'), 1, 0)],
      main: [straight(item('c'), 1, 0)],
      finisher: [],
    });
    expect(pauseBetween(twoWarmups[0]!, twoWarmups[1]).seconds).toBe(WARMUP_TRANSITION_SEC);
  });

  it('covers every set of every generated session', () => {
    const profile: Profile = {
      goal: 'recomposition',
      level: 'intermediate',
      daysPerWeek: 6,
      sessionMinutes: 45,
    };
    const programme = generateProgramme({ profile, equipment: [] });
    for (const template of programme.rotation) {
      const plan = sessionForWeek(programme, template.id, 1).session;
      SessionSchema.parse(plan);
      const expected = (['warmup', 'main', 'finisher'] as const)
        .flatMap((section) => plan[section])
        .reduce((sum, block) => {
          const items = block.type === 'straight' ? [block.item] : block.items;
          const sets = block.type === 'straight' ? block.sets : block.rounds;
          return sum + sets * items.reduce((n, it) => n + (it.perSide ? 2 : 1), 0);
        }, 0);
      const planSteps = playSteps(plan);
      expect(planSteps).toHaveLength(expected);
      expect(new Set(planSteps.map(setLogKey)).size).toBe(expected);
    }
  });
});

describe('resume and stop', () => {
  const steps = playSteps(session);

  it('resumes at the first step with nothing logged', () => {
    expect(resumeIndex(steps, [])).toBe(0);
    expect(
      resumeIndex(
        steps,
        steps.slice(0, 4).map((s) => done(s)),
      ),
    ).toBe(4);
    expect(
      resumeIndex(
        steps,
        steps.map((s) => done(s)),
      ),
    ).toBe(steps.length);
  });

  it('stopping an exercise ends its later sets, both sides, and nothing else', () => {
    const rest = restOfExercise(steps, 5); // row, round 1, left
    expect(rest.map((s) => `${s.set}${s.side}`)).toEqual(['1left', '1right', '2left', '2right']);
    const logged = [
      ...steps.slice(0, 5).map((s) => done(s)),
      ...rest.map((s) => flagged(s, 'pain')),
    ];
    const next = resumeIndex(steps, logged);
    expect(steps[next]).toMatchObject({ section: 'main', blockIndex: 1, itemIndex: 1, set: 1 });
    // From the plank of round 1 straight to the plank of round 2: a round rest, not an item switch.
    expect(steps[resumeIndex(steps, [...logged, done(steps[next]!)])]).toMatchObject({
      itemIndex: 1,
      set: 2,
    });
    expect(pauseBetween(steps[next]!, steps[10])).toEqual({ kind: 'rest', seconds: 60 });
  });
});

describe('asPlanned', () => {
  const planned = (extra: Partial<SessionItem>) =>
    playSteps({ warmup: [], main: [straight(item('x', extra), 1, 0)], finisher: [] })[0]!.planned;

  it('records the bottom of the range at the planned load', () => {
    expect(asPlanned(planned({ load: { kind: 'kg', kg: 14 } }))).toEqual({
      reps: 8,
      load: { kind: 'kg', kg: 14 },
    });
    expect(asPlanned(planned({ target: { kind: 'time', minSec: 30, maxSec: 45 } }))).toEqual({
      durationSec: 30,
    });
  });

  it('has no default for as-many-as-possible sets and timed cardio', () => {
    expect(asPlanned(planned({ target: { kind: 'max' } }))).toBeUndefined();
    expect(
      asPlanned(planned({ target: { kind: 'cardio', minMinutes: 10, maxMinutes: 15 } })),
    ).toBeUndefined();
    expect(
      asPlanned(planned({ target: { kind: 'interval', rounds: 8, workSec: 30, recoverySec: 60 } })),
    ).toBeUndefined();
  });
});

describe('intensity weeks', () => {
  const inventory: EquipmentInventory = [
    {
      id: 'db',
      kind: 'dumbbell',
      mode: 'adjustable',
      count: 2,
      minKg: 2,
      maxKg: 30,
      incrementKg: 2,
    },
  ];
  const profile: Profile = {
    goal: 'muscle',
    level: 'intermediate',
    daysPerWeek: 3,
    sessionMinutes: 45,
    bodyweightKg: 80,
  };
  const programme = generateProgramme({ profile, equipment: inventory });
  const weeks = Array.from({ length: programme.weeks }, (_, i) =>
    sessionForWeek(programme, programme.rotation[0]!.id, i + 1),
  );

  it('gives the first set its own RIR and the next sets a lighter, owned load', () => {
    const plan = weeks.find((w) => w.setRir.first !== undefined)!;
    const adjustments = setAdjustments(plan, inventory)!;
    expect(adjustments.firstSetRir).toBe(plan.setRir.first);
    const [key, backOff] = Object.entries(adjustments.backOffLoads ?? {})[0]!;
    const steps = playSteps(plan.session, adjustments).filter(
      (s) => itemKey(s.section, s.blockIndex, s.itemIndex) === key,
    );
    const top = steps[0]!.planned;
    expect(top.rir).toBe(plan.setRir.first);
    expect(steps[1]!.planned.load).toEqual(backOff);
    expect(backOff.kind === 'kg' && top.load?.kind === 'kg' && backOff.kg < top.load.kg).toBe(true);
    expect(backOff.kind === 'kg' && backOff.kg % 2).toBe(0);
    expect(steps[1]!.planned.rir).toBe(steps[0]!.item.rir);
  });

  it('gives the last set its own RIR', () => {
    const plan = weeks.find((w) => w.setRir.last !== undefined)!;
    const steps = playSteps(plan.session, setAdjustments(plan, inventory)).filter(
      (s) => s.section === 'main' && s.planned.target.kind === 'reps',
    );
    const lastSets = steps.filter((s) => s.set === s.sets);
    expect(lastSets.length).toBeGreaterThan(0);
    for (const step of lastSets) expect(step.planned.rir).toBe(plan.setRir.last);
  });

  it('keeps the full load when the nearest lighter weight is too far below', () => {
    const plan = {
      session: {
        warmup: [],
        main: [
          straight(
            item('dumbbell-floor-press', { load: { kind: 'kg' as const, kg: 12 }, rir: 2 }),
            3,
            90,
          ),
        ],
        finisher: [],
      } as unknown as Session,
      setRir: { first: 1 },
      backOffLoadFactor: 0.9,
    };
    const pairs = (...kgs: number[]): EquipmentInventory => [
      {
        id: 'fixed',
        kind: 'dumbbell',
        mode: 'fixed',
        weights: kgs.map((kg) => ({ kg, count: 2 })),
      },
    ];
    expect(setAdjustments(plan, pairs(8, 12))).toEqual({ firstSetRir: 1 });
    expect(setAdjustments(plan, pairs(8, 10, 12))?.backOffLoads).toEqual({
      'main/0/0': { kind: 'kg', kg: 10 },
    });
  });

  it('never makes a set easier than the item, and an item already that hard backs off nothing', () => {
    const plan = {
      session: {
        warmup: [],
        main: [
          straight(
            item('dumbbell-floor-press', { load: { kind: 'kg' as const, kg: 12 }, rir: 0 }),
            3,
            90,
          ),
        ],
        finisher: [],
      } as unknown as Session,
      setRir: { first: 1, last: 2 },
      backOffLoadFactor: 0.9,
    };
    const adjustments = setAdjustments(plan, inventory);
    expect(adjustments?.backOffLoads).toBeUndefined();
    const steps = playSteps(plan.session, adjustments);
    expect(steps.map((s) => s.planned.rir)).toEqual([0, 0, 0]);
    expect(steps.every((s) => s.planned.load?.kind === 'kg' && s.planned.load.kg === 12)).toBe(
      true,
    );
  });

  it('changes nothing in other weeks', () => {
    expect(setAdjustments(weeks[0]!, inventory)).toBeUndefined();
  });
});

describe('loadOptions', () => {
  it('offers the weights owned for the exercise, or the bands owned', () => {
    const inventory: EquipmentInventory = [
      {
        id: 'fixed',
        kind: 'dumbbell',
        mode: 'fixed',
        weights: [
          { kg: 8, count: 2 },
          { kg: 12, count: 1 },
        ],
      },
      { id: 'bands', kind: 'band', levels: ['heavy', 'light'] },
    ];
    const press = exerciseById.get('dumbbell-floor-press');
    const row = exerciseById.get('one-arm-dumbbell-row');
    expect(loadOptions(press, { kind: 'kg', kg: 8 }, inventory)).toEqual({
      kind: 'kg',
      weights: [8],
    });
    expect(loadOptions(row, { kind: 'kg', kg: 8 }, inventory)).toEqual({
      kind: 'kg',
      weights: [8, 12],
    });
    expect(loadOptions(row, { kind: 'band', level: 'light' }, inventory)).toEqual({
      kind: 'band',
      levels: ['light', 'heavy'],
    });
    expect(loadOptions(row, { kind: 'bodyweight' }, inventory)).toEqual({ kind: 'none' });
  });
});

describe('sessionTotals', () => {
  const steps = playSteps(session);
  const main = steps.filter((s) => s.section === 'main');
  const inventory: EquipmentInventory = [
    {
      id: 'db',
      kind: 'dumbbell',
      mode: 'adjustable',
      count: 2,
      minKg: 2,
      maxKg: 30,
      incrementKg: 2,
    },
  ];
  const log = (sets: SetLog[]) => ({ plan: session, sets });

  it('counts sets, reps, volume and stopped exercises', () => {
    const sets = [
      ...steps.slice(0, 2).map((s) => done(s)),
      ...main.slice(0, 3).map((s) => done(s)),
      ...restOfExercise(steps, 5).map((s) => flagged(s, 'no-equipment')),
    ];
    const totals = sessionTotals(log(sets), inventory);
    // Press 3 sets + row 2 sets stopped, of press 3 + row 2 + plank 2.
    expect(totals.main).toEqual({ planned: 7, done: 5 });
    expect(totals.hardSets).toBe(3);
    expect(totals.totalReps).toBe(3 * 8);
    // A pair of dumbbells: both count.
    expect(totals.volumeKg).toBe(3 * 8 * 14 * 2);
    expect(totals.stopped).toEqual([{ exerciseId: 'one-arm-dumbbell-row', flag: 'no-equipment' }]);
  });

  it('counts one dumbbell once and both sides of a set as one set', () => {
    const row = main.filter((s) => s.item.exerciseId === 'one-arm-dumbbell-row');
    const totals = sessionTotals(log(row.map((s) => done(s))), inventory);
    expect(totals.hardSets).toBe(2);
    expect(totals.totalReps).toBe(4 * 8);
    expect(totals.volumeKg).toBe(4 * 8 * 16);
  });

  it('counts as done by default from half the main sets', () => {
    // Press 3 + row round 1 = 4 of 7.
    expect(countsAsDoneByDefault(sessionTotals(log(main.slice(0, 5).map((s) => done(s)))))).toBe(
      true,
    );
    // A row with one side only does not count.
    expect(countsAsDoneByDefault(sessionTotals(log(main.slice(0, 4).map((s) => done(s)))))).toBe(
      false,
    );
  });
});

describe('activeSeconds', () => {
  const startedAt = '2026-11-12T10:00:00Z';

  it('leaves out finished and running pauses', () => {
    expect(activeSeconds({ startedAt, endedAt: '2026-11-12T10:40:00Z', pausedSec: 300 })).toBe(
      35 * 60,
    );
    expect(
      activeSeconds(
        { startedAt, pausedSec: 60, pausedAt: '2026-11-12T10:20:00Z' },
        new Date('2026-11-12T10:30:00Z'),
      ),
    ).toBe(19 * 60);
  });
});
