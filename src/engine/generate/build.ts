import type {
  Block,
  EquipmentInventory,
  EquipmentRequirement,
  Exercise,
  JointRegion,
  LocalizedText,
  MovementPattern,
  Session,
  SessionItem,
} from '../../domain';
import { sessionMinutes } from '../duration';
import { ensureSlots } from '../edit/slots';
import { CARDIO_LABEL, resolveCardio } from './cardio';
import { groupRest, groupRounds, itemDose, straightRest, straightSets } from './dose';
import {
  fitToBudget,
  materialise,
  type BuiltBlock,
  type BuiltSession,
  type PendingNote,
} from './fit';
import { isConstrained, moderateRegions, outCause, type Constraints } from './constraints';
import { rampLoad, startingLoad } from './loads';
import { selectExercise, type Selection, type SelectionState } from './select';
import { SHORT_SESSION_MINUTES } from './templates';
import type { BlockTemplate, CardioSpec, Context, SessionTemplate, SlotSpec } from './types';

export interface BuildOptions {
  id: string;
  name: LocalizedText;
  /** Time budget in minutes. */
  budget: number;
  /**
   * How cardio blocks are resolved. A cardio day prefers a walk to home intervals and is
   * dosed for the goal; a finisher prefers intervals. Defaults by template.
   */
  cardioPlace?: 'finisher' | 'day';
  /** Give up (return null) when fewer main blocks than this could be filled. */
  minMainBlocks?: number;
  /** The cardio finisher may be shortened to its floor but never dropped for time. */
  keepConditioning?: boolean;
}

/** Below this working load, ramp-up sets are just noise. */
const MIN_RAMP_WORKING_KG = 10;
/** The one ramp-up set kept under time pressure, as a share of the working load. */
const COLLAPSED_RAMP_FRACTION = 0.6;

/** How a pick is dosed: a kept stand-in from a neighbouring pattern stays dosed as one. */
const dosedAs = (sel: Selection) => (sel.fallback ? 'fallback-pattern' : sel.method);

/** The limited joints any of the exercises is graded on, high or moderate. */
const touchedBy = (exercises: readonly Exercise[], c: Constraints | undefined): JointRegion[] =>
  (c?.regions ?? []).filter((r) => exercises.some((e) => e.joints[r] !== undefined));

/** A copy of the picks made so far, so a what-if search leaves the real ones alone. */
const cloneState = (state: SelectionState): SelectionState => ({
  ...state,
  session: new Set(state.session),
  warmup: new Set(state.warmup),
  programme: new Set(state.programme),
  moderate: new Map(state.moderate),
  warmupModerate: new Map(state.warmupModerate),
});

/**
 * The note for a slot nothing could fill. When the constraints are why (what the slot would get
 * without them is ruled out or spared), it names the cause: a joint, quiet or small space.
 */
const droppedNote = (slot: SlotSpec, ctx: Context, state: SelectionState): PendingNote => {
  const plain: PendingNote = {
    code: 'slot-dropped',
    params: { slot: slot.id, patterns: slot.patterns.join(',') },
  };
  if (!isConstrained(ctx.constraints)) return plain;
  const probe = selectExercise(slot, { ...ctx, constraints: undefined }, cloneState(state));
  if (!probe) return plain;
  const cause =
    outCause(probe.exercise, ctx.constraints) ??
    (moderateRegions(probe.exercise, ctx.constraints)[0] !== undefined
      ? ({ cause: 'region', region: moderateRegions(probe.exercise, ctx.constraints)[0]! } as const)
      : undefined);
  if (!cause) return plain;
  return {
    code: 'slot-limited',
    params: {
      slot: slot.id,
      patterns: slot.patterns.join(','),
      cause: cause.cause,
      ...('region' in cause && { region: cause.region }),
    },
  };
};

/** Short conditioning circuit of moves needing nothing, for when constraints leave no cardio drill. */
const THIN_FINISHER: readonly SlotSpec[] = [
  {
    id: 'thin-drill',
    role: 'conditioning',
    patterns: ['conditioning'],
    prefer: ['step-jacks', 'shadow-boxing', 'mountain-climber'],
    reps: [20, 20],
    time: [30, 30],
    plain: true,
  },
  {
    id: 'thin-squat',
    role: 'conditioning',
    patterns: ['squat', 'conditioning'],
    prefer: ['bodyweight-squat', 'chair-squat'],
    reps: [20, 20],
    time: [30, 30],
    plain: true,
  },
  {
    id: 'thin-push',
    role: 'conditioning',
    patterns: ['push-horizontal', 'core-anti-extension'],
    prefer: ['push-up', 'knee-push-up', 'plank'],
    reps: [12, 12],
    time: [30, 30],
    plain: true,
  },
];
const THIN_FINISHER_ROUNDS = 3;
const THIN_FINISHER_REST_SEC = 45;

const touches = (exercises: readonly Exercise[], ctx: Context): { touches?: JointRegion[] } => {
  const regions = touchedBy(exercises, ctx.constraints);
  return regions.length > 0 ? { touches: regions } : {};
};

/** The time fit may shorten the block but must not drop it. */
const keeps = (tpl: BlockTemplate, ctx: Context): boolean =>
  tpl.keep === true ||
  (tpl.keepUpToDays !== undefined && ctx.profile.daysPerWeek <= tpl.keepUpToDays);

const selectionNote = (sel: Selection, slot: SlotSpec, itemIndex?: number): PendingNote[] => {
  const at = itemIndex === undefined ? {} : { itemIndex };
  const base = { exerciseId: sel.exercise.id, slot: slot.id };
  const notes: PendingNote[] = [];
  switch (sel.method) {
    case 'preferred':
      notes.push({
        code: 'exercise-preferred',
        params: sel.instead
          ? { ...base, instead: sel.instead.id, missing: sel.instead.missing.join(',') }
          : base,
        ...at,
      });
      break;
    case 'easier-variant':
      notes.push({
        code: 'exercise-easier-variant',
        params: { ...base, from: sel.from ?? '' },
        ...at,
      });
      break;
    case 'ranked':
      notes.push({
        code: 'exercise-ranked',
        params: { ...base, pattern: sel.exercise.pattern },
        ...at,
      });
      break;
    case 'kept':
      notes.push({ code: 'exercise-kept', params: base, ...at });
      break;
    case 'fallback-pattern':
      notes.push({
        code: 'exercise-fallback-pattern',
        params: { ...base, pattern: sel.exercise.pattern, wanted: slot.patterns.join(',') },
        ...at,
      });
      break;
  }
  if (sel.harderFrom)
    notes.push({
      code: 'exercise-harder-variant',
      params: { ...base, from: sel.harderFrom },
      ...at,
    });
  if (sel.upgradedFrom)
    notes.push({
      code: 'exercise-upgraded',
      params: { ...base, from: sel.upgradedFrom },
      ...at,
    });
  return notes;
};

const buildItem = (
  slot: SlotSpec,
  sel: Selection,
  ctx: Context,
  notes: PendingNote[],
  itemIndex?: number,
): SessionItem => {
  const dose = itemDose(slot, sel.exercise, dosedAs(sel), ctx.profile.goal, ctx.level);
  const load = startingLoad(
    sel.exercise,
    sel.setup,
    slot.role,
    { inventory: ctx.equipment, level: ctx.level, bodyweightKg: ctx.profile.bodyweightKg },
    (code, params) =>
      notes.push({ code, params, ...(itemIndex === undefined ? {} : { itemIndex }) }),
  );
  return { slot: slot.id, exerciseId: sel.exercise.id, ...dose, ...(load ? { load } : {}) };
};

const buildBlock = (
  tpl: BlockTemplate,
  ctx: Context,
  state: SelectionState,
  dropped: PendingNote[],
  place: 'finisher' | 'day',
): BuiltBlock | null => {
  const priority = tpl.priority ?? 1;
  if (tpl.type === 'cardio') {
    const choice = resolveCardio(tpl.cardio, place, ctx, state.sessionId, state);
    // Quiet and small space leave a thin pool: a mere walk, or nothing, is no finisher for a
    // recomposition or fitness goal, so a short circuit of plain moves takes its place.
    const thin =
      isConstrained(ctx.constraints) &&
      place === 'finisher' &&
      (!choice || (choice.modality === 'brisk-walk' && ctx.profile.goal === 'recomposition'));
    if (thin) {
      const circuit = buildBlock(
        {
          type: 'group',
          style: 'circuit',
          slots: THIN_FINISHER,
          rounds: THIN_FINISHER_ROUNDS,
          restAfterRoundSec: THIN_FINISHER_REST_SEC,
          priority,
          ...(tpl.keep !== undefined && { keep: tpl.keep }),
          ...(tpl.keepUpToDays !== undefined && { keepUpToDays: tpl.keepUpToDays }),
        },
        ctx,
        state,
        dropped,
        place,
      );
      if (circuit) {
        circuit.notes.push({ code: 'finisher-thin', params: {} });
        return circuit;
      }
    }
    if (!choice) {
      dropped.push({ code: 'cardio-unavailable', params: {} });
      return null;
    }
    const picked = ctx.catalogue.get(choice.exerciseId);
    for (const region of picked ? moderateRegions(picked, ctx.constraints) : [])
      state.moderate.set(region, (state.moderate.get(region) ?? 0) + 1);
    return {
      block: choice.block,
      priority,
      role: 'cardio',
      ...(picked && touchedBy([picked], ctx.constraints).length > 0
        ? { touches: touchedBy([picked], ctx.constraints) }
        : {}),
      included: priority < 3,
      ...(keeps(tpl, ctx) ? { keep: true } : {}),
      muscles: [],
      notes: [
        {
          code: 'cardio-modality',
          params: { exerciseId: choice.exerciseId, modality: choice.modality },
        },
      ],
    };
  }

  if (tpl.type === 'straight') {
    const sel = selectExercise(tpl.slot, ctx, state);
    if (!sel) {
      dropped.push(droppedNote(tpl.slot, ctx, state));
      return null;
    }
    const notes = selectionNote(sel, tpl.slot);
    const item = buildItem(tpl.slot, sel, ctx, notes);
    return {
      block: {
        type: 'straight',
        item,
        sets: straightSets(tpl.sets, tpl.slot.role, ctx.profile.goal, ctx.level),
        restSec: straightRest(
          tpl.restSec,
          tpl.slot.role,
          ctx.profile.goal,
          sel.exercise,
          dosedAs(sel),
        ),
      },
      priority,
      role: tpl.slot.role,
      included: priority < 3,
      ...(keeps(tpl, ctx) ? { keep: true } : {}),
      notes,
      setup: sel.setup,
      muscles: [sel.exercise.primaryMuscles],
      ...touches([sel.exercise], ctx),
    };
  }

  const picks: { slot: SlotSpec; sel: Selection }[] = [];
  for (const slot of tpl.slots) {
    const sel = selectExercise({ ...slot, grouped: true }, ctx, state);
    if (sel) picks.push({ slot, sel });
    else dropped.push(droppedNote({ ...slot, grouped: true }, ctx, state));
  }
  if (picks.length === 0) return null;
  const rounds = groupRounds(tpl.rounds, ctx.level);
  const rest = groupRest(tpl.restAfterRoundSec, tpl.style, ctx.profile.goal);
  const first = picks[0]!;

  if (picks.length === 1) {
    // A group needs two exercises; a lone survivor becomes straight sets.
    const notes = selectionNote(first.sel, first.slot);
    return {
      block: {
        type: 'straight',
        item: buildItem(first.slot, first.sel, ctx, notes),
        sets: rounds,
        restSec: rest,
      },
      priority,
      role: first.slot.role,
      included: priority < 3,
      ...(keeps(tpl, ctx) ? { keep: true } : {}),
      notes,
      muscles: [first.sel.exercise.primaryMuscles],
      ...touches([first.sel.exercise], ctx),
    };
  }
  const notes: PendingNote[] = [];
  const items = picks.map(({ slot, sel }, i) => {
    notes.push(...selectionNote(sel, slot, i));
    return buildItem(slot, sel, ctx, notes, i);
  });
  return {
    block: {
      type: 'group',
      style: picks.length === 2 ? tpl.style : 'circuit',
      items,
      rounds,
      restBetweenItemsSec: tpl.restBetweenItemsSec ?? 0,
      restAfterRoundSec: rest,
    },
    priority,
    role: first.slot.role,
    included: priority < 3,
    ...(keeps(tpl, ctx) ? { keep: true } : {}),
    notes,
    muscles: picks.map(({ sel }) => sel.exercise.primaryMuscles),
    ...touches(
      picks.map(({ sel }) => sel.exercise),
      ctx,
    ),
  };
};

/**
 * Two lighter sets of a session's first lift when it is a loaded compound and nothing in the
 * warm-up already rehearses its movement pattern: 50 % × 10 then 75 % × 5, snapped to owned
 * weights. Their slots are `ramp-1`, `ramp-2`.
 */
export const rampUpBlocks = (
  exercise: Exercise,
  setup: readonly EquipmentRequirement[],
  working: number,
  warmupPatterns: readonly (MovementPattern | undefined)[],
  equipment: EquipmentInventory,
): Block[] => {
  if (!exercise.tags.includes('compound')) return [];
  if (warmupPatterns.includes(exercise.pattern)) return [];
  if (working < MIN_RAMP_WORKING_KG) return [];
  const sets: { fraction: number; reps: number; rest: number }[] = [
    { fraction: 0.5, reps: 10, rest: 30 },
    { fraction: 0.75, reps: 5, rest: 60 },
  ];
  const blocks: Block[] = [];
  let previous: number | undefined;
  for (const { fraction, reps, rest } of sets) {
    const kg = rampLoad(setup, working, fraction, equipment);
    if (kg === undefined || kg >= working || kg === previous) continue;
    previous = kg;
    blocks.push({
      type: 'straight',
      item: {
        slot: `ramp-${blocks.length + 1}`,
        exerciseId: exercise.id,
        target: { kind: 'reps', min: reps, max: reps },
        load: { kind: 'kg', kg },
      },
      sets: 1,
      restSec: rest,
    });
  }
  return blocks;
};

/** The ramp-up sets of the session being built, as {@link rampUpBlocks} defines them. */
const rampUp = (built: BuiltSession, ctx: Context): BuiltBlock[] => {
  const first = built.main[0]?.block;
  const setup = built.main[0]?.setup;
  if (!first || !setup || first.type !== 'straight' || first.item.load?.kind !== 'kg') return [];
  const exercise = ctx.catalogue.get(first.item.exerciseId);
  if (!exercise) return [];
  const warmupPatterns = built.warmup.map((b) =>
    b.block.type === 'straight' ? ctx.catalogue.get(b.block.item.exerciseId)?.pattern : undefined,
  );
  const working = first.item.load.kg;
  const blocks: BuiltBlock[] = rampUpBlocks(
    exercise,
    setup,
    working,
    warmupPatterns,
    ctx.equipment,
  ).map((block) => ({
    block,
    priority: 1,
    role: 'warmup',
    included: true,
    ramp: true,
    muscles: [],
    notes: [
      {
        code: 'ramp-up',
        params: {
          exerciseId: exercise.id,
          kg: block.type === 'straight' && block.item.load?.kind === 'kg' ? block.item.load.kg : 0,
          workingKg: working,
        },
      },
    ],
  }));
  // When time is short the ramp-up shrinks to one set at about 60 % of the working load.
  const [lead, ...rest] = blocks;
  if (lead && rest.length > 0) {
    const last = blocks[blocks.length - 1]!.block;
    const kg = rampLoad(setup, working, COLLAPSED_RAMP_FRACTION, ctx.equipment);
    const usable = kg !== undefined && kg < working;
    const collapsedKg = usable
      ? kg
      : last.type === 'straight' && last.item.load?.kind === 'kg'
        ? last.item.load.kg
        : undefined;
    if (collapsedKg !== undefined)
      lead.collapseTo = {
        kg: collapsedKg,
        block: {
          type: 'straight',
          item: {
            slot: 'ramp-1',
            exerciseId: exercise.id,
            target: { kind: 'reps', min: 6, max: 6 },
            load: { kind: 'kg', kg: collapsedKg },
          },
          sets: 1,
          restSec: 45,
        },
      };
  }
  return blocks;
};

/** Finisher blocks that only serve conditioning are left out for muscle gain. */
const keepFinisher = (tpl: BlockTemplate, ctx: Context): boolean => {
  if (ctx.profile.goal !== 'muscle') return true;
  if (tpl.type === 'cardio') return false;
  if (tpl.type === 'group')
    return !tpl.slots.every((s) => s.role === 'conditioning' || s.role === 'core');
  return tpl.slot.role !== 'conditioning';
};

/** Cardio-day dose: easier and shorter for muscle gain, never longer than the budget. */
export const cardioDaySpec = (spec: CardioSpec, ctx: Context, budget: number): CardioSpec => {
  let result = spec;
  if (ctx.profile.goal === 'muscle')
    result = {
      minutes: [25, 30],
      ...(spec.speedKmh === undefined ? {} : { speedKmh: spec.speedKmh }),
      ...(spec.inclinePct === undefined ? {} : { inclinePct: Math.round(spec.inclinePct * 0.6) }),
    };
  const [min, max] = result.minutes;
  if (max > budget) result = { ...result, minutes: [Math.min(min, budget), budget] };
  return result;
};

/** Builds one session from a template: picks, doses, loads, ramp-up, then fits the time budget. */
export const buildSession = (
  tpl: SessionTemplate,
  ctx: Context,
  state: SelectionState,
  options: BuildOptions,
): Session | null => {
  state.session = new Set();
  state.warmup = new Set();
  state.moderate = new Map();
  state.warmupModerate = new Map();
  state.sessionId = options.id;
  // The user's own exercises that stay (whatever the constraints say) use up the budget first.
  for (const id of ctx.reserved?.get(options.id) ?? []) {
    const kept = ctx.catalogue.get(id);
    for (const region of ctx.constraints?.regions ?? [])
      if (kept?.joints[region] !== undefined)
        state.moderate.set(region, (state.moderate.get(region) ?? 0) + 1);
  }
  const dropped: PendingNote[] = [];
  const cardioDay = tpl.key === 'cardio';
  const place = options.cardioPlace ?? (cardioDay ? 'day' : 'finisher');

  const short = ctx.profile.sessionMinutes < SHORT_SESSION_MINUTES;
  const build = (blocks: readonly BlockTemplate[]) =>
    blocks
      .map((b) => (short && b.type === 'straight' && b.shortSlot ? { ...b, slot: b.shortSlot } : b))
      .map((b) =>
        place === 'day' && b.type === 'cardio'
          ? buildBlock(
              { ...b, cardio: cardioDaySpec(b.cardio, ctx, options.budget) },
              ctx,
              state,
              dropped,
              place,
            )
          : buildBlock(b, ctx, state, dropped, place),
      )
      .filter((b): b is BuiltBlock => b !== null);

  // Main first, so warm-up drills can repeat main exercises without stealing them.
  const main = build(tpl.main);
  if (options.minMainBlocks !== undefined && main.length < options.minMainBlocks) return null;
  const warmup = build(tpl.warmup);
  const finisherTemplates = tpl.finisher.filter((b) => keepFinisher(b, ctx));
  if (finisherTemplates.length < tpl.finisher.length)
    dropped.push({ code: 'finisher-skipped-goal', params: { goal: ctx.profile.goal } });
  // Conditioning is the point of a recomposition or fitness finisher: time cuts shorten it, never drop it.
  const finisher = build(
    ctx.profile.goal === 'muscle'
      ? finisherTemplates
      : finisherTemplates.map((b) => ({ ...b, keep: true })),
  );
  const built: BuiltSession = { warmup, main, finisher };
  built.warmup.push(...rampUp(built, ctx));
  const spared = dropped.flatMap((n) =>
    n.code === 'slot-limited' && n.params.cause === 'region'
      ? [n.params.region as JointRegion]
      : [],
  );

  // Beginners and returning trainees keep their lower volume even with time to spare.
  const maxSets = ctx.level === 'beginner' || ctx.level === 'returning' ? 4 : 5;
  const changes = cardioDay
    ? []
    : fitToBudget(built, options.budget, maxSets, {
        goal: ctx.profile.goal,
        ...(options.keepConditioning ? { keepConditioning: true } : {}),
        // Time freed by a slot left out for a joint goes to blocks that don't work that joint.
        ...(spared.length > 0 ? { spare: spared } : {}),
      });
  const session = materialise(built);

  let name = options.name;
  if (cardioDay) {
    const modality = built.main[0]?.notes[0]?.params.modality;
    const label =
      typeof modality === 'string'
        ? CARDIO_LABEL[modality as keyof typeof CARDIO_LABEL]
        : undefined;
    if (label) name = { fr: `${name.fr} — ${label.fr}`, en: `${name.en} — ${label.en}` };
  }

  // Notes get their final positions only now that the time fit has settled the blocks.
  const sessionId = options.id;
  for (const [section, blocks] of [
    ['warmup', built.warmup],
    ['main', built.main],
    ['finisher', built.finisher],
  ] as const) {
    blocks
      .filter((b) => b.included)
      .forEach((b, blockIndex) => {
        for (const n of b.notes)
          ctx.log.add(n.code, n.params, {
            sessionId,
            section,
            blockIndex,
            ...(n.itemIndex === undefined ? {} : { itemIndex: n.itemIndex }),
          });
      });
  }
  for (const n of dropped) ctx.log.add(n.code, n.params, { sessionId });
  for (const change of changes)
    ctx.log.add('time-fit', { ...change, budget: options.budget }, { sessionId });

  // Cardio and ramp-up items have no template slot: they get one from their position.
  return ensureSlots({
    id: sessionId,
    name,
    ...(tpl.focus ? { focus: tpl.focus } : {}),
    estimatedMinutes: sessionMinutes(session),
    ...session,
  });
};
