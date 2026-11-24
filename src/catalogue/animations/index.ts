import type { ExerciseAnimation } from '@/domain';
import { cardioAnimations } from './cardio';
import { coreAnimations } from './core';
import { legsAnimations } from './legs';
import { pullAnimations } from './pull';
import { pushAnimations } from './push';
import { stretchLowerAnimations } from './stretch-lower';
import { stretchUpperAnimations } from './stretch-upper';
import { warmupAnimations } from './warmup';

/** Animations by catalogue family; every key is an exercise id of that family. */
export const ANIMATION_FAMILIES = {
  push: pushAnimations,
  pull: pullAnimations,
  legs: legsAnimations,
  core: coreAnimations,
  cardio: cardioAnimations,
  warmup: { ...warmupAnimations, ...stretchLowerAnimations, ...stretchUpperAnimations },
} as const satisfies Record<string, Record<string, ExerciseAnimation>>;

export const animations: Readonly<Record<string, ExerciseAnimation>> = {
  ...pushAnimations,
  ...pullAnimations,
  ...legsAnimations,
  ...coreAnimations,
  ...cardioAnimations,
  ...warmupAnimations,
  ...stretchLowerAnimations,
  ...stretchUpperAnimations,
};

/** The animation of an exercise, if one has been authored. */
export const animationFor = (exerciseId: string): ExerciseAnimation | undefined =>
  Object.hasOwn(animations, exerciseId) ? animations[exerciseId] : undefined;
