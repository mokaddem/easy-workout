import { z } from 'zod';
import { int, LocalizedStepsSchema, LocalizedTextSchema, SlugSchema } from './common';
import { EquipmentRequirementSchema, type EquipmentKind } from './equipment';

export const MUSCLES = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'triceps',
  'biceps',
  'forearms',
  'traps',
  'upper-back',
  'lats',
  'lower-back',
  'abs',
  'obliques',
  'hip-flexors',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
] as const;
export const MuscleSchema = z.enum(MUSCLES);
export type Muscle = z.infer<typeof MuscleSchema>;

export const LOWER_BODY_MUSCLES: readonly Muscle[] = [
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
];

/** Primary slot classification used by the generator to build balanced sessions. */
export const MOVEMENT_PATTERNS = [
  'push-horizontal',
  'push-vertical',
  'pull-horizontal',
  'pull-vertical',
  'squat',
  'hinge',
  'lunge',
  'hip-extension',
  'hip-abduction',
  'knee-flexion',
  'calf-raise',
  'elbow-flexion',
  'elbow-extension',
  'chest-isolation',
  'shoulder-isolation',
  'shrug',
  'core-anti-extension',
  'core-anti-lateral',
  'core-flexion',
  /** Rotation and anti-rotation (resisting a twist). */
  'core-rotation',
  /** Lower-back extension (superman, prone back extension). */
  'spinal-extension',
  'carry',
  'locomotion',
  'conditioning',
  'mobility',
] as const;
export const MovementPatternSchema = z.enum(MOVEMENT_PATTERNS);
export type MovementPattern = z.infer<typeof MovementPatternSchema>;

export const EXERCISE_TAGS = [
  'compound',
  'isolation',
  'isometric',
  'plyometric',
  /** Explosive hip snap or pull (swings, cleans, thrusters): never given a slow tempo. */
  'ballistic',
  'warmup',
  'mobility',
  /** Both feet leave the floor and land, or the body drops to the floor: loud for neighbours. */
  'impact',
  /** Travels more than a step, or sweeps wider than a mat with arm room. */
  'needs-space',
  /** A static hold at a comfortable end range, no external load. */
  'stretch',
] as const;
export const ExerciseTagSchema = z.enum(EXERCISE_TAGS);
export type ExerciseTag = z.infer<typeof ExerciseTagSchema>;

/** Joints a user can mark as limited. */
export const JOINT_REGIONS = [
  'knee',
  'shoulder',
  'lower-back',
  'wrist',
  'elbow',
  'hip',
  'ankle',
] as const;
export const JointRegionSchema = z.enum(JOINT_REGIONS);
export type JointRegion = z.infer<typeof JointRegionSchema>;

/**
 * How hard an exercise is on a joint, done its usual way.
 * high: loaded at end range, under impact, or under full bodyweight in a weak position.
 * moderate: a main working joint under real load through a normal range.
 * A joint with no entry only stabilises, carries no load, or works in a limited range.
 */
export const JOINT_LOADS = ['moderate', 'high'] as const;
export const JointLoadSchema = z.enum(JOINT_LOADS);
export type JointLoad = z.infer<typeof JointLoadSchema>;

/**
 * external: dumbbells / kettlebells, load in kg per implement.
 * bodyweight: bodyweight only.
 * bodyweight-loadable: bodyweight, optionally with added load (see `addedLoad`).
 * band: resistance from a band level — a heavier band makes it harder.
 * band-assisted: a band takes some of the bodyweight — a lighter band makes it harder.
 * cardio-machine: speed / incline / level on a machine.
 */
export const LOAD_TYPES = [
  'external',
  'bodyweight',
  'bodyweight-loadable',
  'band',
  'band-assisted',
  'cardio-machine',
] as const;
export const LoadTypeSchema = z.enum(LOAD_TYPES);
export type LoadType = z.infer<typeof LoadTypeSchema>;

export const METRICS = ['reps', 'time'] as const;
export const MetricSchema = z.enum(METRICS);
export type Metric = z.infer<typeof MetricSchema>;

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

/** Implements that add load in kilograms to a bodyweight move. */
export const ADDED_LOAD_KINDS: readonly EquipmentKind[] = [
  'dumbbell',
  'kettlebell',
  'weight-belt',
  'weight-vest',
];

export const ExerciseSchema = z
  .strictObject({
    id: SlugSchema,
    name: LocalizedTextSchema,
    execution: LocalizedStepsSchema,
    keyCue: LocalizedTextSchema,
    primaryMuscles: z.array(MuscleSchema).min(1),
    secondaryMuscles: z.array(MuscleSchema),
    pattern: MovementPatternSchema,
    tags: z.array(ExerciseTagSchema),
    /** Alternatives: any one inner list satisfies the exercise. An empty inner list means no equipment. */
    equipment: z.array(z.array(EquipmentRequirementSchema)).min(1),
    loadType: LoadTypeSchema,
    /**
     * Ways to add load to a bodyweight-loadable exercise, any one of which works
     * (e.g. a weight belt or a vest; a pair of dumbbells). Only for that load type.
     */
    addedLoad: z.array(EquipmentRequirementSchema).min(1).optional(),
    metric: MetricSchema,
    /** Performed one side at a time (reps counted per side). */
    unilateral: z.boolean(),
    /** Where a stretch is held: on its feet, on a chair, or on the floor. Required on stretches. */
    position: z.enum(['standing', 'chair', 'floor']).optional(),
    difficulty: int(1, 5),
    easier: z.array(SlugSchema),
    harder: z.array(SlugSchema),
    /** Joints the exercise is hard on; empty when none. */
    joints: z.partialRecord(JointRegionSchema, JointLoadSchema),
  })
  .superRefine((ex, ctx) => {
    const issue = (message: string, path: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] });
    if (!unique(ex.primaryMuscles)) issue('duplicate muscles', 'primaryMuscles');
    if (!unique(ex.secondaryMuscles)) issue('duplicate muscles', 'secondaryMuscles');
    if (ex.secondaryMuscles.some((m) => ex.primaryMuscles.includes(m)))
      issue('a muscle cannot be both primary and secondary', 'secondaryMuscles');
    if (!unique(ex.tags)) issue('duplicate tags', 'tags');
    if (ex.tags.includes('compound') && ex.tags.includes('isolation'))
      issue('compound and isolation are exclusive', 'tags');
    if (ex.easier.includes(ex.id)) issue('cannot link to itself', 'easier');
    if (ex.harder.includes(ex.id)) issue('cannot link to itself', 'harder');
    if (ex.easier.some((id) => ex.harder.includes(id)))
      issue('an exercise cannot be both easier and harder', 'harder');
    if ((ex.loadType === 'bodyweight-loadable') !== (ex.addedLoad !== undefined))
      issue('addedLoad is required for, and only allowed on, bodyweight-loadable', 'addedLoad');
    if (ex.addedLoad?.some((req) => !ADDED_LOAD_KINDS.includes(req.kind)))
      issue('addedLoad only lists implements that add kilograms', 'addedLoad');
  });
export type Exercise = z.infer<typeof ExerciseSchema>;
