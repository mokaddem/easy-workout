import type { EquipmentInventory, EquipmentRequirement, Exercise } from '../../domain';
import { equipmentCapabilities, usableSetups } from '../equipment';
import { externalLoad, type LoadContext } from './loads';

/** Supplementary lifts that never carry a session: the renegade row is limited by the plank. */
export const NOT_MAIN_LIFT: readonly string[] = ['renegade-row'];

/**
 * A lift that can lead a session: a compound, not limited by something else, not a carry,
 * not a jump or a swing.
 */
export const isMainLift = (exercise: Exercise): boolean =>
  exercise.tags.includes('compound') &&
  !NOT_MAIN_LIFT.includes(exercise.id) &&
  exercise.pattern !== 'carry' &&
  !exercise.tags.includes('plyometric') &&
  !exercise.tags.includes('ballistic');

/**
 * Drills that are too easy to be work outside the warm-up: an unloaded good morning can't get
 * near its effort target, so it never takes a hinge slot.
 */
export const WARMUP_ONLY: readonly string[] = ['good-morning'];

/** Kipping-prone bar work that a door frame should not take. */
export const NOT_ON_DOORWAY_BAR: readonly string[] = ['toes-to-bar'];

/**
 * Why an exercise is a poor or unsafe pick for this person with what they own.
 * - `no-equipment`: nothing owned allows it.
 * - `doorway-bar`: kipping-prone bar work and the only bar is a doorway one.
 * - `selector-swing`: a swung move and the only dumbbells are selector ones (plates can come loose).
 * - `rope-beginner`: jump rope for a beginner.
 * - `no-fitting-load`: no owned weight is a sensible starting load.
 */
export type Concern =
  'no-equipment' | 'doorway-bar' | 'selector-swing' | 'rope-beginner' | 'no-fitting-load';

/** Concerns that make an exercise impossible or unsafe: never placed, never accepted. */
export const BLOCKING_CONCERNS: ReadonlySet<Concern> = new Set([
  'no-equipment',
  'doorway-bar',
  'selector-swing',
]);

const needsJumpRope = (setup: readonly EquipmentRequirement[]) =>
  setup.some((req) => req.kind === 'jump-rope');

export const onlyDoorwayBars = (inventory: EquipmentInventory) => {
  const bars = inventory.filter((item) => item.kind === 'pull-up-bar');
  return (
    bars.length > 0 && bars.every((bar) => bar.kind === 'pull-up-bar' && bar.mount === 'doorway')
  );
};

/** The setup uses dumbbells and every dumbbell owned is a selector set, which must not be swung. */
const needsSelectorDumbbells = (
  setup: readonly EquipmentRequirement[],
  inventory: EquipmentInventory,
) =>
  setup.some((req) => req.kind === 'dumbbell') &&
  inventory
    .filter((item) => item.kind === 'dumbbell')
    .every(
      (item) => item.kind === 'dumbbell' && 'mechanism' in item && item.mechanism === 'selector',
    );

/** Some owned weight is a sensible starting load for this person. */
const loadFits = (exercise: Exercise, setup: readonly EquipmentRequirement[], ctx: LoadContext) =>
  externalLoad(exercise, setup, ctx) !== undefined;

/** What is wrong with doing the exercise with this setup, if anything. Warm-up drills skip the load check. */
export function setupConcern(
  exercise: Exercise,
  setup: readonly EquipmentRequirement[],
  ctx: LoadContext,
  warmup = false,
): Concern | undefined {
  if (exercise.tags.includes('ballistic') && needsSelectorDumbbells(setup, ctx.inventory))
    return 'selector-swing';
  if (ctx.level === 'beginner' && needsJumpRope(setup)) return 'rope-beginner';
  if (!warmup && exercise.loadType === 'external' && !loadFits(exercise, setup, ctx))
    return 'no-fitting-load';
  return undefined;
}

/**
 * The best setup for an exercise and what is wrong with it: a setup without concern first,
 * then one with a mere warning; when every setup is blocked, the blocking concern alone.
 */
export function exerciseSafety(
  exercise: Exercise,
  ctx: LoadContext,
  warmup = false,
): { setup?: EquipmentRequirement[]; concern?: Concern } {
  const setups = usableSetups(exercise, equipmentCapabilities(ctx.inventory));
  if (setups.length === 0) return { concern: 'no-equipment' };
  if (NOT_ON_DOORWAY_BAR.includes(exercise.id) && onlyDoorwayBars(ctx.inventory))
    return { concern: 'doorway-bar' };
  const rated = setups.map((setup) => ({
    setup,
    concern: setupConcern(exercise, setup, ctx, warmup),
  }));
  const clean = rated.find((r) => !r.concern);
  if (clean) return { setup: clean.setup };
  const warned = rated.find((r) => r.concern && !BLOCKING_CONCERNS.has(r.concern));
  if (warned) return warned;
  return { concern: rated[0]!.concern! };
}

/** The exercise can be placed: something owned allows it and nothing makes it unsafe. */
export const isExerciseSafe = (exercise: Exercise, ctx: LoadContext, warmup = false): boolean => {
  const { concern } = exerciseSafety(exercise, ctx, warmup);
  return !concern || !BLOCKING_CONCERNS.has(concern);
};
