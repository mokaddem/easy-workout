import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type {
  Answer,
  Block,
  EquipmentInventory,
  Profile,
  Programme,
  SessionItem,
  SessionLog,
} from '../src/domain';
import {
  generateProgramme,
  generateQuickSession,
  nextTime,
  playSteps,
  prepareSession,
  suggestPlacing,
  type ProgressContext,
} from '../src/engine';
import { parseBackup } from '../src/db/backup';
import { equipmentSets } from './fixtures/equipment-sets';
import { referenceEquipment } from './fixtures/reference-equipment';
import {
  compliant,
  honest,
  oneTap,
  simulate,
  traceOf,
  type Policy,
  type Simulation,
  type TracePoint,
} from './support/simulate';

const reference: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 60,
};
const fullBody: Profile = { ...reference, daysPerWeek: 3, sessionMinutes: 45 };

const referenceProgramme = generateProgramme({ profile: reference, equipment: referenceEquipment });
const fixed = equipmentSets['fixed-dumbbells']!;
const kettlebells = equipmentSets.kettlebells!;
const fixedProgramme = generateProgramme({ profile: fullBody, equipment: fixed });
const kettlebellProgramme = generateProgramme({ profile: fullBody, equipment: kettlebells });

const runs: [string, Programme, EquipmentInventory, Policy][] = [
  ['reference, one tap', referenceProgramme, referenceEquipment, oneTap],
  ['reference, honest', referenceProgramme, referenceEquipment, honest()],
  ['fixed pairs, one tap', fixedProgramme, fixed, oneTap],
  ['fixed pairs, honest', fixedProgramme, fixed, honest()],
  ['kettlebells, one tap', kettlebellProgramme, kettlebells, oneTap],
  ['kettlebells, honest', kettlebellProgramme, kettlebells, honest()],
];
const sims = new Map(runs.map(([name, p, inv, policy]) => [name, simulate(p, inv, policy)]));

const kg = (p: TracePoint) => (p.load && /^\d/.test(p.load) ? Number(p.load) : undefined);
/** Weeks 1–6: peak and deload weeks deliberately fall back to the pre-peak state. */
const building = (points: TracePoint[]) => points.filter((p) => p.week <= 6);

describe('progression over a cycle', () => {
  // Leg moves lift the body too: a dumbbell step there is a small share of the load moved.
  const legs = (key: string) => {
    const pattern = exerciseById.get(key.split(':').at(-1)!)?.pattern;
    return pattern === 'squat' || pattern === 'lunge';
  };

  // A bigger jump is fine when another slot of the same exercise already works at that weight.
  const provenBefore = (sim: Simulation, key: string, load: string | undefined, week: number) => {
    const id = key.split(':').at(-1);
    return [...sim.trace].some(
      ([other, points]) =>
        other !== key &&
        other.endsWith(`:${id}`) &&
        points.some((p) => p.load === load && p.week <= week),
    );
  };

  it.each(runs.map(([name]) => name))('%s: never jumps more than 30 % in one go', (name) => {
    const sim = sims.get(name)!;
    for (const [key, points] of sim.trace)
      if (!legs(key))
        for (let i = 1; i < points.length; i++) {
          const [a, b] = [kg(points[i - 1]!), kg(points[i]!)];
          if (a && b && !provenBefore(sim, key, points[i]!.load, points[i]!.week))
            expect(b / a, key).toBeLessThanOrEqual(1.3);
        }
  });

  it.each(runs.map(([name]) => name))('%s: a weight is never dropped and taken again', (name) => {
    for (const [key, points] of sims.get(name)!.trace) {
      const loads = building(points).map((p) => p.load);
      let reversals = 0;
      let direction = 0;
      for (let i = 1; i < loads.length; i++) {
        if (loads[i] === loads[i - 1]) continue;
        const up = (kg(points[i]!) ?? 0) > (kg(points[i - 1]!) ?? 0) ? 1 : -1;
        if (direction !== 0 && up !== direction) reversals++;
        direction = up;
      }
      expect(reversals, key).toBeLessThanOrEqual(1);
    }
  });

  it.each(runs.filter(([n]) => n.includes('one tap')).map(([n]) => n))(
    '%s: loads only go up',
    (name) => {
      for (const [key, points] of sims.get(name)!.trace) {
        const loads = building(points).map(kg);
        for (let i = 1; i < loads.length; i++)
          if (loads[i] !== undefined && loads[i - 1] !== undefined)
            expect(loads[i]!, key).toBeGreaterThanOrEqual(loads[i - 1]!);
      }
    },
  );

  it('a new weight is confirmed once when only tapped', () => {
    for (const points of sims.get('reference, one tap')!.trace.values())
      points.forEach((p, i) => {
        if (p.note === 'load-up' || p.note === 'load-up-low' || p.note === 'added-load-start')
          if (points[i + 1] && points[i + 1]!.week <= 6)
            expect(points[i + 1]!.note).toBe('confirm-new-load');
      });
  });

  it('a single-value target climbs its span before the load moves (lateral raise, 4 kg)', () => {
    const [[, points]] = traceOf(sims.get('reference, one tap')!, 'dumbbell-lateral-raise') as [
      [string, TracePoint[]],
    ];
    expect(points.slice(0, 3).map((p) => p.load)).toEqual(['4', '4', '4']);
    // 4 → 6 kg is +50 %: the dumbbells' limit for this move, so the tempo slows instead.
    expect(points.some((p) => p.note === 'tempo-slower')).toBe(true);
  });

  it('push-ups never take a belt; pull-ups take it only past the top of the range', () => {
    const sim = sims.get('reference, one tap')!;
    for (const [, points] of traceOf(sim, 'push-up'))
      expect(points.every((p) => p.load === 'bw')).toBe(true);
    const [[, pullUps]] = traceOf(sim, 'pull-up') as [[string, TracePoint[]]];
    const first = pullUps.findIndex((p) => p.load?.startsWith('+'));
    expect(first).toBeGreaterThan(0);
    const before = pullUps[first - 1]!;
    expect(before.goal).toBeGreaterThanOrEqual(8 + 2 - 1);
  });

  it('holds climb five seconds a session, then offer a harder variant', () => {
    const sim = sims.get('reference, one tap')!;
    const [[, plank]] = traceOf(sim, 'plank') as [[string, TracePoint[]]];
    expect(plank.slice(0, 4).map((p) => p.goal)).toEqual([45, 50, 55, 60]);
    expect(
      sim.prepared.some((p) =>
        p.proposals.some((x) => x.kind === 'harder' && x.exerciseId === 'plank'),
      ),
    ).toBe(true);
  });

  it('one exercise in two different blocks progresses once a week in each', () => {
    const rows = traceOf(sims.get('reference, one tap')!, 'bent-over-dumbbell-row');
    expect(rows).toHaveLength(2);
    // Shared, the second exposure of week 1 would already add a rep.
    for (const [, points] of rows) expect(points[1]!.goal! - points[0]!.goal!).toBe(1);
  });
});

describe('someone who does what the app asks', () => {
  const cases: [string, Programme, EquipmentInventory][] = [
    ['reference', referenceProgramme, referenceEquipment],
    ['fixed pairs', fixedProgramme, fixed],
    ['kettlebells', kettlebellProgramme, kettlebells],
  ];
  const runsOf = cases.flatMap(([name, programme, inventory]) =>
    [0, 0.5, 1].map(
      (headroom, i) =>
        [
          `${name}, headroom ${headroom}`,
          simulate(programme, inventory, compliant({ headroom, seed: i + 1 })),
        ] as const,
    ),
  );

  it.each(runsOf.map(([name]) => name))('%s: no load goes back down in weeks 1–6', (name) => {
    const sim = runsOf.find(([n]) => n === name)![1];
    for (const [key, points] of sim.trace) {
      const loads = building(points).map(kg);
      for (let i = 1; i < loads.length; i++)
        if (loads[i] !== undefined && loads[i - 1] !== undefined)
          expect(loads[i]!, key).toBeGreaterThanOrEqual(loads[i - 1]!);
    }
  });

  const UP = new Set([
    'reps-up',
    'load-up',
    'load-up-low',
    'added-load-start',
    'band-heavier',
    'band-lighter',
    'time-up',
    'beyond-range',
  ]);

  it.each(runsOf.filter(([n]) => !n.endsWith('headroom 0')).map(([name]) => name))(
    '%s: most exercises move up by week 4',
    (name) => {
      const sim = runsOf.find(([n]) => n === name)![1];
      const climbing = [...sim.trace.values()].filter((points) =>
        points.some((p) => p.goal !== undefined),
      );
      const moved = climbing.filter((points) =>
        points.some((p) => p.week <= 4 && p.note && UP.has(p.note)),
      );
      expect(moved.length / climbing.length).toBeGreaterThanOrEqual(0.7);
    },
  );

  it.each(runsOf.map(([name]) => name))('%s: no easier or assisted variant offered', (name) => {
    const sim = runsOf.find(([n]) => n === name)![1];
    sim.prepared.forEach((p, i) => {
      const log = sim.logs[i]!;
      if (log.source.kind === 'programme' && log.source.week <= 6)
        expect(p.proposals.filter((x) => x.kind === 'easier' || x.kind === 'assisted')).toEqual([]);
    });
  });
});

/** The reference programme's push day, with what the policy does to its floor press. */
const floorPress = 'dumbbell-floor-press';
const firstA = 0;
const nextA = referenceProgramme.rotation.length;

const painOnce: Policy = (s) =>
  s.session === firstA &&
  s.step.item.exerciseId === floorPress &&
  s.step.section === 'main' &&
  s.step.set > 1
    ? { flag: 'pain' }
    : oneTap(s);

const itemOf = (sim: Simulation, session: number, exerciseId: string): SessionItem | undefined =>
  sim.prepared[session]!.session.main.flatMap((b) =>
    b.type === 'straight' ? [b.item] : b.items,
  ).find((i) => i.exerciseId === exerciseId);

const answer = (a: Omit<Answer, 'id' | 'at'>, at = '2026-01-06T00:00:00.000Z'): Answer =>
  ({ id: `a-${a.answer}-${a.exerciseId}`, at, ...a }) as Answer;

describe('pain', () => {
  const run = (answers: Answer[] = []) =>
    simulate(referenceProgramme, referenceEquipment, painOnce, { sessions: nextA + 1, answers });

  it('while unanswered: the next session is lighter, and a substitute is proposed', () => {
    const sim = run();
    const item = itemOf(sim, nextA, floorPress)!;
    expect(item.load).toEqual({ kind: 'kg', kg: 8 });
    const note = sim.prepared[nextA]!.notes['main/0/0'];
    expect(note).toMatchObject({ code: 'pain-lighter', params: { pending: true } });
    const proposal = sim.prepared[nextA]!.proposals.find((p) => p.kind === 'pain');
    expect(proposal).toMatchObject({ exerciseId: floorPress, logId: 'log-0' });
    const substitute = exerciseById.get(proposal!.substituteId!)!;
    expect(substitute.pattern).toBe(exerciseById.get(floorPress)!.pattern);
  });

  it('"keep" holds the load that hurt; "swap" replaces the exercise everywhere', () => {
    const kept = run([
      answer({ exerciseId: floorPress, kind: 'pain', logId: 'log-0', answer: 'keep' }),
    ]);
    expect(itemOf(kept, nextA, floorPress)!.load).toEqual({ kind: 'kg', kg: 10 });
    expect(kept.prepared[nextA]!.notes['main/0/0']!.code).toBe('hold-pain');

    const pending = run();
    const substituteId = pending.prepared[nextA]!.proposals.find(
      (p) => p.kind === 'pain',
    )!.substituteId!;
    const swapped = run([
      answer({
        exerciseId: floorPress,
        kind: 'pain',
        logId: 'log-0',
        answer: 'swap',
        substituteId,
      }),
    ]);
    expect(itemOf(swapped, nextA, floorPress)).toBeUndefined();
    expect(itemOf(swapped, nextA, substituteId)).toBeDefined();
    expect(swapped.prepared[nextA]!.replaces['main/0/0']).toBe(floorPress);
    expect(swapped.prepared[nextA]!.proposals.some((p) => p.kind === 'pain')).toBe(false);
  });

  it('a pain stop in a session outside the programme still makes the next one lighter', () => {
    const [painLog] = run().logs;
    const own = { ...painLog!, source: { kind: 'custom' as const, sessionId: 'my-session' } };
    const ctx: ProgressContext = {
      logs: [own],
      programmes: [referenceProgramme],
      answers: [],
      inventory: referenceEquipment,
      now: new Date('2026-01-07T08:00:00.000Z'),
      exercises: exerciseById,
    };
    const ready = prepareSession(referenceProgramme.rotation[0]!, ctx);
    expect(ready.notes['main/0/0']).toMatchObject({ code: 'pain-lighter' });
    expect(ready.proposals.find((p) => p.kind === 'pain')).toMatchObject({ logId: painLog!.id });
    expect(nextTime(own, referenceProgramme, ctx).proposals).toEqual([
      expect.objectContaining({ kind: 'pain', exerciseId: floorPress, logId: painLog!.id }),
    ]);
  });

  it('a second pain stop drops "keep"', () => {
    const twice: Policy = (s) =>
      (s.session === firstA || s.session === nextA) &&
      s.step.item.exerciseId === floorPress &&
      s.step.section === 'main' &&
      s.step.set > 1
        ? { flag: 'pain' }
        : oneTap(s);
    const sim = simulate(referenceProgramme, referenceEquipment, twice, {
      sessions: 2 * nextA + 1,
    });
    expect(sim.prepared[2 * nextA]!.proposals.find((p) => p.kind === 'pain')).toMatchObject({
      repeated: true,
    });
  });
});

describe('no equipment', () => {
  const missing: Policy = (s) =>
    s.session === firstA && s.step.item.exerciseId === floorPress && s.step.section === 'main'
      ? { flag: 'no-equipment' }
      : oneTap(s);

  it('asks once; a one-off changes nothing', () => {
    const sim = simulate(referenceProgramme, referenceEquipment, missing, { sessions: nextA + 1 });
    expect(sim.prepared[nextA]!.proposals.find((p) => p.kind === 'no-equipment')).toMatchObject({
      exerciseId: floorPress,
    });
    expect(itemOf(sim, nextA, floorPress)!.load).toEqual({ kind: 'kg', kg: 10 });
    const answered = simulate(referenceProgramme, referenceEquipment, missing, {
      sessions: nextA + 1,
      answers: [
        answer({ exerciseId: floorPress, kind: 'no-equipment', logId: 'log-0', answer: 'one-off' }),
      ],
    });
    expect(answered.prepared[nextA]!.proposals.some((p) => p.kind === 'no-equipment')).toBe(false);
  });
});

describe('breaks', () => {
  const after = (days: number) =>
    simulate(referenceProgramme, referenceEquipment, oneTap, {
      sessions: nextA + 1,
      gapDays: (i) => (i === nextA - 1 ? days : 1),
    });

  it('two to four weeks off eases the goal; longer drops a load', () => {
    const steady = itemOf(after(1), nextA, floorPress)!;
    const eased = after(20);
    expect(eased.prepared[nextA]!.notes['main/0/0']!.code).toBe('goal-eased');
    expect(itemOf(eased, nextA, floorPress)!.goal).toBe(steady.goal! - 2);
    const back = after(40);
    expect(back.prepared[nextA]!.notes['main/0/0']!.code).toBe('welcome-back');
    expect(itemOf(back, nextA, floorPress)!.load).toEqual({ kind: 'kg', kg: 8 });
    expect(itemOf(back, nextA, floorPress)!.goal).toBe(8);
  });
});

describe('quick sessions and the summary', () => {
  const sim = sims.get('reference, honest')!;
  const ctx = (): ProgressContext => ({
    logs: sim.logs,
    programmes: [referenceProgramme],
    answers: [],
    inventory: referenceEquipment,
    now: new Date('2026-04-01T08:00:00.000Z'),
  });

  it('a quick session takes the latest load of each exercise and nothing else', () => {
    const quick = generateQuickSession({
      minutes: 30,
      focus: 'upper',
      equipment: referenceEquipment,
      profile: reference,
    });
    const prepared = prepareSession(quick.session, ctx(), 'quick');
    expect(prepared.notes).toEqual({});
    const items = prepared.session.main.flatMap((b) =>
      b.type === 'straight' ? [b.item] : b.items,
    );
    expect(items.every((i) => i.goal === undefined)).toBe(true);
    const latest = (id: string) =>
      [...sim.logs]
        .filter((l) => l.source.kind === 'programme' && l.source.week <= 6)
        .reverse()
        .flatMap((l) => l.plan.main.flatMap((b) => (b.type === 'straight' ? [b.item] : b.items)))
        .find((i) => i.exerciseId === id)?.load;
    for (const item of items)
      if (item.load?.kind === 'kg' && latest(item.exerciseId)?.kind === 'kg')
        expect(item.load).toEqual(latest(item.exerciseId));
  });

  it('the summary lists every exercise done with its prescription next time', () => {
    const log = sim.logs[0]!;
    const next = nextTime(log, referenceProgramme, {
      ...ctx(),
      logs: [log],
      now: new Date(log.startedAt),
    });
    const done = new Set(log.sets.filter((s) => s.section !== 'warmup').map((s) => s.exerciseId));
    expect(new Set(next.lines.map((l) => l.exerciseId))).toEqual(
      new Set([...done].filter((id) => next.lines.some((l) => l.exerciseId === id))),
    );
    const press = next.lines.find((l) => l.exerciseId === floorPress)!;
    expect(press.before.goal).toBe(8);
    expect(press.after.goal).toBeGreaterThan(8);
  });
});

describe('set goals', () => {
  it('a set closer to failure asks for the reps it gives up in reserve', () => {
    const item: SessionItem = {
      exerciseId: floorPress,
      target: { kind: 'reps', min: 8, max: 10 },
      rir: 2,
      goal: 9,
      load: { kind: 'kg', kg: 10 },
    };
    const steps = playSteps(
      { warmup: [], main: [{ type: 'straight', item, sets: 3, restSec: 90 }], finisher: [] },
      { firstSetRir: 1 },
    );
    expect(steps.map((s) => s.planned.goal)).toEqual([10, 9, 9]);
  });
});

describe('backups', () => {
  it('a version-1 file imports with no answers', () => {
    const parsed = parseBackup({
      format: 'easy-workout-backup',
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        profile: null,
        settings: null,
        equipment: [],
        programmes: [],
        customSessions: [],
        sessionLogs: [],
        checkIns: [],
        maxTests: [],
      },
    });
    expect(parsed.ok && parsed.backup.data.answers).toEqual([]);
  });
});

describe('range edits', () => {
  const size = referenceProgramme.rotation.length;
  const sim = simulate(referenceProgramme, referenceEquipment, oneTap, { sessions: 5 * size });
  const ctx: ProgressContext = {
    logs: sim.logs,
    programmes: [referenceProgramme],
    answers: [],
    inventory: referenceEquipment,
    now: new Date(Date.parse(sim.logs.at(-1)!.startedAt) + 86_400_000),
    exercises: exerciseById,
  };
  const session = referenceProgramme.rotation.find((s) => s.id === 'c-lower-core')!;
  const lead = session.main[0]!;
  const kg = (block: Block | undefined) =>
    block?.type === 'straight' && block.item.load?.kind === 'kg' ? block.item.load.kg : NaN;
  const withRange = (min: number, max: number) =>
    prepareSession(
      {
        ...session,
        main: [
          lead.type === 'straight'
            ? { ...lead, item: { ...lead.item, target: { kind: 'reps', min, max } } }
            : lead,
          ...session.main.slice(1),
        ],
      },
      ctx,
    ).session.main[0];
  const built = kg(prepareSession(session, ctx).session.main[0]);

  it('keeps what a one-tapper built up when the range changes', () => {
    expect(lead.type === 'straight' && lead.item.exerciseId).toBe('goblet-squat');
    expect(built).toBeGreaterThan(kg(lead));
    expect(kg(withRange(12, 15))).toBeGreaterThan(kg(lead));
  });

  it('goes at most one step heavier for a lower range', () => {
    const heavier = kg(withRange(5, 6));
    expect(heavier).toBeGreaterThanOrEqual(built);
    expect(heavier - built).toBeLessThanOrEqual(2);
  });
});

describe("sessions of the user's own, on their own", () => {
  const session = {
    ...referenceProgramme.rotation.find((s) => s.id === 'c-lower-core')!,
    id: 'own-1',
  };
  const goblet = (s: typeof session) => {
    const b = s.main[0]!;
    return b.type === 'straight' ? b.item : undefined;
  };
  const run = (at: string, kg: number): SessionLog => ({
    id: `own-${at}`,
    source: { kind: 'custom', sessionId: 'own-1' },
    plan: session,
    status: 'completed',
    startedAt: at,
    endedAt: at,
    countsAsDone: true,
    sets: [
      {
        section: 'main',
        blockIndex: 0,
        itemIndex: 0,
        set: 1,
        exerciseId: 'goblet-squat',
        planned: { target: { kind: 'reps', min: 8, max: 10 }, load: { kind: 'kg', kg: 14 } },
        actual: { reps: 10, load: { kind: 'kg', kg } },
        edited: true,
        feel: 'right',
        at,
      },
    ],
  });
  const ctx = (logs: SessionLog[]): ProgressContext => ({
    logs,
    programmes: [referenceProgramme],
    answers: [],
    inventory: referenceEquipment,
    now: new Date('2026-02-01T08:00:00.000Z'),
    exercises: exerciseById,
  });

  it('remember the load of their last run, and move nothing', () => {
    const logs = [run('2026-01-10T08:00:00.000Z', 16), run('2026-01-20T08:00:00.000Z', 18)];
    const own = prepareSession(session, ctx(logs), 'quick', { ownSessionId: 'own-1' });
    expect(goblet(own.session)?.load).toEqual({ kind: 'kg', kg: 18 });
    const programme = prepareSession(
      referenceProgramme.rotation.find((s) => s.id === 'c-lower-core')!,
      ctx(logs),
    );
    expect(goblet(programme.session)?.load).toEqual(goblet(session)?.load);
  });

  it('suggest the programme after three runs in three weeks', () => {
    const now = new Date('2026-01-25T08:00:00.000Z');
    const two = [run('2026-01-10T08:00:00.000Z', 16), run('2026-01-20T08:00:00.000Z', 16)];
    expect(suggestPlacing(two, 'own-1', now)).toBe(false);
    expect(suggestPlacing([...two, run('2026-01-24T08:00:00.000Z', 16)], 'own-1', now)).toBe(true);
  });
});

describe('coming back to a range', () => {
  const size = referenceProgramme.rotation.length;
  const lower = referenceProgramme.rotation.find((s) => s.id === 'c-lower-core')!;
  const lead = lower.main[0]!;
  const kg = (block: Block | undefined) =>
    block?.type === 'straight' && block.item.load?.kind === 'kg' ? block.item.load.kg : NaN;
  const heavy: Programme = {
    ...referenceProgramme,
    rotation: referenceProgramme.rotation.map((s) =>
      s.id === lower.id && lead.type === 'straight'
        ? {
            ...s,
            main: [
              { ...lead, item: { ...lead.item, target: { kind: 'reps', min: 5, max: 6 } } },
              ...s.main.slice(1),
            ],
          }
        : s,
    ),
  };
  const first = simulate(referenceProgramme, referenceEquipment, oneTap, { sessions: 3 * size });
  const before = kg(first.prepared[2 * size + 2]?.session.main[0]);
  const then = simulate(heavy, referenceEquipment, oneTap, {
    sessions: 4 * size,
    logs: first.logs,
    start: new Date(Date.parse(first.logs.at(-1)!.startedAt) + 86_400_000),
  });
  const ctx = (role?: 'deload'): [ProgressContext, { role?: 'deload' }] => [
    {
      logs: then.logs,
      programmes: [referenceProgramme],
      answers: [],
      inventory: referenceEquipment,
      now: new Date(Date.parse(then.logs.at(-1)!.startedAt) + 86_400_000),
      exercises: exerciseById,
    },
    role ? { role } : {},
  ];

  it('never drops more than one step under what was lifted in that range', () => {
    expect(before).toBeGreaterThan(0);
    const [c, o] = ctx();
    const back = kg(prepareSession(lower, c, 'programme', o).session.main[0]);
    expect(back).toBeGreaterThanOrEqual(before - 2);
  });

  it("stays on that range's own history in a deload week", () => {
    const [c, o] = ctx('deload');
    const back = kg(prepareSession(lower, c, 'programme', o).session.main[0]);
    expect(back).toBeGreaterThanOrEqual(before - 2);
  });
});
