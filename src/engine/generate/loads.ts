import {
  BAND_LEVELS,
  type BandLevel,
  type EquipmentInventory,
  type EquipmentRequirement,
  type Exercise,
  type Level,
  type GenerationNote,
  type Load,
} from '../../domain';
import type { SlotRole } from './types';

/** Used when the profile has no bodyweight. */
export const DEFAULT_BODYWEIGHT_KG = 70;

/** Starting load relative to the intermediate one. Week 1 runs at RIR 3, so it errs light. */
const LEVEL_FACTOR: Record<Level, number> = {
  beginner: 0.6,
  returning: 0.75,
  intermediate: 1,
  advanced: 1.4,
};

/** Exercises limited by something other than the pulling or pressing muscles. */
const SPECIAL_RATIOS: Readonly<Record<string, number>> = {
  /** Limited by holding the plank: about half a one-arm row. */
  'renegade-row': 0.1,
};

/**
 * Starting load per implement as a fraction of bodyweight, for an intermediate trainee.
 * `count` is how many implements the exercise uses (1 = one dumbbell or kettlebell).
 */
export const loadRatio = (exercise: Exercise, count: 1 | 2): number => {
  const special = SPECIAL_RATIOS[exercise.id];
  if (special !== undefined) return special;
  const isolation = exercise.tags.includes('isolation');
  switch (exercise.pattern) {
    case 'push-horizontal':
      return 0.15;
    case 'push-vertical':
      return exercise.unilateral || count === 1 ? 0.08 : 0.13;
    case 'pull-horizontal':
      return isolation ? 0.06 : exercise.unilateral ? 0.2 : 0.14;
    case 'elbow-flexion':
      return 0.12;
    case 'chest-isolation':
    case 'shoulder-isolation':
      return 0.06;
    case 'elbow-extension':
      return exercise.unilateral ? 0.06 : count === 1 ? 0.12 : 0.07;
    case 'squat':
      return count === 1 ? 0.2 : 0.14;
    case 'hinge':
      return count === 2 ? 0.24 : exercise.unilateral ? 0.16 : 0.2;
    case 'lunge':
      return 0.1;
    case 'hip-extension':
      return 0.25;
    case 'calf-raise':
      return 0.15;
    case 'shrug':
      return 0.26;
    case 'carry':
      return exercise.unilateral ? 0.2 : 0.25;
    case 'conditioning':
      return exercise.unilateral ? 0.12 : 0.08;
    case 'core-anti-lateral':
      return exercise.tags.includes('compound') ? 0.08 : 0.15;
    default:
      return 0.08;
  }
};

const roundKg = (kg: number) => Math.round(kg * 100) / 100;

/** Weights the user can hold `count` of at once, from every item of that kind. */
export const ownedWeights = (
  inventory: EquipmentInventory,
  kind: 'dumbbell' | 'kettlebell',
  count: 1 | 2,
): number[] => {
  const perKg = new Map<number, number>();
  const add = (kg: number, n: number) => perKg.set(roundKg(kg), (perKg.get(roundKg(kg)) ?? 0) + n);
  for (const item of inventory) {
    if (item.kind !== kind) continue;
    if ('weights' in item) {
      for (const piece of item.weights) add(piece.kg, piece.count);
    } else if (item.kind === 'dumbbell') {
      const steps = Math.floor((item.maxKg - item.minKg) / item.incrementKg + 1e-9);
      for (let i = 0; i <= steps; i++) add(item.minKg + i * item.incrementKg, item.count);
    }
  }
  return [...perKg.entries()]
    .filter(([, n]) => n >= count)
    .map(([kg]) => kg)
    .sort((a, b) => a - b);
};

/** Owned weights may undershoot the target down to this share: lighter is not training. */
export const MIN_LOAD_SHARE = 0.6;
/** Rounding up to the next owned weight is fine within this share of the target. */
const ROUND_UP_SHARE = 1.1;
/** Owned weights may overshoot the target up to this share for week 1 at RIR 3. */
export const MAX_LOAD_SHARE = 1.5;

/**
 * The owned weight to start with: the heaviest within 10 % above the target, else the
 * lightest if it is not more than 50 % over. Undefined when nothing owned fits.
 */
export const fitWeight = (weights: readonly number[], targetKg: number): number | undefined => {
  let best: number | undefined;
  for (const kg of weights) if (kg <= targetKg * ROUND_UP_SHARE + 1e-9) best = kg;
  if (best === undefined) {
    const lightest = weights[0];
    return lightest !== undefined && lightest <= targetKg * MAX_LOAD_SHARE ? lightest : undefined;
  }
  return best >= targetKg * MIN_LOAD_SHARE ? best : undefined;
};

/** Target and owned starting weight for an external-load exercise done with this setup. */
export const externalLoad = (
  exercise: Exercise,
  setup: readonly EquipmentRequirement[],
  ctx: LoadContext,
): { kg: number; target: number } | undefined => {
  const req = setup.find((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell');
  if (!req) return undefined;
  const count = req.count ?? 1;
  const weights = ownedWeights(ctx.inventory, req.kind as 'dumbbell' | 'kettlebell', count);
  const target =
    loadRatio(exercise, count) *
    LEVEL_FACTOR[ctx.level] *
    (ctx.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG);
  const kg = fitWeight(weights, target);
  return kg === undefined ? undefined : { kg, target };
};

/** Heaviest owned weight not above the target; the lightest one when all are heavier. */
export const snapDown = (weights: readonly number[], targetKg: number): number | undefined => {
  let best: number | undefined;
  for (const kg of weights) if (kg <= targetKg + 1e-9) best = kg;
  return best ?? weights[0];
};

const ownedBandLevels = (
  inventory: EquipmentInventory,
  kind: 'band' | 'mini-band',
): BandLevel[] => {
  const levels = new Set<BandLevel>();
  for (const item of inventory)
    if (item.kind === kind) for (const level of item.levels) levels.add(level);
  return BAND_LEVELS.filter((level) => levels.has(level));
};

/** Position in the owned bands, 0 = lightest, 1 = heaviest. */
const BAND_POSITION: Record<Level, number> = {
  beginner: 0,
  returning: 0.25,
  intermediate: 0.5,
  advanced: 0.75,
};

export interface LoadContext {
  inventory: EquipmentInventory;
  level: Level;
  bodyweightKg?: number;
}

export type NoteSink = (code: string, params: GenerationNote['params']) => void;

/**
 * Suggested load for the first session. External loads come from bodyweight ratios snapped
 * down to owned weights; bands from the owned levels; loadable bodyweight moves start unloaded.
 */
export const startingLoad = (
  exercise: Exercise,
  setup: readonly EquipmentRequirement[],
  role: SlotRole,
  ctx: LoadContext,
  note: NoteSink,
): Load | undefined => {
  switch (exercise.loadType) {
    case 'bodyweight-loadable':
      if (role !== 'warmup') note('load-unloaded-start', { exerciseId: exercise.id });
      return { kind: 'bodyweight' };
    case 'band':
    case 'band-assisted': {
      const req = setup.find((r) => r.kind === 'band' || r.kind === 'mini-band');
      if (!req) return undefined;
      const levels = ownedBandLevels(ctx.inventory, req.kind as 'band' | 'mini-band');
      if (levels.length === 0) return undefined;
      let position =
        role === 'warmup'
          ? 0
          : Math.max(0, BAND_POSITION[ctx.level] - (role === 'isolation' ? 0.25 : 0));
      if (exercise.loadType === 'band-assisted') position = 1 - BAND_POSITION[ctx.level];
      // Between two bands, take the lighter one: a band that's too heavy ruins the form.
      const level = levels[Math.floor(position * (levels.length - 1) + 0.25)] ?? levels[0]!;
      if (role !== 'warmup') note('load-band', { exerciseId: exercise.id, level });
      return { kind: 'band', level };
    }
    case 'external': {
      const fit = externalLoad(exercise, setup, ctx);
      if (!fit) return undefined;
      const { kg, target } = fit;
      const bodyweightKg = ctx.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
      if (role !== 'warmup')
        note('load-start', {
          exerciseId: exercise.id,
          kg,
          targetKg: roundKg(target),
          bodyweightKg,
          bodyweightAssumed: ctx.bodyweightKg === undefined,
        });
      return { kind: 'kg', kg };
    }
    default:
      return undefined;
  }
};

/** A lighter version of an external load for ramp-up sets, snapped to owned weights. */
export const rampLoad = (
  setup: readonly EquipmentRequirement[],
  workingKg: number,
  fraction: number,
  inventory: EquipmentInventory,
): number | undefined => {
  const req = setup.find((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell');
  if (!req) return undefined;
  const weights = ownedWeights(inventory, req.kind as 'dumbbell' | 'kettlebell', req.count ?? 1);
  return snapDown(weights, workingKg * fraction);
};
