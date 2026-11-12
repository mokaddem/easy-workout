import type { Block, EquipmentRequirement, GenerationNote } from '../../domain';
import { sessionSeconds } from '../duration';
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
/** Below this share of the budget, optional (priority 3) blocks are added. */
export const UNDER_TOLERANCE = 0.2;
/** Below this share of the budget, sets, rounds and finisher minutes are added too. */
export const EXPAND_BELOW = 0.75;
const MIN_FINISHER_MINUTES = 5;
const MAX_FINISHER_MINUTES = 20;
const MIN_MAIN_BLOCKS = 2;
const LIGHT_ROLES: readonly (SlotRole | 'cardio')[] = ['isolation', 'core', 'conditioning'];

type Reducer = (built: BuiltSession) => GenerationNote['params'] | null;

const isCardio = (b: BuiltBlock) => b.role === 'cardio';

const shortenCardioFinisher: Reducer = (built): GenerationNote['params'] | null => {
  for (const b of built.finisher) {
    if (!b.included || !isCardio(b) || b.block.type !== 'straight') continue;
    const target = b.block.item.target;
    if (target.kind === 'cardio' && target.maxMinutes > MIN_FINISHER_MINUTES) {
      const to = Math.max(MIN_FINISHER_MINUTES, target.maxMinutes - 5);
      b.block = {
        ...b.block,
        item: {
          ...b.block.item,
          target: { ...target, minMinutes: Math.min(target.minMinutes, to), maxMinutes: to },
        },
      };
      return { action: 'finisher-shortened', minutes: to };
    }
    if (target.kind === 'interval' && target.rounds > MIN_FINISHER_MINUTES) {
      const to = Math.max(MIN_FINISHER_MINUTES, target.rounds - 5);
      b.block = { ...b.block, item: { ...b.block.item, target: { ...target, rounds: to } } };
      return { action: 'finisher-shortened', rounds: to };
    }
  }
  return null;
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

const shortenRests: Reducer = (built) => {
  let changed = false;
  for (const b of built.main) {
    if (!b.included) continue;
    if (b.block.type === 'straight') {
      const floor = b.role === 'main' ? 60 : 30;
      if (b.block.restSec - 15 >= floor) {
        b.block = { ...b.block, restSec: b.block.restSec - 15 };
        changed = true;
      }
    } else if (b.block.restAfterRoundSec - 15 >= 30) {
      b.block = { ...b.block, restAfterRoundSec: b.block.restAfterRoundSec - 15 };
      changed = true;
    }
  }
  return changed ? { action: 'rests-shortened', seconds: 15 } : null;
};

const shortenWarmup: Reducer = (built) => {
  const kept = built.warmup.filter((b) => b.included);
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

/** Cheapest cut first. Conditioning goes late: for recomposition and fitness it is the point. */
const REDUCERS: readonly Reducer[] = [
  shortenCardioFinisher,
  dropOptional,
  trimLightVolume,
  shortenRests,
  shortenWarmup,
  dropFinisher,
  trimMainSets,
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
  upper: number,
  which: (b: BuiltBlock) => boolean,
  changes: GenerationNote['params'][],
) => {
  for (const b of [...built.main, ...built.finisher]) {
    if (b.included || !which(b)) continue;
    b.included = true;
    if (minutes(built) > upper) b.included = false;
    else changes.push({ action: 'block-added', exerciseIds: exerciseIds(b.block).join(',') });
  }
};

export const exerciseIds = (block: Block): string[] =>
  block.type === 'straight' ? [block.item.exerciseId] : block.items.map((i) => i.exerciseId);

/**
 * Fits a built session to the time budget. Under 80 % of it, optional (priority 3) blocks
 * are added while they fit; under 75 %, sets on main lifts, rounds on groups and finisher
 * minutes grow, a step at a time, up to `maxSets`. Over 110 %, cuts go from the cheapest to the most important
 * (see REDUCERS); blocks cut on the way are added back if later cuts made room.
 * Returns a note per change.
 */
export const fitToBudget = (
  built: BuiltSession,
  budgetMinutes: number,
  /** Most sets (or rounds) expansion may give one block. */
  maxSets = 5,
): GenerationNote['params'][] => {
  const changes: GenerationNote['params'][] = [];
  const upper = budgetMinutes * (1 + OVER_TOLERANCE);

  if (minutes(built) < budgetMinutes * (1 - UNDER_TOLERANCE))
    addBlocks(built, upper, (b) => b.priority === 3, changes);
  // Pass after pass, one set (or round, or 5 finisher minutes) per block, until it fills.
  let grew = true;
  while (grew && minutes(built) < budgetMinutes * EXPAND_BELOW) {
    grew = false;
    for (const { target, apply } of expansions(built, maxSets)) {
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

  const cut = new Set<BuiltBlock>();
  let guard = 200;
  while (minutes(built) > upper && guard-- > 0) {
    const before = new Set([...built.main, ...built.finisher].filter((b) => b.included));
    let change: GenerationNote['params'] | null = null;
    for (const reduce of REDUCERS) {
      change = reduce(built);
      if (change) break;
    }
    if (!change) break;
    changes.push(change);
    for (const b of before) if (!b.included) cut.add(b);
  }
  if (cut.size > 0 && minutes(built) < budgetMinutes * EXPAND_BELOW)
    addBlocks(built, upper, (b) => cut.has(b), changes);
  return changes;
};
