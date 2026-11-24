import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { EquipmentInventory, SessionLog } from '../src/domain';
import {
  activeTravelKit,
  applyTravelKit,
  defaultCountsAsDone,
  equipmentCapabilities,
  isExerciseAvailable,
  prepareSession,
  scheduledTest,
  sessionForWeek,
  setAdjustments,
  skippedTest,
  testPlacement,
  travelCoverage,
  type ProgressContext,
  type TestContext,
} from '../src/engine';
import { exposuresOf } from '../src/engine/progress/exposures';
import { referenceEquipment } from './fixtures/reference-equipment';
import { referenceProgramme } from './fixtures/reference-programme';
import { kg, makeLog, values } from './support/logs';

const DAY = 86_400_000;
const T0 = Date.parse('2026-03-02T09:00:00.000Z');
const at = (days: number) => new Date(T0 + days * DAY).toISOString();

const programme = referenceProgramme as typeof referenceProgramme & { id: string };
const plan = sessionForWeek(programme, 'a-push', 1);

const kit: EquipmentInventory = [
  {
    id: 'db',
    kind: 'dumbbell',
    mode: 'fixed',
    weights: [
      { kg: 4, count: 2 },
      { kg: 8, count: 2 },
    ],
  },
];
const nothing: EquipmentInventory = [];

const ctx = (logs: SessionLog[], days: number): ProgressContext => ({
  logs,
  programmes: [programme],
  answers: [],
  inventory: referenceEquipment,
  profile: { level: 'intermediate' },
  now: new Date(T0 + days * DAY),
});

const home = (id: string, days: number, load = 12, exerciseId = 'dumbbell-floor-press') =>
  makeLog({
    id,
    at: at(days),
    source: { kind: 'programme', programmeId: programme.id, week: 1, sessionId: 'a-push' },
    main: [
      {
        exerciseId,
        load: kg(load),
        rir: 2,
        sets: [
          { value: 10, goal: 10, feel: 'right' },
          { value: 10, goal: 10, feel: 'right' },
          { value: 10, goal: 10, feel: 'right' },
        ],
      },
    ],
  });

const itemsOf = (blocks: { type: string }[]) =>
  (
    blocks as { type: string; item?: { exerciseId: string }; items?: { exerciseId: string }[] }[]
  ).flatMap((b) => (b.type === 'straight' ? [b.item!] : b.items!));

describe('applying a travel kit', () => {
  const result = applyTravelKit(plan.session, { kit: nothing, level: 'intermediate' });

  it('leaves only what the kit can do', () => {
    const capabilities = equipmentCapabilities(nothing);
    for (const item of itemsOf([...result.session.main, ...result.session.finisher])) {
      expect(isExerciseAvailable(exerciseById.get(item.exerciseId)!, capabilities)).toBe(true);
    }
  });

  it('replaces an exercise with one for the same job, stamping what stood in for what', () => {
    const entries = Object.entries(result.substitutions);
    for (const [key, original] of entries) {
      const [section, b, i] = key.split('/');
      const blocks = section === 'main' ? result.session.main : result.session.finisher;
      const block = blocks[Number(b)]!;
      const item = block.type === 'straight' ? block.item : block.items[Number(i)]!;
      const standIn = exerciseById.get(item.exerciseId)!;
      const first = exerciseById.get(original)!;
      expect(standIn.pattern).toBe(first.pattern);
      expect(standIn.primaryMuscles.some((m) => first.primaryMuscles.includes(m))).toBe(true);
    }
  });

  it('records what was left out with its place, id and hard sets', () => {
    for (const entry of result.dropped)
      expect(entry).toMatch(/^(warmup|main|finisher)\/\d+\/\d+:[a-z0-9-]+:\d+$/);
  });

  it('keeps the session as it is when the kit does everything', () => {
    const same = applyTravelKit(plan.session, { kit: referenceEquipment, level: 'intermediate' });
    expect(same.session).toEqual(plan.session);
    expect(same.dropped).toEqual([]);
    expect(same.substitutions).toEqual({});
  });

  it('maps item keys after what was left out', () => {
    for (const [from, to] of Object.entries(result.keyMap)) {
      const section = from.split('/')[0]!;
      expect(to.startsWith(section)).toBe(true);
    }
  });

  it('covers every hard set with the full kit and fewer with none', () => {
    expect(travelCoverage(plan.session, { kit: referenceEquipment, level: 'intermediate' })).toBe(
      1,
    );
    const bare = travelCoverage(plan.session, { kit: nothing, level: 'intermediate' });
    expect(bare).toBeGreaterThan(0);
    expect(bare).toBeLessThanOrEqual(1);
  });
});

describe('preparing a session with a kit', () => {
  const logs = [home('h1', 0), home('h2', 2)];

  it('prefills kept items from the home state on the kit weights', () => {
    const prepared = prepareSession(plan.session, ctx(logs, 4), 'programme', { travelKit: kit });
    const press = itemsOf(prepared.session.main).find(
      (i) => i.exerciseId === 'dumbbell-floor-press',
    );
    expect(press).toBeDefined();
    const load = (press as { load?: { kind: string; kg?: number } }).load;
    expect(load?.kind).toBe('kg');
    expect([4, 8]).toContain(load?.kg);
  });

  it('stamps the substitutions and what was left out, and never proposes to buy', () => {
    const prepared = prepareSession(plan.session, ctx(logs, 4), 'programme', { travelKit: kit });
    expect(prepared.travel).toBeDefined();
    expect(prepared.buyNext).toEqual([]);
    const adjustments = setAdjustments(
      { ...plan, session: prepared.session },
      kit,
      undefined,
      prepared.doseCapped,
      prepared,
    );
    expect(adjustments?.travel).toEqual(prepared.travel);
  });

  it('marks the original of a stand-in in replaces', () => {
    const prepared = prepareSession(plan.session, ctx(logs, 4), 'programme', {
      travelKit: nothing,
    });
    for (const [key, original] of Object.entries(prepared.travel!.substitutions))
      expect(prepared.replaces[key]).toBe(original);
  });

  it('is the same session without a kit', () => {
    const plain = prepareSession(plan.session, ctx(logs, 4), 'programme');
    const placed = prepareSession(plan.session, ctx(logs, 4), 'programme', {});
    expect(placed).toEqual(plain);
    expect(plain.travel).toBeUndefined();
  });

  it('leaves the home loads unchanged after travel sessions', () => {
    const travelLog = makeLog({
      id: 'trip',
      at: at(3),
      source: { kind: 'programme', programmeId: programme.id, week: 1, sessionId: 'a-push' },
      adjustments: { travel: { substitutions: {}, dropped: [] } },
      main: [
        {
          exerciseId: 'dumbbell-floor-press',
          load: kg(4),
          rir: 2,
          sets: [
            { value: 20, goal: 10, feel: 'easy', chosen: true },
            { value: 20, goal: 10, feel: 'easy', chosen: true },
            { value: 20, goal: 10, feel: 'easy', chosen: true },
          ],
        },
      ],
    });
    const without = prepareSession(plan.session, ctx(logs, 6), 'programme');
    const withTrip = prepareSession(plan.session, ctx([...logs, travelLog], 6), 'programme');
    expect(withTrip.session).toEqual(without.session);
    expect(withTrip.notes).toEqual(without.notes);
  });

  it('reads stops of a travel session like those of a quick one', () => {
    const hurt = makeLog({
      id: 'trip-pain',
      at: at(3),
      source: { kind: 'programme', programmeId: programme.id, week: 1, sessionId: 'a-push' },
      adjustments: { travel: { substitutions: {}, dropped: [] } },
      main: [
        {
          exerciseId: 'dumbbell-floor-press',
          load: kg(4),
          sets: [{ value: 6, flag: 'pain' }, { flag: 'pain' }],
        },
      ],
    });
    const progress = exposuresOf('dumbbell-floor-press', [hurt], [programme]);
    expect(progress).toEqual([]);
    const flagged = exposuresOf('dumbbell-floor-press', [hurt], [programme], { anySource: true });
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.pain).toBe(true);
  });
});

describe('counts as done on a travel session', () => {
  const travelLog = (dropped: string[], sets: number, done: number): SessionLog =>
    makeLog({
      id: 'trip',
      at: at(0),
      source: { kind: 'programme', programmeId: programme.id, week: 1, sessionId: 'a-push' },
      adjustments: { travel: { substitutions: {}, dropped } },
      main: [
        {
          exerciseId: 'push-up',
          planned: sets,
          sets: values(...Array(done).fill(10)),
        },
      ],
    });

  it('is on from half of the original plan', () => {
    // 3 sets planned and done, 3 sets left out: exactly half.
    expect(defaultCountsAsDone(travelLog(['main/1/0:goblet-squat:3'], 3, 3))).toBe(true);
  });

  it('counts what was left out as not done', () => {
    expect(defaultCountsAsDone(travelLog(['main/1/0:goblet-squat:4'], 3, 3))).toBe(false);
  });

  it('counts a stand-in as done', () => {
    const log = travelLog([], 3, 3);
    const stamped = {
      ...log,
      adjustments: { travel: { substitutions: { 'main/0/0': 'knee-push-up' }, dropped: [] } },
    };
    expect(defaultCountsAsDone(stamped)).toBe(true);
  });

  it('uses the usual rule for any other session', () => {
    const plain = makeLog({
      id: 'p',
      at: at(0),
      main: [{ exerciseId: 'push-up', planned: 4, sets: values(10, 10) }],
    });
    expect(defaultCountsAsDone(plain)).toBe(true);
  });
});

describe('no max test while away', () => {
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

  it('schedules none and says which one it skipped', () => {
    expect(scheduledTest(programme, where.sessionId, 8, testCtx({ travel: true }))).toBeUndefined();
    expect(skippedTest(programme, where.sessionId, 8, testCtx({ travel: true }))).toEqual({
      kind: 'travel',
      exerciseId: 'push-up',
    });
  });
});

describe('the kit in force', () => {
  const settings = { travelKit: { equipment: kit, until: '2026-03-10' } };
  it('lasts through its last day', () => {
    expect(activeTravelKit(settings, new Date(2026, 2, 10, 23, 30))).toBe(kit);
    expect(activeTravelKit(settings, new Date(2026, 2, 11, 0, 5))).toBeUndefined();
    expect(activeTravelKit({}, new Date(2026, 2, 5))).toBeUndefined();
  });
});
