import type {
  EquipmentRequirement,
  Exercise,
  Level,
  LoadType,
  MovementPattern,
} from '../../domain';
import {
  equipmentCapabilities,
  missingKinds,
  usableSetups,
  type EquipmentCapabilities,
} from '../equipment';
import { tieBreak } from './hash';
import { externalLoad } from './loads';
import type { Context, SlotRole, SlotSpec } from './types';

/** Hardest difficulty offered at each level. */
export const LEVEL_CAP: Record<Level, number> = {
  beginner: 2,
  returning: 4,
  intermediate: 4,
  advanced: 5,
};

/**
 * Returning trainees get intermediate loaded lifts, but their bodyweight strength comes
 * back slower: unloaded and assisted moves stop one step lower.
 */
export const levelCap = (level: Level, exercise: Exercise): number =>
  level === 'returning' && exercise.loadType !== 'external' ? 3 : LEVEL_CAP[level];

/** Supplementary lifts that never carry a session: the renegade row is limited by the plank. */
const NOT_MAIN_LIFT: readonly string[] = ['renegade-row'];

/** Kipping-prone bar work that a door frame should not take. */
const NOT_ON_DOORWAY_BAR: readonly string[] = ['toes-to-bar'];

/** Difficulty the generic ranking aims for at each level. */
const LEVEL_TARGET: Record<Level, number> = {
  beginner: 1,
  returning: 3,
  intermediate: 3,
  advanced: 4,
};

const LOAD_RANK: Record<'strength' | 'isolation' | 'core' | 'light', Record<LoadType, number>> = {
  strength: {
    external: 0,
    'bodyweight-loadable': 1,
    'band-assisted': 2,
    bodyweight: 3,
    band: 4,
    'cardio-machine': 9,
  },
  isolation: {
    external: 0,
    band: 1,
    'bodyweight-loadable': 2,
    bodyweight: 3,
    'band-assisted': 4,
    'cardio-machine': 9,
  },
  core: {
    bodyweight: 0,
    'bodyweight-loadable': 0,
    band: 1,
    external: 1,
    'band-assisted': 2,
    'cardio-machine': 9,
  },
  light: {
    bodyweight: 0,
    band: 1,
    'bodyweight-loadable': 1,
    external: 2,
    'band-assisted': 3,
    'cardio-machine': 9,
  },
};

const loadRankFor = (role: SlotRole) =>
  role === 'isolation'
    ? LOAD_RANK.isolation
    : role === 'core'
      ? LOAD_RANK.core
      : role === 'warmup' || role === 'conditioning'
        ? LOAD_RANK.light
        : LOAD_RANK.strength;

/** Exercises already placed, so a session never repeats one and a programme spreads its choices. */
export interface SelectionState {
  /** Main and finisher of the session being built. */
  session: Set<string>;
  /** Warm-up of the session being built. */
  warmup: Set<string>;
  /** Everything placed in earlier sessions of the programme. */
  programme: Set<string>;
}

export const newSelectionState = (): SelectionState => ({
  session: new Set(),
  warmup: new Set(),
  programme: new Set(),
});

/** Slots a regeneration seed may vary. Main and secondary lifts stay put. */
const VARIABLE_ROLES: readonly SlotRole[] = ['accessory', 'isolation', 'core', 'conditioning'];

export type SelectionMethod = 'preferred' | 'easier-variant' | 'ranked' | 'fallback-pattern';

export interface Selection {
  exercise: Exercise;
  /** The equipment alternative the exercise will be done with. */
  setup: EquipmentRequirement[];
  method: SelectionMethod;
  /** The exercise the choice was derived from (easier/harder variants). */
  from?: string;
  /** Set when an advanced trainee was moved one step up a bodyweight chain. */
  harderFrom?: string;
  /** The slot's first choice, when the equipment ruled it out, and what it lacked. */
  instead?: { id: string; missing: string[] };
}

const needsJumpRope = (setup: readonly EquipmentRequirement[]) =>
  setup.some((req) => req.kind === 'jump-rope');

const onlyDoorwayBars = (ctx: Context) => {
  const bars = ctx.equipment.filter((item) => item.kind === 'pull-up-bar');
  return (
    bars.length > 0 && bars.every((bar) => bar.kind === 'pull-up-bar' && bar.mount === 'doorway')
  );
};

/** The setup uses dumbbells and every dumbbell owned is a selector set, which must not be swung. */
const needsSelectorDumbbells = (setup: readonly EquipmentRequirement[], ctx: Context) =>
  setup.some((req) => req.kind === 'dumbbell') &&
  ctx.equipment
    .filter((item) => item.kind === 'dumbbell')
    .every(
      (item) => item.kind === 'dumbbell' && 'mechanism' in item && item.mechanism === 'selector',
    );

/** Some owned weight is a sensible starting load for this person. */
const loadFits = (exercise: Exercise, setup: readonly EquipmentRequirement[], ctx: Context) =>
  externalLoad(exercise, setup, {
    inventory: ctx.equipment,
    level: ctx.level,
    bodyweightKg: ctx.profile.bodyweightKg,
  }) !== undefined;

/** Hard filters: what a slot may never receive. */
const eligible = (
  exercise: Exercise,
  slot: SlotSpec,
  patterns: readonly MovementPattern[],
  ctx: Context,
  capabilities: EquipmentCapabilities,
  state: SelectionState,
): EquipmentRequirement[] | null => {
  if (!patterns.includes(exercise.pattern)) return null;
  if (slot.role !== 'warmup' && exercise.pattern === 'mobility') return null;
  if (slot.role === 'main' && !exercise.tags.includes('compound')) return null;
  if (slot.role === 'main' && NOT_MAIN_LIFT.includes(exercise.id)) return null;
  if (slot.tag && !exercise.tags.includes(slot.tag)) return null;
  if (exercise.metric === 'reps' ? !slot.reps : !slot.time) return null;
  if (exercise.difficulty > levelCap(ctx.level, exercise)) return null;
  if (
    slot.role !== 'warmup' &&
    slot.muscles &&
    !exercise.primaryMuscles.some((m) => slot.muscles?.includes(m))
  )
    return null;
  if (NOT_ON_DOORWAY_BAR.includes(exercise.id) && onlyDoorwayBars(ctx)) return null;
  const used = slot.role === 'warmup' ? state.warmup : state.session;
  if (used.has(exercise.id)) return null;
  const setups = usableSetups(exercise, capabilities).filter(
    (setup) =>
      (ctx.level !== 'beginner' || !needsJumpRope(setup)) &&
      (!exercise.tags.includes('ballistic') || !needsSelectorDumbbells(setup, ctx)) &&
      (slot.role === 'warmup' ||
        exercise.loadType !== 'external' ||
        loadFits(exercise, setup, ctx)),
  );
  return setups[0] ?? null;
};

type Ranked = { exercise: Exercise; setup: EquipmentRequirement[]; key: number[] };

const compareKeys = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

const rank = (
  slot: SlotSpec,
  patterns: readonly MovementPattern[],
  ctx: Context,
  capabilities: EquipmentCapabilities,
  state: SelectionState,
): Ranked | null => {
  const loadRank = loadRankFor(slot.role);
  const target = LEVEL_TARGET[ctx.level];
  const ranked: Ranked[] = [];
  for (const exercise of ctx.catalogue.values()) {
    const setup = eligible(exercise, slot, patterns, ctx, capabilities, state);
    if (!setup) continue;
    const muscleMiss =
      slot.muscles && !exercise.primaryMuscles.some((m) => slot.muscles?.includes(m)) ? 1 : 0;
    ranked.push({
      exercise,
      setup,
      key: [
        patterns.indexOf(exercise.pattern),
        muscleMiss,
        loadRank[exercise.loadType],
        Math.abs(exercise.difficulty - target),
        exercise.difficulty,
        state.programme.has(exercise.id) ? 1 : 0,
        tieBreak(ctx.seed, slot.id, exercise.id),
      ],
    });
  }
  ranked.sort((a, b) => compareKeys(a.key, b.key) || a.exercise.id.localeCompare(b.exercise.id));
  return ranked[0] ?? null;
};

/** Every exercise reachable through `easier` links: the regressions of an exercise. */
const easierClosure = (exercise: Exercise, ctx: Context): Set<string> => {
  const seen = new Set<string>();
  const queue = [...exercise.easier];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(ctx.catalogue.get(id)?.easier ?? []));
  }
  return seen;
};

/** Breadth-first walk down the `easier` links of the preferred exercises. */
const easierVariant = (
  slot: SlotSpec,
  ctx: Context,
  capabilities: EquipmentCapabilities,
  state: SelectionState,
): Selection | null => {
  for (const startId of slot.prefer ?? []) {
    const start = ctx.catalogue.get(startId);
    if (!start) continue;
    const seen = new Set([startId]);
    let frontier = [start];
    for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
      const next: Exercise[] = [];
      for (const ex of frontier) {
        for (const id of ex.easier) {
          if (seen.has(id)) continue;
          seen.add(id);
          const candidate = ctx.catalogue.get(id);
          if (!candidate) continue;
          const setup = eligible(candidate, slot, slot.patterns, ctx, capabilities, state);
          if (setup) return { exercise: candidate, setup, method: 'easier-variant', from: startId };
          next.push(candidate);
        }
      }
      frontier = next;
    }
  }
  return null;
};

/** Advanced trainees move one step up a plain-bodyweight chain when the next step fits the slot. */
const harderStep = (
  picked: Selection,
  slot: SlotSpec,
  ctx: Context,
  capabilities: EquipmentCapabilities,
  state: SelectionState,
): Selection => {
  if (ctx.level !== 'advanced' || slot.role === 'warmup') return picked;
  if (picked.exercise.loadType !== 'bodyweight') return picked;
  for (const id of picked.exercise.harder) {
    const candidate = ctx.catalogue.get(id);
    if (!candidate) continue;
    const setup = eligible(candidate, slot, slot.patterns, ctx, capabilities, state);
    if (setup) return { ...picked, exercise: candidate, setup, harderFrom: picked.exercise.id };
  }
  return picked;
};

/**
 * Picks the exercise for a slot: the first preferred exercise that fits, else an easier
 * variant of one, else the best-ranked candidate, else the best one from a neighbouring
 * pattern. Returns null when nothing fits; the caller drops the slot.
 */
export const selectExercise = (
  slot: SlotSpec,
  ctx: Context,
  state: SelectionState,
  capabilities: EquipmentCapabilities = equipmentCapabilities(ctx.equipment),
): Selection | null => {
  let picked: Selection | null = null;

  const preferred: Selection[] = [];
  for (const id of slot.prefer ?? []) {
    const exercise = ctx.catalogue.get(id);
    if (!exercise) continue;
    const setup = eligible(exercise, slot, slot.patterns, ctx, capabilities, state);
    if (setup) preferred.push({ exercise, setup, method: 'preferred' });
  }
  picked = preferred[0] ?? null;
  const firstChoice = slot.prefer?.[0] ? ctx.catalogue.get(slot.prefer[0]) : undefined;
  if (picked && firstChoice && picked.exercise.id !== firstChoice.id) {
    const missing = missingKinds(firstChoice, capabilities);
    if (missing.length > 0) picked = { ...picked, instead: { id: firstChoice.id, missing } };
  }
  // A seed varies only the slots where another preferred exercise does the job as well:
  // no lighter kind of load and not a regression of the first choice.
  if (picked && ctx.seed !== 0 && VARIABLE_ROLES.includes(slot.role)) {
    const loadRank = loadRankFor(slot.role);
    const first = picked.exercise;
    const regressions = easierClosure(first, ctx);
    const peers = preferred.filter(
      (p) =>
        p === picked ||
        (loadRank[p.exercise.loadType] <= loadRank[first.loadType] &&
          !regressions.has(p.exercise.id)),
    );
    picked = peers[tieBreak(ctx.seed, slot.id) % peers.length] ?? picked;
  }
  picked ??= easierVariant(slot, ctx, capabilities, state);
  if (!picked) {
    const best = rank(slot, slot.patterns, ctx, capabilities, state);
    if (best) picked = { exercise: best.exercise, setup: best.setup, method: 'ranked' };
  }
  if (!picked && slot.fallbackPatterns) {
    const best = rank(slot, slot.fallbackPatterns, ctx, capabilities, state);
    if (best) picked = { exercise: best.exercise, setup: best.setup, method: 'fallback-pattern' };
  }
  if (!picked) return null;

  picked = harderStep(picked, slot, ctx, capabilities, state);
  const used = slot.role === 'warmup' ? state.warmup : state.session;
  used.add(picked.exercise.id);
  if (slot.role !== 'warmup') state.programme.add(picked.exercise.id);
  return picked;
};
