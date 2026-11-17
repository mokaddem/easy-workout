import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { Block, EquipmentInventory, Goal, Profile, Programme, Session } from '../src/domain';
import { ProgrammeSchema } from '../src/domain';
import {
  addToGroup,
  carryEdits,
  checkProgramme,
  checkSession,
  defaultBlock,
  ensureSlots,
  generateProgramme,
  generatedSession,
  groupRests,
  groupWithNext,
  insertBlock,
  itemEdits,
  moveBlock,
  newSlot,
  placedItems,
  placeSession,
  programmeWithSlots,
  refreshRampUps,
  removeItem,
  removePlacements,
  replaceItem,
  resetItem,
  resetSession,
  restoreSlot,
  saveSessionEdit,
  sessionForWeek,
  setBlockDose,
  substituteFor,
  substitutesFor,
  syncPlacements,
  ungroup,
  type EditContext,
} from '../src/engine';
import { equipmentSets } from './fixtures/equipment-sets';
import { referenceEquipment } from './fixtures/reference-equipment';

const GOALS: Goal[] = ['muscle', 'recomposition', 'general-fitness'];

const matrix = (): Programme[] => {
  const out: Programme[] = [];
  for (const [name, equipment] of Object.entries(equipmentSets))
    for (const goal of GOALS)
      for (const daysPerWeek of [2, 3, 4, 5, 6]) {
        const profile: Profile = { goal, level: 'intermediate', daysPerWeek, sessionMinutes: 45 };
        out.push(generateProgramme({ profile, equipment, id: `${name}-${goal}-${daysPerWeek}` }));
      }
  return out;
};
const programmes = matrix();

const slotsOf = (session: Session) => [...placedItems(session)].map((p) => p.item.slot);

const stripSlots = (session: Session): Session => {
  const strip = <T extends { slot?: string }>({ slot: _, ...rest }: T) => rest;
  const blocks = (list: Session['main']) =>
    list.map((b) =>
      b.type === 'straight' ? { ...b, item: strip(b.item) } : { ...b, items: b.items.map(strip) },
    );
  return {
    ...session,
    warmup: blocks(session.warmup),
    main: blocks(session.main),
    finisher: blocks(session.finisher),
  };
};

describe('slots', () => {
  it('gives every generated item a slot, unique within its session', () => {
    for (const p of programmes)
      for (const s of p.rotation) {
        const slots = slotsOf(s);
        expect(
          slots.every((x) => typeof x === 'string' && x.length > 0),
          `${p.id} ${s.id}`,
        ).toBe(true);
        expect(new Set(slots).size, `${p.id} ${s.id}`).toBe(slots.length);
      }
  });

  it('gives a programme generated before slots existed the same slots back from its notes', () => {
    for (const p of programmes) {
      const old = { ...p, rotation: p.rotation.map(stripSlots) };
      expect(programmeWithSlots(old).rotation, p.id).toEqual(p.rotation);
    }
  });

  it('keeps existing slots and renames repeats', () => {
    const base = programmes[0]!.rotation[0]!;
    const first = base.main[0]!;
    const twice: Session = { ...base, main: [first, first, ...base.main.slice(1)] };
    const slots = slotsOf(ensureSlots(twice));
    expect(new Set(slots).size).toBe(slots.length);
    expect(slotsOf(ensureSlots(base))).toEqual(slotsOf(base));
  });

  it('accepts slot ids in a stored programme', () => {
    for (const p of programmes.slice(0, 5)) expect(ProgrammeSchema.safeParse(p).success).toBe(true);
  });
});

const reference: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 60,
};
const ref = generateProgramme({ profile: reference, equipment: referenceEquipment });
const ctx: EditContext = {
  profile: reference,
  inventory: referenceEquipment,
  exercises: exerciseById,
};
const session = (p: Programme, id: string) => p.rotation.find((s) => s.id === id)!;
const exercisesIn = (s: Session, section: 'warmup' | 'main' | 'finisher' = 'main') =>
  s[section].flatMap((b) => (b.type === 'straight' ? [b.item] : b.items)).map((i) => i.exerciseId);
const straight = (b: Block | undefined) => {
  if (b?.type !== 'straight') throw new Error('expected straight sets');
  return b;
};
const add = (s: Session, exerciseId: string, at: number, section: 'main' | 'finisher' = 'main') =>
  insertBlock(
    s,
    { section, index: at },
    defaultBlock(exerciseById.get(exerciseId)!, section, newSlot(s), ctx, at === 0),
  );

describe('edit operations', () => {
  const pull = session(ref, 'b-pull');

  it('chains two blocks and splits them back', () => {
    const grouped = groupWithNext(pull, 'main', 1);
    const g = grouped.main[1]!;
    expect(g.type === 'group' && g.style).toBe('superset');
    expect(grouped.main).toHaveLength(pull.main.length - 1);
    const back = ungroup(grouped, 'main', 1);
    expect(exercisesIn(back)).toEqual(exercisesIn(pull));
    expect(back.estimatedMinutes).toBeGreaterThan(0);
  });

  it('turns a superset left with one exercise into straight sets', () => {
    const superset = addToGroup(pull, 'main', 2, { ...straight(pull.main[3]).item, slot: 'u-x' });
    expect(superset.main[2]!.type).toBe('group');
    const single = removeItem(superset, { section: 'main', blockIndex: 2, itemIndex: 1 });
    expect(single.main[2]!.type).toBe('straight');
  });

  it('moves blocks within and across sections and recounts the time', () => {
    const moved = moveBlock(pull, { section: 'main', index: 0 }, { section: 'main', index: 2 });
    expect(exercisesIn(moved)[2]).toBe(exercisesIn(pull)[0]);
    const fewer = setBlockDose(pull, 'main', 0, { sets: 1 });
    expect(fewer.estimatedMinutes).toBeLessThan(pull.estimatedMinutes);
  });

  it('keeps the slot when an exercise is replaced', () => {
    const first = straight(pull.main[0]).item;
    const next = replaceItem(
      pull,
      { section: 'main', blockIndex: 0, itemIndex: 0 },
      {
        exerciseId: 'band-horizontal-row',
        target: { kind: 'reps', min: 10, max: 12 },
      },
    );
    expect(straight(next.main[0]).item.slot).toBe(first.slot);
  });
});

describe('editing a programme session', () => {
  const push = session(ref, 'a-push');
  const fewerSets = setBlockDose(push, 'main', 1, { sets: 2 });
  const withCurl = add(fewerSets, 'dumbbell-lateral-raise', fewerSets.main.length);

  it('keeps the generated session aside and tells what changed', () => {
    const edited = saveSessionEdit(ref, withCurl);
    expect(edited.generatedRotation).toEqual(ref.rotation);
    expect(session(edited, 'a-push').main).toHaveLength(push.main.length + 1);
    const edits = itemEdits(session(edited, 'a-push'), generatedSession(edited, 'a-push')!);
    expect([...edits.values()].sort()).toEqual(['added', 'dose']);
    expect(ProgrammeSchema.safeParse(edited).success).toBe(true);
  });

  it('resets an item, then the session, then forgets the generated copy', () => {
    const edited = saveSessionEdit(ref, withCurl);
    const slot = straight(push.main[1]).item.slot!;
    const one = resetItem(session(edited, 'a-push'), generatedSession(edited, 'a-push')!, slot);
    expect(straight(one.main[1]).sets).toBe(straight(push.main[1]).sets);
    const reset = resetSession(edited, 'a-push');
    expect(session(reset, 'a-push')).toEqual(push);
    expect(reset.generatedRotation).toBeUndefined();
  });

  it("places one of the user's own sessions, keeps it in sync and takes it out", () => {
    const own: Session = { ...withCurl, id: 'own-1', name: { fr: 'Ma séance', en: 'My session' } };
    const placed = placeSession(ref, 'a-push', own);
    expect(placed.placements).toEqual({ 'a-push': 'own-1' });
    expect(session(placed, 'a-push').name.en).toBe('My session');
    const renamed = syncPlacements(placed, { ...own, name: { fr: 'Poussée', en: 'Push day' } });
    expect(session(renamed, 'a-push').name.en).toBe('Push day');
    const out = removePlacements(renamed, 'own-1');
    expect(session(out, 'a-push')).toEqual(push);
    expect(out.placements).toBeUndefined();
    expect(() => saveSessionEdit(placed, session(placed, 'a-push'))).toThrow();
  });
});

describe('defaults for an added exercise', () => {
  const block = (id: string, section: 'warmup' | 'main' | 'finisher', leads = false) =>
    straight(defaultBlock(exerciseById.get(id)!, section, 'u-test', ctx, leads));

  it('doses cardio in minutes, never as a 30-second set', () => {
    const b = block('treadmill-incline-walk', 'finisher');
    expect(b.item.target).toMatchObject({ kind: 'cardio', minMinutes: 10, maxMinutes: 15 });
    expect(b.item.target).toMatchObject({ speedKmh: 5, inclinePct: 12 });
  });

  it('keeps jumps crisp in the main part', () => {
    const b = block('jump-squat', 'main');
    expect(b.sets).toBe(3);
    expect(b.item.target).toEqual({ kind: 'reps', min: 5, max: 6 });
    expect(b.item.rir).toBeUndefined();
  });

  it('gives a lift that leads the session the main dose and a load', () => {
    const lead = block('goblet-squat', 'main', true);
    const later = block('goblet-squat', 'main');
    expect(lead.item.load?.kind).toBe('kg');
    expect(lead.restSec).toBeGreaterThanOrEqual(later.restSec);
  });

  it('rehearses a loaded lift in the warm-up with one lighter set of ten', () => {
    const warm = block('goblet-squat', 'warmup');
    const work = block('goblet-squat', 'main');
    expect(warm.sets).toBe(1);
    expect(warm.item.target).toEqual({ kind: 'reps', min: 10, max: 10 });
    const kg = (b: typeof warm) => (b.item.load?.kind === 'kg' ? b.item.load.kg : NaN);
    expect(kg(warm)).toBeLessThan(kg(work));
  });

  it('rests at least a minute after a round of two chained lifts', () => {
    const pull = session(ref, 'b-pull');
    const rests = groupRests(pull.main[0]!, pull.main[1]!);
    expect(rests.restAfterRoundSec).toBeGreaterThanOrEqual(60);
    expect(rests.restBetweenItemsSec).toBeLessThanOrEqual(15);
  });
});

describe('session checks', () => {
  const push = session(ref, 'a-push');

  it('blocks kipping bar work on a doorway bar and swings with selector dumbbells', () => {
    const toes = add(push, 'toes-to-bar', push.main.length);
    expect(checkSession(toes, ctx, { base: push }).map((i) => [i.level, i.code])).toContainEqual([
      'block',
      'doorway-bar',
    ]);
    const selector: EquipmentInventory = referenceEquipment.map((item) =>
      item.kind === 'dumbbell' ? { ...item, mechanism: 'selector' as const } : item,
    );
    const swing = add(push, 'dumbbell-swing', push.main.length);
    const issues = checkSession(swing, { ...ctx, inventory: selector }, { base: push });
    expect(issues.map((i) => [i.level, i.code])).toContainEqual(['block', 'selector-swing']);
  });

  it('warns only about what the change caused', () => {
    expect(checkSession(push, ctx, { base: push })).toEqual([]);
    const lead = straight(push.main[0]);
    const failing = {
      ...push,
      main: [{ ...lead, item: { ...lead.item, rir: 0 } }, ...push.main.slice(1)],
    };
    expect(checkSession(failing, ctx, { base: push }).map((i) => i.code)).toEqual([
      'rir-zero-loaded',
    ]);
  });

  it('flags a week left without pulling', () => {
    const noPull = saveSessionEdit(ref, {
      ...session(ref, 'b-pull'),
      main: session(ref, 'b-pull').main.slice(-1),
    });
    const codes = checkProgramme(noPull, ctx).map((i) => i.code);
    expect(codes).toContain('push-pull');
  });
});

describe('ramp-up sets', () => {
  it('follow the first lift when it changes', () => {
    const lower = session(ref, 'c-lower-core');
    const ramps = (s: Session) =>
      s.warmup.filter((b) => b.type === 'straight' && b.item.slot?.startsWith('ramp-'));
    const swapped = replaceItem(
      lower,
      { section: 'main', blockIndex: 0, itemIndex: 0 },
      {
        ...straight(lower.main[0]).item,
        exerciseId: 'dumbbell-romanian-deadlift',
      },
    );
    const after = refreshRampUps(swapped, lower, ctx);
    for (const b of ramps(after))
      expect(straight(b).item.exerciseId).toBe('dumbbell-romanian-deadlift');
    expect(refreshRampUps(lower, lower, ctx)).toBe(lower);
  });
});

describe('extra sets in volume weeks', () => {
  it('go to the lead lifts wherever the user moved them', () => {
    const pull = session(ref, 'b-pull');
    const last = pull.main.length - 1;
    const curlFirst = moveBlock(
      pull,
      { section: 'main', index: last },
      { section: 'main', index: 0 },
    );
    const edited = saveSessionEdit(ref, curlFirst);
    const volumeWeek = edited.phases.find((p) => p.kind === 'volume')!.fromWeek;
    const plan = sessionForWeek(edited, 'b-pull', volumeWeek).session;
    expect(straight(plan.main[0]).sets).toBe(straight(curlFirst.main[0]).sets);
    expect(countOf(plan.main[1]!)).toBe(countOf(curlFirst.main[1]!) + 1);
  });
});

const countOf = (b: Block) => (b.type === 'straight' ? b.sets : b.rounds);

describe('carrying edits onto a regeneration', () => {
  const push = session(ref, 'a-push');
  const raise = add(setBlockDose(push, 'main', 1, { sets: 2 }), 'pike-push-up', 2);
  const edited = saveSessionEdit(ref, raise);
  const regenerate = (profile: Profile, equipment = referenceEquipment) =>
    generateProgramme({ profile, equipment });

  it('keeps everything when nothing else changed', () => {
    const { programme, kept, dropped } = carryEdits(edited, regenerate(reference), ctx);
    expect(dropped).toEqual([]);
    expect(kept.map((k) => k.kind).sort()).toEqual(['added', 'dose']);
    expect(exercisesIn(session(programme, 'a-push'))).toEqual(exercisesIn(raise));
    expect(straight(session(programme, 'a-push').main[1]).sets).toBe(2);
    expect(programme.generatedRotation).toBeDefined();
  });

  it('takes the new dose where the user changed nothing, and carries their change as a change', () => {
    const beginner: Profile = { ...reference, level: 'beginner' };
    const fresh = regenerate(beginner);
    const { programme } = carryEdits(edited, fresh, { ...ctx, profile: beginner });
    const merged = session(programme, 'a-push');
    const was = straight(push.main[1]).sets;
    const now = straight(session(fresh, 'a-push').main[1]).sets;
    expect(straight(merged.main[1]).sets).toBe(Math.max(1, now + 2 - was));
    expect(straight(merged.main[0])).toMatchObject({
      sets: straight(session(fresh, 'a-push').main[0]).sets,
    });
  });

  it('lists what no longer applies when the split changes', () => {
    const three: Profile = { ...reference, daysPerWeek: 3 };
    const { dropped } = carryEdits(edited, regenerate(three), { ...ctx, profile: three });
    expect(dropped).toEqual([{ sessionId: 'a-push', kind: 'session', reason: 'session-gone' }]);
  });

  it('drops an exercise the new equipment can no longer do', () => {
    const goblet = saveSessionEdit(ref, add(push, 'goblet-squat', push.main.length));
    const noDumbbells = referenceEquipment.filter((i) => i.kind !== 'dumbbell');
    const { dropped } = carryEdits(goblet, regenerate(reference, noDumbbells), {
      ...ctx,
      inventory: noDumbbells,
    });
    expect(dropped).toEqual([
      expect.objectContaining({ kind: 'added', exerciseId: 'goblet-squat', reason: 'unusable' }),
    ]);
  });

  it('never leaves the same exercise twice in a session', () => {
    const fresh = regenerate(reference);
    const other = straight(session(fresh, 'a-push').main[2]).item.exerciseId;
    const mine = add(push, other, push.main.length);
    const { programme } = carryEdits(saveSessionEdit(ref, mine), fresh, ctx);
    const ids = exercisesIn(session(programme, 'a-push'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries a placed session of the user's own while it exists", () => {
    const own: Session = { ...raise, id: 'own-1' };
    const placed = placeSession(ref, 'a-push', own);
    const kept = carryEdits(placed, regenerate(reference), ctx, new Set(['own-1']));
    expect(kept.programme.placements).toEqual({ 'a-push': 'own-1' });
    const gone = carryEdits(placed, regenerate(reference), ctx, new Set());
    expect(gone.programme.placements).toBeUndefined();
  });
});

describe('putting a removed item back', () => {
  it('goes back where the generation had it', () => {
    const pull = session(ref, 'b-pull');
    const slot = straight(pull.main[2]).item.slot!;
    const without = removeItem(pull, { section: 'main', blockIndex: 2, itemIndex: 0 });
    expect(restoreSlot(without, pull, slot)).toEqual(pull);
    expect(restoreSlot(pull, pull, slot)).toBe(pull);
  });

  it('suggests other exercises for the same job, best first', () => {
    const row = exerciseById.get('band-horizontal-row')!;
    const list = substitutesFor(row, referenceEquipment);
    expect(list.length).toBeGreaterThan(1);
    for (const e of list) expect(e.pattern).toBe(row.pattern);
    expect(list[0]).toEqual(substituteFor(row, referenceEquipment));
  });
});

describe('carrying edits safely', () => {
  const lower = session(ref, 'c-lower-core');
  const regenerate = (equipment: EquipmentInventory) =>
    generateProgramme({ profile: reference, equipment });
  const hinges = (s: Session) =>
    exercisesIn(s).filter((id) => exerciseById.get(id)?.pattern === 'hinge');

  it("gives a place back when the user's own session can't be run safely any more", () => {
    const own: Session = { ...add(lower, 'dumbbell-swing', lower.main.length), id: 'own-1' };
    const placed = placeSession(ref, 'c-lower-core', own);
    const selector: EquipmentInventory = referenceEquipment.map((item) =>
      item.kind === 'dumbbell' ? { ...item, mechanism: 'selector' as const } : item,
    );
    const { programme, dropped } = carryEdits(
      placed,
      regenerate(selector),
      { ...ctx, inventory: selector },
      new Set(['own-1']),
    );
    expect(programme.placements).toBeUndefined();
    expect(dropped).toContainEqual(
      expect.objectContaining({ kind: 'placement', reason: 'unusable' }),
    );
  });

  it('never keeps a weighted lead lift without a weight that fits', () => {
    const rdl = replaceItem(
      lower,
      { section: 'main', blockIndex: 0, itemIndex: 0 },
      {
        ...straight(lower.main[0]).item,
        exerciseId: 'dumbbell-romanian-deadlift',
      },
    );
    const kettlebells = equipmentSets.kettlebells!;
    const { programme } = carryEdits(saveSessionEdit(ref, rdl), regenerate(kettlebells), {
      ...ctx,
      inventory: kettlebells,
    });
    for (const b of session(programme, 'c-lower-core').main)
      for (const item of b.type === 'straight' ? [b.item] : b.items)
        if (exerciseById.get(item.exerciseId)?.loadType === 'external')
          expect(item.load, item.exerciseId).toBeDefined();
  });

  it('brings a movement back when the replacement that did its job is dropped', () => {
    const hingeAt = lower.main.findIndex((b) => hinges({ ...lower, main: [b] }).length > 0);
    const hingeSlot = straight(lower.main[hingeAt]).item.slot!;
    const moved = removeItem(
      replaceItem(
        lower,
        { section: 'main', blockIndex: 1, itemIndex: 0 },
        {
          ...straight(lower.main[1]).item,
          exerciseId: 'dumbbell-romanian-deadlift',
        },
      ),
      { section: 'main', blockIndex: hingeAt, itemIndex: 0 },
    );
    const noDumbbells = referenceEquipment.filter((i) => i.kind !== 'dumbbell');
    const fresh = regenerate(noDumbbells);
    const { programme, dropped } = carryEdits(saveSessionEdit(ref, moved), fresh, {
      ...ctx,
      inventory: noDumbbells,
    });
    const freshHinge = [...placedItems(session(fresh, 'c-lower-core'))].find(
      (p) => p.item.slot === hingeSlot,
    );
    if (freshHinge && exerciseById.get(freshHinge.item.exerciseId)?.pattern === 'hinge') {
      expect(hinges(session(programme, 'c-lower-core'))).toContain(freshHinge.item.exerciseId);
      expect(dropped).toContainEqual(
        expect.objectContaining({ kind: 'removed', slot: hingeSlot, reason: 'unusable' }),
      );
    } else expect(freshHinge?.item.exerciseId).toBeUndefined();
  });
});

describe('defaults after the coach check', () => {
  const block = (id: string, section: 'warmup' | 'main' | 'finisher', profile = reference) =>
    straight(defaultBlock(exerciseById.get(id)!, section, 'u-test', { ...ctx, profile }, false));

  it('rehearses a bodyweight lift in the warm-up with a few easy reps', () => {
    const b = block('pull-up', 'warmup', { ...reference, level: 'beginner' });
    expect(b.item.target.kind === 'reps' && b.item.target.max).toBeLessThanOrEqual(5);
  });

  it('doses swings for reps in the main part and rope as intervals', () => {
    expect(block('dumbbell-swing', 'main').item.target).toEqual({ kind: 'reps', min: 8, max: 12 });
    expect(block('jump-rope-bounce', 'finisher').item.target).toMatchObject({ kind: 'interval' });
  });

  it('gives cardio in the main part a cardio day, within the session length', () => {
    const t = block('treadmill-walk', 'main', { ...reference, sessionMinutes: 30 }).item.target;
    expect(t).toMatchObject({ kind: 'cardio', maxMinutes: 30 });
  });

  it('leaves room to progress: no one-number range on added work', () => {
    for (const id of ['dumbbell-lateral-raise', 'goblet-squat', 'push-up', 'plank']) {
      const t = block(id, 'main').item.target;
      if (t.kind === 'reps') expect(t.max, id).toBeGreaterThan(t.min);
    }
  });

  it('never calls generated main work a warm-up drill', () => {
    for (const p of programmes)
      for (const s of p.rotation)
        expect(
          checkSession(s, { ...ctx, inventory: [] }).filter((i) => i.code === 'warmup-in-main'),
          `${p.id} ${s.id}`,
        ).toEqual([]);
  });
});

describe('carrying additions', () => {
  const push = session(ref, 'a-push');
  const facePull = add(push, 'band-face-pull', push.main.length);
  const slotOf = (s: Session, exerciseId: string) =>
    [...placedItems(s)].find((p) => p.item.exerciseId === exerciseId)?.item.slot;

  it("a dropped addition doesn't stand in for the slot the new programme adds", () => {
    const kettlebells = equipmentSets.kettlebells!;
    const fresh = generateProgramme({ profile: reference, equipment: kettlebells });
    const { programme, dropped } = carryEdits(saveSessionEdit(ref, facePull), fresh, {
      ...ctx,
      inventory: kettlebells,
    });
    expect(dropped).toContainEqual(
      expect.objectContaining({ kind: 'added', exerciseId: 'band-face-pull' }),
    );
    const freshPush = session(fresh, 'a-push');
    expect(exercisesIn(session(programme, 'a-push')).sort()).toEqual(exercisesIn(freshPush).sort());
  });

  it('an addition left as it was given is dosed again for a new level', () => {
    const beginner: Profile = { ...reference, level: 'beginner' };
    const { programme } = carryEdits(
      saveSessionEdit(ref, facePull),
      generateProgramme({ profile: beginner, equipment: referenceEquipment }),
      { ...ctx, profile: beginner },
    );
    const merged = session(programme, 'a-push');
    const slot = slotOf(facePull, 'band-face-pull')!;
    const block = merged.main.find((b) => b.type === 'straight' && b.item.slot === slot)!;
    const expected = defaultBlock(
      exerciseById.get('band-face-pull')!,
      'main',
      slot,
      { ...ctx, profile: beginner },
      false,
    );
    expect(block).toEqual(expected);
  });
});
