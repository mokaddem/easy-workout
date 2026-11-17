import type { Exercise, Muscle } from '../domain';

/** Muscle groups shown and checked week by week, with the primary muscles that count for each. */
export const MUSCLE_GROUPS = {
  chest: ['chest'],
  back: ['lats', 'upper-back'],
  shoulders: ['front-delts', 'side-delts', 'rear-delts'],
  arms: ['biceps', 'triceps'],
  core: ['abs', 'obliques'],
  quads: ['quads'],
  glutes: ['glutes'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
} as const satisfies Record<string, readonly Muscle[]>;

export type MuscleGroup = keyof typeof MUSCLE_GROUPS;
export const MUSCLE_GROUP_IDS = Object.keys(MUSCLE_GROUPS) as MuscleGroup[];

/** The groups a week should never leave with too little work. */
export const MAJOR_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'glutes',
  'hamstrings',
];

/**
 * Strength work for a muscle group: not walks or machines, not drills, not jumps, swings or
 * conditioning (they train the heart more than a muscle group's strength). Where the exercise
 * sits decides the rest: the warm-up never counts, a squat in the main part does.
 */
export const isStrengthWork = (exercise: Exercise): boolean =>
  exercise.pattern !== 'locomotion' &&
  exercise.pattern !== 'conditioning' &&
  !exercise.tags.includes('mobility') &&
  !exercise.tags.includes('plyometric') &&
  !exercise.tags.includes('ballistic');

/** Groups a set of this exercise counts for: those its primary muscles belong to. */
export const groupsOf = (exercise: Exercise): MuscleGroup[] =>
  MUSCLE_GROUP_IDS.filter((group) =>
    (MUSCLE_GROUPS[group] as readonly Muscle[]).some((m) => exercise.primaryMuscles.includes(m)),
  );
