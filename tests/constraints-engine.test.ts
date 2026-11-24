import { describe, expect, it } from 'vitest';
import { catalogue, exerciseById } from '../src/catalogue';
import type { Exercise, JointRegion, Profile, Session } from '../src/domain';
import {
  activeSwaps,
  applySwaps,
  constraintsOf,
  fitFor,
  generateProgramme,
  generateQuickSession,
  harderNeedsEquipment,
  harderVariantFor,
  isTestable,
  prepareSession,
  programmeChanges,
  playSteps,
  setAdjustments,
  substitutesFor,
  type ProgressContext,
} from '../src/engine';
import { fitToBudget, type BuiltBlock, type BuiltSession } from '../src/engine/generate/fit';
import { makeContext } from '../src/engine/generate/programme';
import { newSelectionState, selectExercise } from '../src/engine/generate/select';
import type { SlotSpec } from '../src/engine/generate/types';
import { referenceEquipment } from './fixtures/reference-equipment';

const SINCE = '2026-01-01T00:00:00.000Z';
const NOW = new Date('2026-06-01T09:00:00.000Z');

const profile = (extra: Partial<Profile> = {}): Profile => ({
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  ...extra,
});

const limit = (...regions: JointRegion[]): Partial<Profile> => ({
  limitations: regions.map((region) => ({ region, since: SINCE })),
});

/** A catalogue entry for the selection tests: bodyweight, no equipment, graded as given. */
const move = (
  id: string,
  pattern: Exercise['pattern'],
  joints: Exercise['joints'],
  extra: Partial<Exercise> = {},
): Exercise => ({
  id,
  name: { fr: id, en: id },
  execution: { fr: ['a'], en: ['a'] },
  keyCue: { fr: 'a', en: 'a' },
  primaryMuscles: ['quads'],
  secondaryMuscles: [],
  pattern,
  tags: ['compound'],
  equipment: [[]],
  loadType: 'bodyweight',
  metric: 'reps',
  unilateral: false,
  difficulty: 1,
  easier: [],
  harder: [],
  joints,
  ...extra,
});

const slot = (patterns: SlotSpec['patterns'], extra: Partial<SlotSpec> = {}): SlotSpec => ({
  id: 'slot',
  role: 'accessory',
  patterns,
  reps: [8, 12],
  ...extra,
});

const pick = (
  exercises: Exercise[],
  slotSpec: SlotSpec,
  avoided: Partial<Profile>,
  state = newSelectionState(),
  input: Partial<Parameters<typeof makeContext>[0]> = {},
) => {
  const ctx = makeContext({ profile: profile(avoided), equipment: [], ...input }, exercises);
  return { ctx, state, selection: selectExercise(slotSpec, ctx, state) };
};

describe('fitFor', () => {
  const squat = move('squat', 'squat', { knee: 'moderate', hip: 'high' });
  const jump = move('jump', 'squat', { knee: 'high', ankle: 'high' }, { tags: ['impact'] });
  const lunge = move('lunge', 'lunge', {}, { tags: ['needs-space'] });
  const plank = move('plank', 'core-anti-extension', {});

  it('is ok without constraints', () => {
    expect(fitFor(jump, undefined)).toBe('ok');
    expect(fitFor(jump, constraintsOf(profile()))).toBe('ok');
  });

  it('rules out a high grade on a limited joint and spares a moderate one', () => {
    expect(fitFor(squat, constraintsOf(profile(limit('knee'))))).toBe('moderate');
    expect(fitFor(squat, constraintsOf(profile(limit('hip'))))).toBe('out');
    expect(fitFor(squat, constraintsOf(profile(limit('shoulder'))))).toBe('ok');
    expect(fitFor(squat, constraintsOf(profile(limit('knee', 'hip'))))).toBe('out');
  });

  it('ignores lifted limitations', () => {
    const lifted = profile({
      limitations: [{ region: 'hip', since: SINCE, liftedAt: '2026-03-01T00:00:00.000Z' }],
    });
    expect(constraintsOf(lifted).regions).toEqual([]);
    expect(fitFor(squat, constraintsOf(lifted))).toBe('ok');
  });

  it('rules out impact when quiet and needs-space in a small space', () => {
    expect(fitFor(jump, constraintsOf(profile({ quiet: true })))).toBe('out');
    expect(fitFor(lunge, constraintsOf(profile({ quiet: true })))).toBe('ok');
    expect(fitFor(lunge, constraintsOf(profile({ smallSpace: true })))).toBe('out');
    expect(fitFor(plank, constraintsOf(profile({ quiet: true, smallSpace: true })))).toBe('ok');
  });

  it('puts the regions in a fixed order, whatever the order they were added in', () => {
    expect(constraintsOf(profile(limit('wrist', 'knee', 'wrist'))).regions).toEqual([
      'knee',
      'wrist',
    ]);
  });
});

describe('selection with constraints', () => {
  const ok = move('ok-squat', 'squat', {});
  const spare = move('spare-squat', 'squat', { knee: 'moderate' });
  const spare2 = move('spare-squat-2', 'squat', { knee: 'moderate' });
  const out = move('out-squat', 'squat', { knee: 'high' });

  it('never picks an exercise that is out', () => {
    expect(pick([out], slot(['squat']), limit('knee')).selection).toBeNull();
  });

  it('takes no-entry before moderate, whatever the catalogue order or the preference', () => {
    const { selection } = pick(
      [spare, ok],
      slot(['squat'], { prefer: ['spare-squat', 'ok-squat'] }),
      limit('knee'),
    );
    expect(selection?.exercise.id).toBe('ok-squat');
  });

  it('prefers no-entry in the ranked path too', () => {
    expect(pick([spare, ok], slot(['squat']), limit('knee')).selection?.exercise.id).toBe(
      'ok-squat',
    );
  });

  it('takes no-entry before moderate among easier variants', () => {
    const top = move('top', 'squat', { knee: 'high' }, { easier: ['spare-squat', 'ok-squat'] });
    const { selection } = pick(
      [top, spare, ok],
      slot(['squat'], { prefer: ['top'] }),
      limit('knee'),
    );
    expect(selection?.method).toBe('easier-variant');
    expect(selection?.exercise.id).toBe('ok-squat');
  });

  it('keeps last cycle’s lift only when it spares nothing', () => {
    const main = slot(['squat'], { role: 'main', prefer: ['ok-squat'] });
    const kept = (avoided: Partial<Profile>) => {
      const state = newSelectionState();
      state.sessionId = 's';
      return pick([spare, ok], main, avoided, state, { lastCycle: { 's/slot': 'spare-squat' } })
        .selection;
    };
    expect(kept({})?.method).toBe('kept');
    expect(kept({})?.exercise.id).toBe('spare-squat');
    expect(kept(limit('knee'))?.exercise.id).toBe('ok-squat');
  });

  it('allows one moderate exercise per limited joint in a session, main and finisher together', () => {
    const state = newSelectionState();
    const exercises = [spare, spare2];
    const first = pick(exercises, slot(['squat']), limit('knee'), state);
    expect(first.selection?.exercise.id).toBe('spare-squat');
    const second = selectExercise(slot(['squat'], { id: 'another' }), first.ctx, state);
    expect(second).toBeNull();
  });

  it('has a warm-up budget of its own and ranks no-entry first there', () => {
    const state = newSelectionState();
    const exercises = [spare, spare2, ok];
    const first = pick(exercises, slot(['squat']), limit('knee'), state);
    const warm = (id: string) => slot(['squat'], { id, role: 'warmup' });
    const w1 = selectExercise(warm('w1'), first.ctx, state);
    // The main budget is spent, the warm-up's is not; no-entry still comes first there.
    expect(w1?.exercise.id).toBe('ok-squat');
    const w2 = selectExercise(warm('w2'), first.ctx, state);
    expect(w2?.exercise.id).toMatch(/^spare-squat/);
  });

  describe('fallback chain', () => {
    const bridge = move('bridge', 'hip-extension', {}, { primaryMuscles: ['glutes'] });
    const squatGlutes = move(
      'goblet',
      'squat',
      { knee: 'moderate' },
      { primaryMuscles: ['quads', 'glutes'] },
    );
    const curl = move('curl', 'knee-flexion', {}, { primaryMuscles: ['hamstrings'] });

    it('goes same pattern no-entry, then same pattern moderate, then a neighbour, then drops', () => {
      const exercises = [squatGlutes, bridge];
      const state = newSelectionState();
      const first = pick(exercises, slot(['squat']), limit('knee'), state);
      expect(first.selection).toMatchObject({ method: 'ranked' });
      expect(first.selection?.exercise.id).toBe('goblet');
      // Budget spent: a neighbour sharing a primary muscle with the squat pattern.
      const second = selectExercise(slot(['squat'], { id: 'second' }), first.ctx, state);
      expect(second).toMatchObject({ method: 'fallback-pattern' });
      expect(second?.exercise.id).toBe('bridge');
      // Nothing left that shares a muscle (a curl trains the hamstrings only): dropped.
      const third = pick([squatGlutes, curl], slot(['squat']), limit('knee'));
      expect(third.selection?.exercise.id).toBe('goblet');
      expect(selectExercise(slot(['squat'], { id: 'third' }), third.ctx, third.state)).toBeNull();
    });

    it('never falls back to a high exercise', () => {
      const highBridge = move('high-bridge', 'hip-extension', { knee: 'high' });
      expect(pick([highBridge], slot(['squat']), limit('knee')).selection).toBeNull();
    });

    it('does not use neighbours without constraints', () => {
      expect(pick([bridge], slot(['squat']), {}).selection).toBeNull();
    });
  });

  it('leaves the budget of a kept user exercise spent', () => {
    const state = newSelectionState();
    const { ctx } = pick([spare], slot(['squat']), limit('knee'), state, {
      reserved: { s: ['spare-squat-2'] },
    });
    expect(ctx.reserved?.get('s')).toEqual(['spare-squat-2']);
  });
});

describe('programmes with constraints', () => {
  const kneeProfile = profile({ ...limit('knee'), daysPerWeek: 5 });

  it('names why a slot was left out, and the programme diff reports it', () => {
    const plain = generateProgramme({
      profile: profile({ level: 'beginner', daysPerWeek: 5 }),
      equipment: [],
    });
    const wrist = generateProgramme({
      profile: profile({ level: 'beginner', daysPerWeek: 5, ...limit('wrist') }),
      equipment: [],
    });
    const note = wrist.generation!.notes.find((n) => n.code === 'slot-limited');
    expect(note).toMatchObject({ params: { cause: 'region', region: 'wrist' } });
    const changes = programmeChanges(plain, wrist);
    expect(changes.some((c) => c.from && !c.to && c.slot === note!.params.slot)).toBe(true);
  });

  it('notes a muscle that loses more than 30 % of its weekly sets, against the same seed without the limitation', () => {
    const programme = generateProgramme({ profile: kneeProfile, equipment: [] });
    const noted = programme.generation!.notes.filter((n) => n.code === 'muscle-volume-reduced');
    expect(noted.length).toBeGreaterThan(0);
    for (const n of noted) {
      expect(Number(n.params.after)).toBeLessThan(Number(n.params.before) * 0.7);
      expect(n.params.regions).toBe('knee');
    }
    const without = generateProgramme({
      profile: profile({ daysPerWeek: 5 }),
      equipment: [],
    });
    expect(without.generation!.notes.some((n) => n.code === 'muscle-volume-reduced')).toBe(false);
  });

  it('puts a short plain circuit in the finisher when no cardio drill fits', () => {
    const few = catalogue.filter(
      (e) => !['step-jacks', 'brisk-walk', 'march-in-place'].includes(e.id),
    );
    const programme = generateProgramme(
      {
        profile: profile({ quiet: true, smallSpace: true, daysPerWeek: 3 }),
        equipment: [],
      },
      few,
    );
    const thin = programme.generation!.notes.filter((n) => n.code === 'finisher-thin');
    expect(thin.length).toBeGreaterThan(0);
    const session = programme.rotation.find((s) => s.id === thin[0]!.ref!.sessionId)!;
    const circuit = session.finisher.find((b) => b.type === 'group')!;
    expect(circuit.type === 'group' && circuit.items.length).toBeGreaterThanOrEqual(2);
    for (const item of circuit.type === 'group' ? circuit.items : []) {
      const e = exerciseById.get(item.exerciseId)!;
      expect(e.loadType).toBe('bodyweight');
      expect(e.equipment.some((setup) => setup.length === 0)).toBe(true);
      expect(fitFor(e, constraintsOf(profile({ quiet: true, smallSpace: true })))).toBe('ok');
    }
  });

  it('builds quick sessions around the limitation too', () => {
    const quick = generateQuickSession({
      profile: profile(limit('knee', 'shoulder')),
      equipment: referenceEquipment,
      minutes: 40,
      focus: 'full',
    });
    const constraints = constraintsOf(profile(limit('knee', 'shoulder')));
    for (const block of [...quick.session.main, ...quick.session.finisher])
      for (const item of block.type === 'straight' ? [block.item] : block.items)
        expect(fitFor(exerciseById.get(item.exerciseId)!, constraints)).not.toBe('out');
  });

  it('gives time freed by a slot left out to blocks that do not work that joint', () => {
    const block = (id: string, touches: JointRegion[] | undefined, sets = 3): BuiltBlock => ({
      block: {
        type: 'straight',
        item: { exerciseId: id, target: { kind: 'reps', min: 8, max: 12 } },
        sets,
        restSec: 60,
      },
      priority: 1,
      role: 'main',
      included: true,
      notes: [],
      muscles: [['chest']],
      ...(touches && { touches }),
    });
    const make = (): BuiltSession => ({
      warmup: [],
      main: [block('push-up', ['wrist']), block('goblet-squat', undefined)],
      finisher: [],
    });
    const setsOf = (built: BuiltSession) =>
      built.main.map((b) => (b.block.type === 'straight' ? b.block.sets : 0));
    const free = make();
    fitToBudget(free, 40);
    const spared = make();
    fitToBudget(spared, 40, 5, { spare: ['wrist'] });
    expect(setsOf(free)[0]).toBeGreaterThan(3);
    expect(setsOf(spared)[0]).toBe(3);
    expect(setsOf(spared)[1]).toBeGreaterThan(3);
  });
});

describe('max tests with constraints', () => {
  it('only lets a test go to the limit on an exercise that spares nothing', () => {
    const pushUp = exerciseById.get('push-up')!;
    expect(isTestable(pushUp, 'intermediate')).toBe(true);
    const wrist = constraintsOf(profile(limit('wrist')));
    expect(fitFor(pushUp, wrist)).toBe('moderate');
    expect(isTestable(pushUp, 'intermediate', wrist)).toBe(false);
  });

  it('picks another test for the generated programme, or none', () => {
    const programme = generateProgramme({
      profile: profile({ ...limit('wrist'), daysPerWeek: 3 }),
      equipment: referenceEquipment,
    });
    const test = programme.phases.flatMap((p) => p.adjustments).find((a) => a.kind === 'max-test');
    if (test)
      for (const id of test.exerciseIds)
        expect(
          isTestable(exerciseById.get(id)!, 'intermediate', constraintsOf(profile(limit('wrist')))),
        ).toBe(true);
  });
});

describe('swaps and variants with constraints', () => {
  const session = (id: string): Session => ({
    id: 's',
    name: { fr: 's', en: 's' },
    estimatedMinutes: 20,
    warmup: [],
    main: [
      {
        type: 'straight',
        item: { exerciseId: id, target: { kind: 'reps', min: 8, max: 12 } },
        sets: 3,
        restSec: 60,
      },
    ],
    finisher: [],
  });
  const inventory = referenceEquipment;
  const ctx = { inventory, level: 'intermediate' as const };
  const swapsTo = (from: string, to: string) =>
    activeSwaps([
      {
        id: 'a',
        exerciseId: from,
        kind: 'no-equipment',
        answer: 'swap',
        substituteId: to,
        at: SINCE,
      },
    ]);

  it('applies a swap, and falls back to the generated pick when the target is now out', () => {
    const swaps = swapsTo('goblet-squat', 'pistol-squat');
    const open = applySwaps(session('goblet-squat'), swaps, ctx);
    expect(open.replaces['main/0/0']).toBe('goblet-squat');
    expect(open.blocked).toEqual({});
    const knee = constraintsOf(profile(limit('knee')));
    const blocked = applySwaps(session('goblet-squat'), swaps, { ...ctx, constraints: knee });
    expect(blocked.session.main[0]).toMatchObject({ item: { exerciseId: 'goblet-squat' } });
    expect(blocked.replaces).toEqual({});
    expect(blocked.blocked).toEqual({ 'main/0/0': 'pistol-squat' });
  });

  it('offers substitutes the generator would accept', () => {
    const from = exerciseById.get('goblet-squat')!;
    const unconstrained = substitutesFor(from, inventory);
    const knee = constraintsOf(profile(limit('knee')));
    const context = { level: 'beginner' as const, constraints: knee };
    const accepted = substitutesFor(from, inventory, { context });
    expect(accepted.length).toBeLessThanOrEqual(unconstrained.length);
    for (const e of accepted) {
      expect(fitFor(e, knee)).not.toBe('out');
      expect(e.difficulty).toBeLessThanOrEqual(2);
      expect(e.difficulty).toBeLessThanOrEqual(from.difficulty + 1);
    }
    expect(unconstrained.some((e) => e.difficulty > 2)).toBe(true);
  });

  it('ranks a substitute that spares nothing before one that spares a joint', () => {
    const from = exerciseById.get('push-up')!;
    const wrist = constraintsOf(profile(limit('wrist')));
    const list = substitutesFor(from, [], { context: { level: 'advanced', constraints: wrist } });
    const grades = list.map((e) => fitFor(e, wrist));
    expect(grades).toEqual([...grades].sort((a, b) => (a === b ? 0 : a === 'ok' ? -1 : 1)));
  });

  it('skips a harder variant that is out, and does not call for buying it', () => {
    const region = 'wrist';
    // Find an exercise whose every harder link is high for one joint.
    const target = catalogue.find(
      (e) =>
        e.harder.length > 0 &&
        e.harder.every((id) => exerciseById.get(id)!.joints[region] === 'high'),
    );
    expect(target).toBeDefined();
    const wrist = constraintsOf(profile(limit(region)));
    const withBar = [{ id: 'bar', kind: 'pull-up-bar' as const, mount: 'wall' as const }];
    expect(
      harderVariantFor(target!, { inventory: referenceEquipment, constraints: wrist }),
    ).toBeUndefined();
    expect(harderNeedsEquipment(target!, { inventory: withBar, constraints: wrist })).toBe(false);
  });
});

describe('dose cap', () => {
  const base = (rir: number): Session => ({
    id: 's',
    name: { fr: 's', en: 's' },
    estimatedMinutes: 20,
    warmup: [],
    main: [
      {
        type: 'straight',
        item: {
          exerciseId: 'goblet-squat',
          target: { kind: 'reps', min: 8, max: 12 },
          rir,
          goal: 10,
          load: { kind: 'kg', kg: 12 },
        },
        sets: 3,
        restSec: 60,
      },
      {
        type: 'straight',
        item: {
          exerciseId: 'dumbbell-bench-press',
          target: { kind: 'reps', min: 8, max: 12 },
          rir,
          goal: 10,
          load: { kind: 'kg', kg: 12 },
        },
        sets: 3,
        restSec: 60,
      },
    ],
    finisher: [],
  });
  const context = (extra: Partial<Profile> = {}): ProgressContext => ({
    logs: [],
    programmes: [],
    answers: [],
    inventory: referenceEquipment,
    profile: { level: 'intermediate', ...extra },
    now: NOW,
  });

  it('caps exercises that spare a limited joint at 2 reps in reserve, and nothing else', () => {
    const prepared = prepareSession(base(0), context(limit('knee')));
    expect(prepared.doseCapped).toEqual(['main/0/0']);
    const [squat, press] = prepared.session.main.map((b) =>
      b.type === 'straight' ? b.item : b.items[0]!,
    );
    expect(squat!.rir).toBe(2);
    expect(squat!.goal).toBeLessThan(10);
    expect(press!.rir).toBe(0);
    expect(prepareSession(base(0), context()).doseCapped).toEqual([]);
  });

  it('applies to quick sessions too', () => {
    const prepared = prepareSession(base(1), context(limit('knee')), 'quick');
    expect(prepared.doseCapped).toEqual(['main/0/0']);
    expect(prepared.session.main[0]).toMatchObject({ item: { rir: 2 } });
  });

  it('keeps 2 reps in reserve after the week’s first and last set RIR, and in back-off sets', () => {
    const prepared = prepareSession(base(2), context(limit('knee')));
    const plan = {
      session: prepared.session,
      setRir: { first: 0, last: 0 },
      backOffLoadFactor: 0.9,
    };
    const adjustments = setAdjustments(plan, referenceEquipment, undefined, prepared.doseCapped)!;
    expect(adjustments.doseCapped).toEqual(['main/0/0']);
    const steps = playSteps(prepared.session, adjustments);
    const rirs = (exercise: string) =>
      steps.filter((s) => s.item.exerciseId === exercise).map((s) => s.planned.rir);
    expect(rirs('goblet-squat')).toEqual([2, 2, 2]);
    expect(rirs('dumbbell-bench-press')[0]).toBeLessThan(2);
    // A capped item takes no back-off: it was never taken closer to failure than 2.
    expect(adjustments.backOffLoads?.['main/0/0']).toBeUndefined();
  });

  it('adds nothing to the log adjustments when nothing is capped', () => {
    const prepared = prepareSession(base(2), context());
    const plan = { session: prepared.session, setRir: {}, backOffLoadFactor: undefined };
    expect(
      setAdjustments(plan, referenceEquipment, undefined, prepared.doseCapped),
    ).toBeUndefined();
  });

  it('reports a swap the constraints now rule out', () => {
    const answers = [
      {
        id: 'a',
        exerciseId: 'goblet-squat',
        kind: 'no-equipment' as const,
        answer: 'swap' as const,
        substituteId: 'pistol-squat',
        at: SINCE,
      },
    ];
    const prepared = prepareSession(base(2), { ...context(limit('knee')), answers });
    expect(prepared.blockedSwaps).toEqual({ 'main/0/0': 'pistol-squat' });
  });
});
