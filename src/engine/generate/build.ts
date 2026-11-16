import type { Block, LocalizedText, Session, SessionItem } from '../../domain';
import { sessionMinutes } from '../duration';
import { CARDIO_LABEL, resolveCardio } from './cardio';
import { groupRest, groupRounds, itemDose, straightRest, straightSets } from './dose';
import {
  fitToBudget,
  materialise,
  type BuiltBlock,
  type BuiltSession,
  type PendingNote,
} from './fit';
import { rampLoad, startingLoad } from './loads';
import { selectExercise, type Selection, type SelectionState } from './select';
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
  return notes;
};

const buildItem = (
  slot: SlotSpec,
  sel: Selection,
  ctx: Context,
  notes: PendingNote[],
  itemIndex?: number,
): SessionItem => {
  const dose = itemDose(slot, sel.exercise, sel.method, ctx.profile.goal, ctx.level);
  const load = startingLoad(
    sel.exercise,
    sel.setup,
    slot.role,
    { inventory: ctx.equipment, level: ctx.level, bodyweightKg: ctx.profile.bodyweightKg },
    (code, params) =>
      notes.push({ code, params, ...(itemIndex === undefined ? {} : { itemIndex }) }),
  );
  return { exerciseId: sel.exercise.id, ...dose, ...(load ? { load } : {}) };
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
    const choice = resolveCardio(tpl.cardio, place, ctx);
    if (!choice) {
      dropped.push({ code: 'cardio-unavailable', params: {} });
      return null;
    }
    return {
      block: choice.block,
      priority,
      role: 'cardio',
      included: priority < 3,
      ...(tpl.keep ? { keep: true } : {}),
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
      dropped.push({
        code: 'slot-dropped',
        params: { slot: tpl.slot.id, patterns: tpl.slot.patterns.join(',') },
      });
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
          sel.method,
        ),
      },
      priority,
      role: tpl.slot.role,
      included: priority < 3,
      ...(tpl.keep ? { keep: true } : {}),
      notes,
      setup: sel.setup,
      muscles: [sel.exercise.primaryMuscles],
    };
  }

  const picks: { slot: SlotSpec; sel: Selection }[] = [];
  for (const slot of tpl.slots) {
    const sel = selectExercise(slot, ctx, state);
    if (sel) picks.push({ slot, sel });
    else
      dropped.push({
        code: 'slot-dropped',
        params: { slot: slot.id, patterns: slot.patterns.join(',') },
      });
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
      ...(tpl.keep ? { keep: true } : {}),
      notes,
      muscles: [first.sel.exercise.primaryMuscles],
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
    ...(tpl.keep ? { keep: true } : {}),
    notes,
    muscles: picks.map(({ sel }) => sel.exercise.primaryMuscles),
  };
};

/**
 * Two lighter sets of the first lift when it is loaded and nothing in the warm-up
 * already rehearses its movement pattern.
 */
const rampUp = (built: BuiltSession, ctx: Context): BuiltBlock[] => {
  const first = built.main[0]?.block;
  const setup = built.main[0]?.setup;
  if (!first || !setup || first.type !== 'straight' || first.item.load?.kind !== 'kg') return [];
  const exercise = ctx.catalogue.get(first.item.exerciseId);
  if (!exercise || !exercise.tags.includes('compound')) return [];
  const warmupPatterns = built.warmup.map((b) =>
    b.block.type === 'straight' ? ctx.catalogue.get(b.block.item.exerciseId)?.pattern : undefined,
  );
  if (warmupPatterns.includes(exercise.pattern)) return [];

  const working = first.item.load.kg;
  if (working < MIN_RAMP_WORKING_KG) return [];
  const sets: { fraction: number; reps: number; rest: number }[] = [
    { fraction: 0.5, reps: 10, rest: 30 },
    { fraction: 0.75, reps: 5, rest: 60 },
  ];
  const blocks: BuiltBlock[] = [];
  let previous: number | undefined;
  for (const { fraction, reps, rest } of sets) {
    const kg = rampLoad(setup, working, fraction, ctx.equipment);
    if (kg === undefined || kg >= working || kg === previous) continue;
    previous = kg;
    const block: Block = {
      type: 'straight',
      item: {
        exerciseId: exercise.id,
        target: { kind: 'reps', min: reps, max: reps },
        load: { kind: 'kg', kg },
      },
      sets: 1,
      restSec: rest,
    };
    blocks.push({
      block,
      priority: 1,
      role: 'warmup',
      included: true,
      ramp: true,
      muscles: [],
      notes: [{ code: 'ramp-up', params: { exerciseId: exercise.id, kg, workingKg: working } }],
    });
  }
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
  const dropped: PendingNote[] = [];
  const cardioDay = tpl.key === 'cardio';
  const place = options.cardioPlace ?? (cardioDay ? 'day' : 'finisher');

  const build = (blocks: readonly BlockTemplate[]) =>
    blocks
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

  // Beginners and returning trainees keep their lower volume even with time to spare.
  const maxSets = ctx.level === 'beginner' || ctx.level === 'returning' ? 4 : 5;
  const changes = cardioDay
    ? []
    : fitToBudget(built, options.budget, maxSets, {
        goal: ctx.profile.goal,
        ...(options.keepConditioning ? { keepConditioning: true } : {}),
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

  return {
    id: sessionId,
    name,
    ...(tpl.focus ? { focus: tpl.focus } : {}),
    estimatedMinutes: sessionMinutes(session),
    ...session,
  };
};
