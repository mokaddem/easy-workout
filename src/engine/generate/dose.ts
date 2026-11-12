import type { Exercise, Goal, Level, Target, Tempo } from '../../domain';
import type { SelectionMethod } from './select';
import type { RepsSpec, SlotRole, SlotSpec } from './types';

/** Effort target when a slot names none: the reference programme's standard RIR 2. */
export const DEFAULT_RIR = 2;
/** Roles whose rep-based sets carry an RIR target. */
const RIR_ROLES: readonly SlotRole[] = [
  'main',
  'secondary',
  'accessory',
  'isolation',
  'core',
  'burnout',
];
/** Dose for an exercise borrowed from a neighbouring pattern: the slot's own dose was not meant for it. */
const FALLBACK_REPS: readonly [number, number] = [8, 12];
const FALLBACK_REST_CAP_SEC = 90;
/** Unloaded moves get no heavier by resting longer. */
const BODYWEIGHT_REST_CAP_SEC = 90;
const BODYWEIGHT_MIN_REPS = 8;

/**
 * Moved by reps alone at the start of the cycle. Vertical pulls are the exception:
 * a 5–8 pull-up is hard, and it is dosed like a loaded lift.
 */
const unloadedBodyweight = (exercise: Exercise) =>
  (exercise.loadType === 'bodyweight' || exercise.loadType === 'bodyweight-loadable') &&
  exercise.pattern !== 'pull-vertical';

/** Exercises whose rep target is fixed by the movement itself. Applied last. */
const EXERCISE_REPS: Readonly<Record<string, RepsSpec>> = {
  /** 7 bottom-half + 7 top-half + 7 full reps. */
  'dumbbell-21s': [21, 21],
  /** Slow, technical: low reps per side. */
  'kettlebell-turkish-get-up': [1, 3],
  'kettlebell-windmill': [1, 3],
};

const STRENGTH_ROLES: readonly SlotRole[] = ['main', 'secondary', 'accessory'];

const clampRange = (min: number, max: number): [number, number] => {
  const lo = Math.max(1, Math.round(min));
  return [lo, Math.max(lo, Math.round(max))];
};

/** Rep targets that fit how the exercise is loaded. */
const repsForLoadType = (reps: RepsSpec, exercise: Exercise): RepsSpec => {
  const ballistic = exercise.tags.includes('ballistic') || exercise.tags.includes('plyometric');
  if (reps === 'max') {
    if (exercise.loadType === 'band') return [15, 20];
    if (exercise.loadType === 'external' || ballistic) return [10, 12];
    return 'max';
  }
  // A band is light compared with dumbbells: low rep ranges make no sense with it.
  if (exercise.loadType === 'band' && reps[1] < 12) return [12, Math.max(15, reps[1])];
  return reps;
};

/** Rep counts people actually program; goal shifts move along this ladder. */
const REP_LADDER = [5, 6, 8, 10, 12, 15, 20, 25, 30] as const;

/** The ladder rung `steps` away from the first rung at or above `reps`. */
const rung = (reps: number, steps: number): number => {
  let index = REP_LADDER.findIndex((r) => r >= reps);
  if (index === -1) index = REP_LADDER.length - 1;
  const moved = Math.min(REP_LADDER.length - 1, Math.max(0, index + steps));
  return REP_LADDER[moved]!;
};

const repsForGoal = (reps: RepsSpec, role: SlotRole, goal: Goal, exercise: Exercise): RepsSpec => {
  if (reps === 'max') return reps;
  const [min, max] = reps;
  // Muscle gain: heavier main lifts — the bottom of the range moves one rung down.
  // Not for unloaded moves: fewer reps only means stopping earlier.
  if (goal === 'muscle' && role === 'main' && !unloadedBodyweight(exercise))
    return clampRange(Math.min(rung(min, -1), min), max);
  // General fitness: lighter, longer sets — both ends move one rung up.
  if (goal === 'general-fitness' && STRENGTH_ROLES.includes(role))
    return clampRange(rung(min, 1), rung(max, 1));
  return reps;
};

/** Plain bodyweight moves below 8 reps are mostly technique failures, not strength work. */
const repsFloor = (reps: RepsSpec, exercise: Exercise): RepsSpec => {
  if (reps === 'max' || exercise.loadType !== 'bodyweight' || !unloadedBodyweight(exercise))
    return reps;
  return reps[0] >= BODYWEIGHT_MIN_REPS ? reps : [BODYWEIGHT_MIN_REPS, Math.max(12, reps[1])];
};

export interface ItemDose {
  target: Target;
  rir?: number;
  tempo?: Tempo;
  perSide?: boolean;
}

/** Per-set target for the exercise picked for a slot, after goal and level. */
export const itemDose = (
  slot: SlotSpec,
  exercise: Exercise,
  method: SelectionMethod,
  goal: Goal,
  level: Level,
): ItemDose => {
  let target: Target;
  if (exercise.metric === 'time') {
    const [minSec, maxSec] = slot.time ?? [30, 30];
    target = { kind: 'time', minSec, maxSec };
  } else {
    const base = method === 'fallback-pattern' ? FALLBACK_REPS : (slot.reps ?? [10, 12]);
    let reps = repsForLoadType(base, exercise);
    reps = repsForGoal(reps, slot.role, goal, exercise);
    reps = repsFloor(reps, exercise);
    reps = EXERCISE_REPS[exercise.id] ?? reps;
    target = reps === 'max' ? { kind: 'max' } : { kind: 'reps', min: reps[0], max: reps[1] };
  }

  let rir: number | undefined;
  if (target.kind !== 'time' && RIR_ROLES.includes(slot.role)) {
    rir = slot.rir ?? (target.kind === 'max' ? 1 : DEFAULT_RIR);
    if (goal === 'general-fitness') rir = Math.max(rir, 2);
    if (level === 'beginner' || level === 'returning') rir = Math.min(4, rir + 1);
  }

  const ballistic = exercise.tags.includes('ballistic') || exercise.tags.includes('plyometric');
  const tempo = ballistic || exercise.metric === 'time' ? undefined : slot.tempo;

  return {
    target,
    ...(rir === undefined ? {} : { rir }),
    ...(tempo ? { tempo } : {}),
    ...(exercise.unilateral ? { perSide: true } : {}),
  };
};

/** Sets of a straight block after goal and level. */
export const straightSets = (sets: number, role: SlotRole, goal: Goal, level: Level): number => {
  if (role === 'warmup' || role === 'conditioning') return sets;
  let result = sets;
  if (goal === 'general-fitness') result -= 1;
  if (level === 'beginner' || level === 'returning') result -= 1;
  if (level === 'advanced' && (role === 'main' || role === 'secondary')) result += 1;
  return Math.min(5, Math.max(Math.min(2, sets), result));
};

/** Rest between sets of a straight block after goal, level and the exercise picked. */
export const straightRest = (
  restSec: number,
  role: SlotRole,
  goal: Goal,
  exercise: Exercise,
  method: SelectionMethod,
): number => {
  if (role === 'warmup') return restSec;
  let rest = restSec;
  if (goal === 'muscle') rest += role === 'main' ? 30 : role === 'secondary' ? 15 : 0;
  if (goal === 'general-fitness') rest = Math.max(role === 'main' ? 60 : 30, rest - 15);
  if (method === 'fallback-pattern') rest = Math.min(rest, FALLBACK_REST_CAP_SEC);
  if (unloadedBodyweight(exercise)) rest = Math.min(rest, BODYWEIGHT_REST_CAP_SEC);
  return Math.min(180, rest);
};

/** Rounds of a group after level. */
export const groupRounds = (rounds: number, level: Level): number =>
  level === 'beginner' || level === 'returning'
    ? Math.max(Math.min(2, rounds), rounds - 1)
    : rounds;

/** Rest after each round of a group after goal. */
export const groupRest = (restSec: number, style: 'superset' | 'circuit', goal: Goal): number => {
  if (goal === 'muscle' && style === 'circuit') return restSec + 30;
  if (goal === 'general-fitness') return Math.max(30, restSec - 15);
  return restSec;
};
