import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type {
  EquipmentInventory,
  Exercise,
  Goal,
  Level,
  Profile,
  Programme,
  Session,
} from '../src/domain';
import { generateProgramme, nextCycle, programmeChanges } from '../src/engine';
import { exerciseSafety } from '../src/engine/generate/safety';
import { slotPicks } from '../src/engine/generate/programme';
import { upgradesFor } from '../src/engine/next-cycle';
import { nextProgramme } from '../src/features/programme/preview';
import { equipmentSets } from './fixtures/equipment-sets';
import { compliant, simulate } from './support/simulate';

const bar: EquipmentInventory[number] = { id: 'bar', kind: 'pull-up-bar', mount: 'doorway' };
const band: EquipmentInventory[number] = { id: 'bands', kind: 'band', levels: ['light', 'heavy'] };
const adjustable: EquipmentInventory[number] = {
  id: 'db',
  kind: 'dumbbell',
  mode: 'adjustable',
  count: 2,
  minKg: 2.5,
  maxKg: 24,
  incrementKg: 2.5,
};

const profile = (extra: Partial<Profile> = {}): Profile => ({
  goal: 'muscle',
  level: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 45,
  bodyweightKg: 75,
  ...extra,
});

const progress = (
  previous: Programme,
  equipment: EquipmentInventory,
  p: Profile,
  extra: Record<string, unknown> = {},
) =>
  ({
    logs: [],
    programmes: [previous],
    answers: [],
    inventory: equipment,
    profile: p,
    now: new Date('2026-03-01'),
    ...extra,
  }) as Parameters<typeof nextCycle>[0]['progress'];

const jumps = (e: Exercise) => e.tags.includes('plyometric') || e.tags.includes('ballistic');
const items = (s: Session) =>
  [...s.main, ...s.finisher].flatMap((b) => (b.type === 'straight' ? [b.item] : b.items));

/** Slots whose exercise moved more than one step up, or into jumps, from last cycle's. */
const leaps = (before: Programme, after: Programme): string[] => {
  const was = slotPicks(before);
  const now = slotPicks(after);
  const out: string[] = [];
  for (const [key, id] of Object.entries(now)) {
    const a = exerciseById.get(was[key] ?? '');
    const b = exerciseById.get(id);
    if (!a || !b || a === b) continue;
    if (b.difficulty > a.difficulty + 1 || (jumps(b) && !jumps(a)))
      out.push(`${key}: ${a.id}(d${a.difficulty}) -> ${b.id}(d${b.difficulty})`);
  }
  return out;
};

describe('the one-step limit when equipment is added', () => {
  const cases: [string, Profile, EquipmentInventory, Profile, EquipmentInventory][] = [
    ['beginner + bar, now intermediate', profile({ level: 'beginner' }), [], profile(), [bar]],
    [
      'beginner 4d + bar and band, now intermediate',
      profile({ level: 'beginner', daysPerWeek: 4 }),
      [],
      profile({ daysPerWeek: 4 }),
      [bar, band],
    ],
    ['intermediate + dumbbells', profile(), [], profile(), [adjustable]],
    ['intermediate + bar', profile(), [], profile(), [bar]],
  ];

  it.each(cases)('%s: no lift jumps more than a step or into jumps', (_, p1, e1, p2, e2) => {
    const first = generateProgramme({ profile: p1, equipment: e1 });
    const next = nextCycle({
      previous: first,
      profile: p2,
      equipment: e2,
      progress: progress(first, e2, p2),
    });
    expect(leaps(first, next.generated)).toEqual([]);
  });

  it('gives a pull-up slot a regression, not the pull-up, when the bar comes with a level-up', () => {
    const first = generateProgramme({ profile: profile({ level: 'beginner' }), equipment: [] });
    const next = nextCycle({
      previous: first,
      profile: profile(),
      equipment: [bar],
      progress: progress(first, [bar], profile()),
    }).generated;
    const slot = Object.entries(slotPicks(next)).find(([key]) =>
      key.endsWith('/pull-vertical-main'),
    );
    expect(slot).toBeDefined();
    expect(slot![1]).not.toBe('pull-up');
    expect(exerciseById.get(slot![1])!.difficulty).toBeLessThanOrEqual(3);
  });

  it('keeps a core slot a step above the old one at most', () => {
    const first = generateProgramme({ profile: profile(), equipment: [] });
    const next = nextCycle({
      previous: first,
      profile: profile(),
      equipment: [bar],
      progress: progress(first, [bar], profile()),
    }).generated;
    const crunch = Object.entries(slotPicks(next)).find(([key]) => key.endsWith('/leg-raise'));
    expect(crunch?.[1]).not.toBe('hanging-leg-raise');
  });
});

describe('the renegade row', () => {
  const adjustableOnly: EquipmentInventory = [adjustable];
  const selector: EquipmentInventory = [{ ...adjustable, mechanism: 'selector' }];
  const sets: [string, EquipmentInventory][] = [
    ...Object.entries(equipmentSets),
    ['adjustable only', adjustableOnly],
    ['adjustable with a bar', [adjustable, bar]],
    ['selector', selector],
  ];

  const placements = () => {
    const out: { label: string; fixed: boolean; session: Session; slot: string }[] = [];
    const rows: { label: string; fixed: boolean; programme: Programme }[] = [];
    for (const [name, equipment] of sets)
      for (const goal of ['muscle', 'recomposition', 'general-fitness'] as Goal[])
        for (const level of ['beginner', 'intermediate', 'advanced'] as Level[])
          for (const days of [2, 3, 5, 6])
            rows.push({
              label: `${name}/${goal}/${level}/${days}d`,
              fixed: equipment.some((i) => i.kind === 'dumbbell' && i.mode === 'fixed'),
              programme: generateProgramme({
                profile: profile({ goal, level, daysPerWeek: days, sessionMinutes: 45 }),
                equipment,
              }),
            });
    for (const { label, fixed, programme } of rows)
      for (const session of programme.rotation)
        for (const block of [...session.main, ...session.finisher])
          for (const item of block.type === 'straight' ? [block.item] : block.items)
            if (item.exerciseId === 'renegade-row')
              out.push({
                label,
                fixed,
                session,
                slot: `${block.type}/${item.slot ?? ''}`,
              });
    return { out, rows };
  };

  it('is blocked unless fixed dumbbells are owned', () => {
    const load = { level: 'intermediate' as const, bodyweightKg: 75 };
    const row = exerciseById.get('renegade-row')!;
    expect(exerciseSafety(row, { ...load, inventory: adjustableOnly }).concern).toBe(
      'rolling-dumbbells',
    );
    expect(exerciseSafety(row, { ...load, inventory: selector }).concern).toBe('rolling-dumbbells');
    expect(
      exerciseSafety(row, { ...load, inventory: equipmentSets['fixed-dumbbells']! }).concern,
    ).toBeUndefined();
  });

  it('is only placed with fixed dumbbells, in a straight accessory row, 6-10 reps at RIR 2 or more', () => {
    const { out, rows } = placements();
    expect(rows.length).toBeGreaterThan(0);
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.fixed, p.label).toBe(true);
      expect(p.slot, p.label).toMatch(/^straight\/row-bilateral/);
    }
    for (const { programme } of rows)
      for (const session of programme.rotation)
        for (const item of items(session).filter((i) => i.exerciseId === 'renegade-row')) {
          expect(item.target).toMatchObject({ kind: 'reps', min: 6, max: 10 });
          expect(item.rir ?? 0).toBeGreaterThanOrEqual(2);
          expect(item.perSide).toBe(true);
        }
  });
});

describe('seated dumbbell calf raise', () => {
  it('sits below the standing calf raise on the ladder, both ways', () => {
    expect(exerciseById.get('dumbbell-calf-raise')!.easier).toContain('seated-dumbbell-calf-raise');
    expect(exerciseById.get('seated-dumbbell-calf-raise')!.harder).toContain('dumbbell-calf-raise');
  });

  it('does not come in by rotation', () => {
    for (const [, equipment] of Object.entries(equipmentSets))
      for (const seed of [0, 1, 2, 3]) {
        const p = profile({ goal: 'recomposition', daysPerWeek: 6, sessionMinutes: 60 });
        const first = generateProgramme({ profile: p, equipment, seed });
        const next = nextCycle({
          previous: first,
          profile: p,
          equipment,
          progress: progress(first, equipment, p),
        });
        for (const programme of [first, next.generated])
          expect(JSON.stringify(programme.rotation)).not.toContain('seated-dumbbell-calf-raise');
      }
  });
});

describe('upgrades never chain onto an outgrown lift', () => {
  it('moves a lift past one being upgraded itself, or holds it', () => {
    const p1 = profile({ level: 'beginner' });
    const first = generateProgramme({ profile: p1, equipment: [] });
    const sim = simulate(first, [], compliant({ seed: 2, growth: 0.03 }), {
      profile: { level: 'beginner' },
      answers: [],
      sessions: first.sessionsPerWeek * 8,
    });
    const last = sim.logs.at(-1)!;
    const p2 = profile();
    const ctx = progress(first, [], p2, {
      logs: sim.logs,
      now: new Date(Date.parse(last.startedAt) + 86_400_000),
    });
    const offered = upgradesFor(first, ctx);
    expect(offered.length).toBeGreaterThan(1);
    const from = new Set(offered.map((u) => u.from));
    for (const u of offered) {
      expect(from.has(u.to), `${u.from} -> ${u.to}`).toBe(false);
      const a = exerciseById.get(u.from)!;
      const b = exerciseById.get(u.to)!;
      expect(b.difficulty).toBeLessThanOrEqual(a.difficulty + 1);
    }
    // The towel row used to be offered the inverted row, which the inverted row outgrew.
    expect(offered.find((u) => u.from === 'door-towel-row')?.to).not.toBe('inverted-row');
  });
});

describe('the step limit at a new level', () => {
  const sets: [string, EquipmentInventory][] = Object.entries(equipmentSets);

  it('no lift moves more than a step up or into jumps from last cycle, finishers included', () => {
    const bad: string[] = [];
    for (const [name, equipment] of sets)
      for (const goal of ['muscle', 'recomposition'] as Goal[])
        for (const days of [3, 5])
          for (const [from, to] of [
            ['beginner', 'intermediate'],
            ['intermediate', 'advanced'],
          ] as const) {
            const p1 = profile({ goal, level: from, daysPerWeek: days, sessionMinutes: 45 });
            const p2 = { ...p1, level: to };
            const first = generateProgramme({ profile: p1, equipment });
            const next = nextCycle({
              previous: first,
              profile: p2,
              equipment,
              progress: progress(first, equipment, p2),
            });
            for (const l of leaps(first, next.generated))
              bad.push(`${name}/${goal}/${days}d/${from}->${to} ${l}`);
          }
    expect(bad).toEqual([]);
  });
});

describe('lifts with logged sets keep their place', () => {
  const kettlebells = equipmentSets.kettlebells!;
  const p1 = profile({ level: 'beginner', daysPerWeek: 3, sessionMinutes: 20 });
  const p2 = profile({ daysPerWeek: 3, sessionMinutes: 20 });
  const first = generateProgramme({ profile: p1, equipment: kettlebells });
  const hinge = (programme: Programme) =>
    Object.entries(slotPicks(programme)).find(([key]) => key.endsWith('/hinge-main'))?.[1];

  it('drops a kept lift whose owned weights no longer suit the new level when nothing was lifted', () => {
    const next = nextCycle({
      previous: first,
      profile: p2,
      equipment: kettlebells,
      progress: progress(first, kettlebells, p2),
    });
    expect(hinge(first)).toBe('dumbbell-romanian-deadlift');
    expect(hinge(next.generated)).not.toBe('dumbbell-romanian-deadlift');
  });

  it('keeps it once it has been lifted', () => {
    const sim = simulate(first, kettlebells, compliant({ seed: 2, growth: 0.03 }), {
      profile: p1,
      sessions: first.sessionsPerWeek * 8,
    });
    const next = nextCycle({
      previous: first,
      profile: p2,
      equipment: kettlebells,
      progress: progress(first, kettlebells, p2, { logs: sim.logs }),
    });
    expect(hinge(next.generated)).toBe('dumbbell-romanian-deadlift');
  });

  it('keeps it when the next cycle is regenerated too', () => {
    const sim = simulate(first, kettlebells, compliant({ seed: 2, growth: 0.03 }), {
      profile: p1,
      sessions: first.sessionsPerWeek * 8,
    });
    const next = nextCycle({
      previous: first,
      profile: p2,
      equipment: kettlebells,
      progress: progress(first, kettlebells, p2, { logs: sim.logs }),
    });
    const again = nextProgramme('new', next.programme, p2, kettlebells, sim.logs);
    expect(hinge(again)).toBe('dumbbell-romanian-deadlift');
    expect(hinge(nextProgramme('new', next.programme, p2, kettlebells))).not.toBe(
      'dumbbell-romanian-deadlift',
    );
  });
});

describe('the change preview names slots as they are', () => {
  const p = profile({ goal: 'general-fitness', daysPerWeek: 4, sessionMinutes: 60 });
  const equipment = equipmentSets['well-equipped']!;
  const before = generateProgramme({ profile: p, equipment });

  it('keeps a repeated slot apart from the first one', () => {
    const slots = items(before.rotation.find((s) => s.id === 'd-lower-b')!)
      .map((i) => i.slot)
      .filter((s) => s?.startsWith('side-plank'));
    expect(slots).toEqual(['side-plank', 'side-plank-2']);
    const changes = programmeChanges(before, generateProgramme({ profile: p, equipment, seed: 2 }));
    const own = changes.filter(
      (c) => c.sessionId === 'd-lower-b' && c.slot.startsWith('side-plank'),
    );
    expect(own.map((c) => [c.slot, c.from, c.to])).toEqual([
      ['side-plank', 'side-plank', 'side-plank-leg-raise'],
      ['side-plank-2', 'knee-side-plank', 'side-plank'],
    ]);
  });

  it('shows a dropped repeat as dropped, not as the first slot changing', () => {
    const shorter = generateProgramme({ profile: { ...p, sessionMinutes: 30 }, equipment });
    const own = programmeChanges(before, shorter).filter((c) => c.slot.startsWith('side-plank'));
    expect(own).toEqual([
      { sessionId: 'd-lower-b', slot: 'side-plank-2', from: 'knee-side-plank' },
    ]);
  });
});
