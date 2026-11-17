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
import {
  NOT_MAIN_LIFT,
  NOT_ON_DOORWAY_BAR,
  onlyDoorwayBars,
  setupConcern,
  WARMUP_ONLY,
} from './safety';
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
  /** The session being built. */
  sessionId?: string;
}

export const newSelectionState = (): SelectionState => ({
  session: new Set(),
  warmup: new Set(),
  programme: new Set(),
});

/** Slots a regeneration seed may vary. Main and secondary lifts stay put. */
const VARIABLE_ROLES: readonly SlotRole[] = ['accessory', 'isolation', 'core', 'conditioning'];

export type SelectionMethod =
  'preferred' | 'kept' | 'easier-variant' | 'ranked' | 'fallback-pattern';

export interface Selection {
  exercise: Exercise;
  /** The equipment alternative the exercise will be done with. */
  setup: EquipmentRequirement[];
  method: SelectionMethod;
  /** The exercise the choice was derived from (easier/harder variants). */
  from?: string;
  /** Set when an advanced trainee was moved one step up a bodyweight chain. */
  harderFrom?: string;
  /** Set when the exercise replaces one that reached the end of its ladder last cycle. */
  upgradedFrom?: string;
  /** A kept pick from a neighbouring pattern: dosed as a fallback. */
  fallback?: boolean;
  /** The slot's first choice, when the equipment ruled it out, and what it lacked. */
  instead?: { id: string; missing: string[] };
}

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
  if (slot.role !== 'warmup' && WARMUP_ONLY.includes(exercise.id)) return null;
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
  if (NOT_ON_DOORWAY_BAR.includes(exercise.id) && onlyDoorwayBars(ctx.equipment)) return null;
  const used = slot.role === 'warmup' ? state.warmup : state.session;
  if (used.has(exercise.id)) return null;
  const loadCtx = {
    inventory: ctx.equipment,
    level: ctx.level,
    ...(ctx.profile.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
  };
  const setups = usableSetups(exercise, capabilities).filter(
    (setup) => !setupConcern(exercise, setup, loadCtx, slot.role === 'warmup'),
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

const jumps = (e: Exercise) => e.tags.includes('plyometric') || e.tags.includes('ballistic');

/** No more than one difficulty step above last cycle's exercise, and no jumps where there were none. */
const withinStep = (next: Exercise, was: Exercise): boolean =>
  next.difficulty <= was.difficulty + 1 && (!jumps(next) || jumps(was));

/** A lift that ended its ladder last cycle moves to its harder variant, if the slot takes it. */
const upgraded = (
  picked: Selection,
  slot: SlotSpec,
  ctx: Context,
  capabilities: EquipmentCapabilities,
  state: SelectionState,
): Selection => {
  if (slot.role === 'warmup') return picked;
  const id = ctx.upgrades.get(picked.exercise.id);
  const candidate = id ? ctx.catalogue.get(id) : undefined;
  if (!candidate) return picked;
  // The variant does the same job as the pick, which may have come from a fallback pattern.
  const patterns = [...slot.patterns, ...(slot.fallbackPatterns ?? [])];
  const setup = eligible(candidate, slot, patterns, ctx, capabilities, state);
  return setup
    ? { ...picked, exercise: candidate, setup, upgradedFrom: picked.exercise.id }
    : picked;
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
  const last = state.sessionId ? ctx.lastCycle.get(`${state.sessionId}/${slot.id}`) : undefined;

  // A new cycle keeps its lifts: the previous pick stays while it still fits the slot.
  if (last && !VARIABLE_ROLES.includes(slot.role) && slot.role !== 'warmup') {
    const exercise = ctx.catalogue.get(last);
    const setup = exercise && eligible(exercise, slot, slot.patterns, ctx, capabilities, state);
    if (exercise && setup)
      return place({ exercise, setup, method: 'kept' }, slot, ctx, capabilities, state);
    // Last cycle's stand-in from a neighbouring pattern stays too, dosed as one.
    const fallback =
      exercise &&
      slot.fallbackPatterns &&
      eligible(exercise, slot, slot.fallbackPatterns, ctx, capabilities, state);
    if (exercise && fallback)
      return place(
        { exercise, setup: fallback, method: 'kept', fallback: true },
        slot,
        ctx,
        capabilities,
        state,
      );
  }

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
  // no lighter kind of load and not a regression of the first choice. A new cycle also moves
  // away from last cycle's exercise there, when such a peer exists.
  const avoided = last;
  if (picked && (ctx.seed !== 0 || avoided) && VARIABLE_ROLES.includes(slot.role)) {
    const loadRank = loadRankFor(slot.role);
    const first = picked.exercise;
    const regressions = easierClosure(first, ctx);
    const peers = preferred.filter(
      (p) =>
        p === picked ||
        (loadRank[p.exercise.loadType] <= loadRank[first.loadType] &&
          !regressions.has(p.exercise.id)),
    );
    // Neither last cycle's exercise nor one the user just outgrew comes back.
    const fresh = peers.filter(
      (p) => p.exercise.id !== avoided && !ctx.upgrades.has(p.exercise.id),
    );
    const pool = fresh.length > 0 ? fresh : peers;
    picked = pool[tieBreak(ctx.seed, slot.id) % pool.length] ?? picked;
  }
  // A new cycle (a new level too) moves an accessory one step at most from last cycle's.
  const was = last ? ctx.catalogue.get(last) : undefined;
  if (picked && was && VARIABLE_ROLES.includes(slot.role) && !withinStep(picked.exercise, was)) {
    const near = preferred.filter(
      (p) => withinStep(p.exercise, was) && !ctx.upgrades.has(p.exercise.id),
    );
    const other = near.filter((p) => p.exercise.id !== was.id);
    const pool = other.length > 0 ? other : near;
    const setup = eligible(was, slot, slot.patterns, ctx, capabilities, state);
    picked =
      pool[tieBreak(ctx.seed, slot.id) % Math.max(1, pool.length)] ??
      (setup ? { exercise: was, setup, method: 'kept' } : picked);
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

  return place(harderStep(picked, slot, ctx, capabilities, state), slot, ctx, capabilities, state);
};

/** Applies a pending upgrade to the pick and marks it used. */
const place = (
  pick: Selection,
  slot: SlotSpec,
  ctx: Context,
  capabilities: EquipmentCapabilities,
  state: SelectionState,
): Selection => {
  const picked = upgraded(pick, slot, ctx, capabilities, state);
  const used = slot.role === 'warmup' ? state.warmup : state.session;
  used.add(picked.exercise.id);
  if (slot.role !== 'warmup') state.programme.add(picked.exercise.id);
  return picked;
};
