import type { Exercise, MovementPattern } from '../domain';
import { cardioExercises } from './cardio';
import { coreExercises } from './core';
import { legsExercises } from './legs';
import { pullExercises } from './pull';
import { pushExercises } from './push';
import { stretchLowerExercises } from './stretch-lower';
import { stretchUpperExercises } from './stretch-upper';
import { warmupExercises } from './warmup';

export const CATALOGUE_FAMILIES = {
  push: pushExercises,
  pull: pullExercises,
  legs: legsExercises,
  core: coreExercises,
  cardio: cardioExercises,
  /** Warm-up drills, then the static stretches that end a session. */
  warmup: [...warmupExercises, ...stretchLowerExercises, ...stretchUpperExercises],
} as const satisfies Record<string, readonly Exercise[]>;

export type CatalogueFamily = keyof typeof CATALOGUE_FAMILIES;

/** Each movement pattern belongs to exactly one family, so every exercise has one obvious home. */
export const FAMILY_PATTERNS = {
  push: [
    'push-horizontal',
    'push-vertical',
    'chest-isolation',
    'elbow-extension',
    'shoulder-isolation',
  ],
  pull: ['pull-horizontal', 'pull-vertical', 'elbow-flexion', 'shrug'],
  legs: ['squat', 'hinge', 'lunge', 'hip-extension', 'hip-abduction', 'knee-flexion', 'calf-raise'],
  core: [
    'core-anti-extension',
    'core-anti-lateral',
    'core-flexion',
    'core-rotation',
    'spinal-extension',
    'carry',
  ],
  cardio: ['locomotion', 'conditioning'],
  warmup: ['mobility'],
} as const satisfies Record<CatalogueFamily, readonly MovementPattern[]>;

export const catalogue: readonly Exercise[] = Object.values(CATALOGUE_FAMILIES).flat();

export const exerciseById: ReadonlyMap<string, Exercise> = new Map(catalogue.map((e) => [e.id, e]));
