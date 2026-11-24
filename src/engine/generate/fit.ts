import type { Block, EquipmentRequirement, GenerationNote, Goal, JointRegion } from '../../domain';
import { sessionSeconds } from '../duration';
import { SHORT_SESSION_MINUTES } from './templates';
import type { Priority, SlotRole } from './types';

export interface PendingNote {
  code: string;
  params: GenerationNote['params'];
  itemIndex?: number;
}

/** A block built from a template, before the time budget decides whether it stays. */
export interface BuiltBlock {
  block: Block;
  priority: Priority;
  /** Role of the straight slot, or of the first slot of a group. */
  role: SlotRole | 'cardio';
  included: boolean;
  /** Never dropped by the time fit. */
  keep?: boolean;
  notes: PendingNote[];
  /** Equipment used by a straight block's exercise. */
  setup?: EquipmentRequirement[];
  /** Primary muscles of each item, in item order. */
  muscles: string[][];
  /** Limited joints the block's exercises are graded on: growth goes elsewhere when one slot was left out for them. */
  touches?: JointRegion[];
  /** A ramp-up set before the first heavy lift: never cut on its own, only collapsed with its siblings. */
  ramp?: boolean;
  /** On the first ramp-up set: the single set that stands in for all of them when time is short. */
  collapseTo?: { block: Block; kg: number };
}

export interface BuiltSession {
  warmup: BuiltBlock[];
  main: BuiltBlock[];
  finisher: BuiltBlock[];
}

const included = (blocks: BuiltBlock[]) => blocks.filter((b) => b.included).map((b) => b.block);

export const materialise = (built: BuiltSession) => ({
  warmup: included(built.warmup),
  main: included(built.main),
  finisher: included(built.finisher),
});

const minutes = (built: BuiltSession) => sessionSeconds(materialise(built)) / 60;

/** The session may run this much over its budget before anything is trimmed. */
export const OVER_TOLERANCE = 0.1;
/** Below this share of the budget, sets, rounds and finisher minutes are added too. */
export const EXPAND_BELOW = 0.75;
const MIN_FINISHER_MINUTES = 5;
/** Recomposition and fitness finishers are conditioning work: shorter than this, they stop being it. */
/** Below this share of the budget, optional (priority 3) blocks are added. */
export const UNDER_TOLERANCE = 0.2;
const MIN_CONDITIONING_MINUTES = 10;
/** Shortest rest between sets, by goal: the bottom of its range. Compounds first, then light work. */
const REST_FLOOR_SEC: Record<Goal, { compound: number; light: number }> = {
  muscle: { compound: 90, light: 60 },
  recomposition: { compound: 60, light: 45 },
  'general-fitness': { compound: 45, light: 30 },
};
/** Longest rest the goal calls for: the top of its range. */
const REST_CEILING_SEC: Record<Goal, number> = {
  muscle: 120,
  recomposition: 90,
  'general-fitness': 75,
};
const MAX_FINISHER_MINUTES = 20;
const MIN_MAIN_BLOCKS = 2;
const LIGHT_ROLES: readonly (SlotRole | 'cardio')[] = ['isolation', 'core', 'conditioning'];

type Reducer = (built: BuiltSession) => GenerationNote['params'] | null;

const isCardio = (b: BuiltBlock) => b.role === 'cardio';

const finisherFloorMinutes = (goal: Goal, budgetMinutes: number) => {
  if (goal === 'muscle') return MIN_FINISHER_MINUTES;
  if (budgetMinutes >= SHORT_SESSION_MINUTES) return MIN_CONDITIONING_MINUTES;
  return Math.max(MIN_FINISHER_MINUTES, Math.round(budgetMinutes * 0.25));
};

const shortenCardioFinisher =
  (goal: Goal, budgetMinutes: number): Reducer =>
  (built): GenerationNote['params'] | null => {
    const floor = finisherFloorMinutes(goal, budgetMinutes);
    for (const b of built.finisher) {
      if (!b.included || !isCardio(b) || b.block.type !== 'straight') continue;
      const target = b.block.item.target;
      if (target.kind === 'cardio' && target.maxMinutes > floor) {
        const to = Math.max(floor, target.maxMinutes - 5);
        b.block = {
          ...b.block,
          item: {
            ...b.block.item,
            target: { ...target, minMinutes: Math.min(target.minMinutes, to), maxMinutes: to },
          },
        };
        return { action: 'finisher-shortened', minutes: to };
      }
      if (target.kind === 'interval') {
        const roundSec = target.workSec + target.recoverySec;
        const floorRounds = Math.max(1, Math.ceil((floor * 60) / Math.max(1, roundSec)));
        if (target.rounds > floorRounds) {
          const to = Math.max(floorRounds, target.rounds - 5);
          b.block = { ...b.block, item: { ...b.block.item, target: { ...target, rounds: to } } };
          return { action: 'finisher-shortened', rounds: to };
        }
      }
    }
    return null;
  };

/** Last resort for a conditioning finisher already at its shortest: it goes entirely. */
const dropCardioFinisher: Reducer = (built) => {
  const last = [...built.finisher].reverse().find((b) => b.included && isCardio(b));
  if (!last) return null;
  last.included = false;
  return { action: 'finisher-dropped', exerciseIds: exerciseIds(last.block).join(',') };
};

const dropOptional: Reducer = (built) => {
  for (const section of [built.finisher, built.main]) {
    for (let i = section.length - 1; i >= 0; i--) {
      const b = section[i]!;
      if (b.included && !b.keep && b.priority >= 2) {
        b.included = false;
        return { action: 'block-dropped', exerciseIds: exerciseIds(b.block).join(',') };
      }
    }
  }
  return null;
};

const dropFinisher: Reducer = (built) => {
  const last = [...built.finisher].reverse().find((b) => b.included && !b.keep);
  if (!last) return null;
  last.included = false;
  return { action: 'finisher-dropped', exerciseIds: exerciseIds(last.block).join(',') };
};

const trimLightVolume: Reducer = (built) => {
  for (const b of [...built.finisher, ...built.main].reverse()) {
    if (!b.included) continue;
    if (b.block.type === 'straight' && LIGHT_ROLES.includes(b.role) && b.block.sets > 2) {
      b.block = { ...b.block, sets: b.block.sets - 1 };
      return { action: 'sets-trimmed', exerciseIds: b.block.item.exerciseId };
    }
    if (b.block.type === 'group' && b.block.rounds > 2) {
      b.block = { ...b.block, rounds: b.block.rounds - 1 };
      return { action: 'rounds-trimmed', exerciseIds: exerciseIds(b.block).join(',') };
    }
  }
  return null;
};

const restFloor = (goal: Goal, role: BuiltBlock['role']) =>
  role === 'main' || role === 'secondary'
    ? REST_FLOOR_SEC[goal].compound
    : REST_FLOOR_SEC[goal].light;

/** Rests above the top of the goal's range come down to it. */
const capRests =
  (goal: Goal): Reducer =>
  (built) => {
    const ceiling = REST_CEILING_SEC[goal];
    let largest = 0;
    for (const b of built.main) {
      if (!b.included) continue;
      if (b.block.type === 'straight' && b.block.restSec > ceiling) {
        largest = Math.max(largest, b.block.restSec - ceiling);
        b.block = { ...b.block, restSec: ceiling };
      } else if (b.block.type === 'group' && b.block.restAfterRoundSec > ceiling) {
        largest = Math.max(largest, b.block.restAfterRoundSec - ceiling);
        b.block = { ...b.block, restAfterRoundSec: ceiling };
      }
    }
    return largest > 0 ? { action: 'rests-shortened', seconds: largest } : null;
  };

const shortenRests =
  (goal: Goal): Reducer =>
  (built) => {
    let changed = false;
    for (const b of built.main) {
      if (!b.included) continue;
      const floor = restFloor(goal, b.role);
      if (b.block.type === 'straight') {
        if (b.block.restSec - 15 >= floor) {
          b.block = { ...b.block, restSec: b.block.restSec - 15 };
          changed = true;
        }
      } else if (b.block.restAfterRoundSec - 15 >= floor) {
        b.block = { ...b.block, restAfterRoundSec: b.block.restAfterRoundSec - 15 };
        changed = true;
      }
    }
    return changed ? { action: 'rests-shortened', seconds: 15 } : null;
  };

const shortenWarmup: Reducer = (built) => {
  const kept = built.warmup.filter((b) => b.included && !b.ramp);
  for (const b of kept)
    if (b.block.type === 'straight' && b.block.sets > 1) {
      b.block = { ...b.block, sets: 1 };
      return { action: 'warmup-shortened' };
    }
  if (kept.length > 2) {
    kept[kept.length - 1]!.included = false;
    return { action: 'warmup-shortened' };
  }
  return null;
};

/** Several ramp-up sets become one lighter set; the ramp-up is never removed. */
const collapseRamp: Reducer = (built) => {
  const ramps = built.warmup.filter((b) => b.included && b.ramp);
  const first = ramps[0];
  if (!first || ramps.length < 2 || !first.collapseTo) return null;
  const { block, kg } = first.collapseTo;
  first.block = block;
  first.notes = first.notes.map((n) =>
    n.code === 'ramp-up' ? { ...n, params: { ...n.params, kg } } : n,
  );
  for (const b of ramps.slice(1)) b.included = false;
  return { action: 'warmup-shortened' };
};

const trimMainSets: Reducer = (built) => {
  for (const b of [...built.main].reverse()) {
    if (b.included && b.block.type === 'straight' && b.block.sets > 2) {
      b.block = { ...b.block, sets: b.block.sets - 1 };
      return { action: 'sets-trimmed', exerciseIds: b.block.item.exerciseId };
    }
  }
  return null;
};

const dropMainTail: Reducer = (built) => {
  const kept = built.main.filter((b) => b.included);
  if (kept.length <= MIN_MAIN_BLOCKS) return null;
  const last = [...kept].reverse().find((b) => !b.keep);
  if (!last) return null;
  last.included = false;
  return { action: 'block-dropped', exerciseIds: exerciseIds(last.block).join(',') };
};

/**
 * Cheapest cut first. Rests stay at the bottom of the goal's range and the ramp-up stays.
 * The conditioning finisher shrinks towards its floor before accessories go, but is only
 * dropped late, after volume has been trimmed.
 */
const reducersFor = (
  goal: Goal,
  budgetMinutes: number,
  keepConditioning: boolean,
): readonly Reducer[] => [
  capRests(goal),
  shortenCardioFinisher(goal, budgetMinutes),
  dropOptional,
  trimLightVolume,
  shortenRests(goal),
  shortenWarmup,
  collapseRamp,
  dropFinisher,
  trimMainSets,
  ...(keepConditioning ? [] : [dropCardioFinisher]),
  dropMainTail,
];

/** Hard sets one muscle may get in a session through expansion; beyond it, more is not better. */
export const MUSCLE_SESSION_CEILING = 10;
/** Main blocks the volume phase adds a set to. */
const VOLUME_PHASE_BLOCKS = 2;

/** The volume phase adds a set to the first main blocks later, so expansion leaves room for it. */
const capFor = (built: BuiltSession, b: BuiltBlock, maxSets: number) =>
  built.main.filter((x) => x.included).indexOf(b) < VOLUME_PHASE_BLOCKS ? maxSets - 1 : maxSets;

const setsPerMuscle = (built: BuiltSession): Map<string, number> => {
  const sets = new Map<string, number>();
  for (const b of built.main) {
    if (!b.included) continue;
    const n = b.block.type === 'straight' ? b.block.sets : b.block.rounds;
    for (const muscles of b.muscles) for (const m of muscles) sets.set(m, (sets.get(m) ?? 0) + n);
  }
  return sets;
};

/** One more set or round of this block would push one of its muscles past the ceiling. */
const overMuscleCeiling = (built: BuiltSession, b: BuiltBlock) => {
  const sets = setsPerMuscle(built);
  return b.muscles.some((muscles) =>
    muscles.some((m) => (sets.get(m) ?? 0) + 1 > MUSCLE_SESSION_CEILING),
  );
};

interface Expansion {
  target: BuiltBlock;
  /** Changes the target block; null when it can't grow any further. */
  apply: () => GenerationNote['params'] | null;
}

/** Each expansion step: one more set of a main lift, one more round, or a longer finisher. */
const expansions = (built: BuiltSession, maxSets: number): Expansion[] => [
  ...built.main
    .filter(
      (b) =>
        b.included && b.block.type === 'straight' && (b.role === 'main' || b.role === 'secondary'),
    )
    .map((b) => ({
      target: b,
      apply: () => {
        if (b.block.type !== 'straight' || b.block.sets >= capFor(built, b, maxSets)) return null;
        if (overMuscleCeiling(built, b)) return null;
        b.block = { ...b.block, sets: b.block.sets + 1 };
        return { action: 'set-added', exerciseIds: b.block.item.exerciseId };
      },
    })),
  ...built.main
    .filter((b) => b.included && b.block.type === 'group')
    .map((b) => ({
      target: b,
      apply: () => {
        if (b.block.type !== 'group' || b.block.rounds >= capFor(built, b, maxSets)) return null;
        if (overMuscleCeiling(built, b)) return null;
        b.block = { ...b.block, rounds: b.block.rounds + 1 };
        return { action: 'round-added', exerciseIds: exerciseIds(b.block).join(',') };
      },
    })),
  ...built.finisher
    .filter((b) => b.included && isCardio(b))
    .map((b) => ({
      target: b,
      apply: () => {
        if (b.block.type !== 'straight' || b.block.item.target.kind !== 'cardio') return null;
        const target = b.block.item.target;
        if (target.maxMinutes >= MAX_FINISHER_MINUTES) return null;
        const to = Math.min(MAX_FINISHER_MINUTES, target.maxMinutes + 5);
        b.block = {
          ...b.block,
          item: { ...b.block.item, target: { ...target, minMinutes: to, maxMinutes: to } },
        };
        return { action: 'finisher-lengthened', minutes: to };
      },
    })),
];

/** Adds left-out blocks, in template order, while each still fits. */
const addBlocks = (
  built: BuiltSession,
  limit: number,
  which: (b: BuiltBlock) => boolean,
  changes: GenerationNote['params'][],
) => {
  for (const b of [...built.main, ...built.finisher]) {
    if (b.included || !which(b)) continue;
    b.included = true;
    if (minutes(built) > limit) b.included = false;
    else changes.push({ action: 'block-added', exerciseIds: exerciseIds(b.block).join(',') });
  }
};

export const exerciseIds = (block: Block): string[] =>
  block.type === 'straight' ? [block.item.exerciseId] : block.items.map((i) => i.exerciseId);

/**
 * Fits a built session to the time budget. Under 80 % of it, optional (priority 3) blocks are
 * added while they fit the budget; under 75 % of it, sets on main lifts, rounds on groups and finisher
 * minutes grow, a step at a time, up to `maxSets`. Over 110 %, cuts go from the cheapest to the
 * most important (see reducersFor); blocks cut on the way are added back when they fit the budget.
 * Returns a note per change.
 */
export const fitToBudget = (
  built: BuiltSession,
  budgetMinutes: number,
  /** Most sets (or rounds) expansion may give one block. */
  maxSets = 5,
  /** The goal sets rest floors and ceilings; `keepConditioning` stops the cardio finisher from being dropped. */
  {
    goal = 'recomposition',
    keepConditioning = false,
    spare = [],
  }: { goal?: Goal; keepConditioning?: boolean; spare?: readonly JointRegion[] } = {},
): GenerationNote['params'][] => {
  const changes: GenerationNote['params'][] = [];
  const upper = budgetMinutes * (1 + OVER_TOLERANCE);

  if (minutes(built) < budgetMinutes * (1 - UNDER_TOLERANCE))
    addBlocks(built, budgetMinutes, (b) => b.priority === 3, changes);
  // Pass after pass, one set (or round, or 5 finisher minutes) per block, until it fills.
  let grew = true;
  while (grew && minutes(built) < budgetMinutes * EXPAND_BELOW) {
    grew = false;
    for (const { target, apply } of expansions(built, maxSets)) {
      if (target.touches?.some((r) => spare.includes(r))) continue;
      if (minutes(built) >= budgetMinutes * EXPAND_BELOW) break;
      const previous = target.block;
      const change = apply();
      if (!change) continue;
      if (minutes(built) > upper) target.block = previous;
      else {
        changes.push(change);
        grew = true;
      }
    }
  }

  const reducers = reducersFor(goal, budgetMinutes, keepConditioning);
  const cut = new Set<BuiltBlock>();
  let guard = 200;
  while (minutes(built) > upper && guard-- > 0) {
    const before = new Set([...built.main, ...built.finisher].filter((b) => b.included));
    let change: GenerationNote['params'] | null = null;
    for (const reduce of reducers) {
      change = reduce(built);
      if (change) break;
    }
    if (!change) break;
    changes.push(change);
    for (const b of before) if (!b.included) cut.add(b);
  }
  if (cut.size > 0) addBlocks(built, budgetMinutes, (b) => cut.has(b), changes);
  return changes;
};
