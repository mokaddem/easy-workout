import type { Exercise, Level, SessionTest } from '../domain';
import { fitFor, type Constraints } from './generate/constraints';
import { levelCap } from './generate/select';

/** A rep test stops here: past 50 reps, it measures endurance, not the movement. */
export const REP_TEST_CAP = 50;
/** A hold test stops at three minutes. */
export const HOLD_TEST_CAP_SEC = 180;
/** Rest before a test, so the result reads what the user can do. */
export const TEST_REST_SEC = 180;

/** Patterns a rep test may take: presses, pulls and squats, both sides at once. */
const REP_TEST_PATTERNS: ReadonlySet<string> = new Set([
  'push-horizontal',
  'push-vertical',
  'pull-vertical',
  'pull-horizontal',
  'squat',
]);
/** Holds that are safe to take to the limit. */
const HOLD_TESTS: ReadonlySet<string> = new Set([
  'plank',
  'knee-plank',
  'wall-sit',
  'flexed-arm-hang',
]);
/** Lowering-only moves and handstands: going to failure on them is how people get hurt. */
const NEVER_TESTED = /negative|eccentric|handstand|dip/;

/**
 * An exercise a max test may use: a bodyweight press, pull or squat on both sides for reps, or
 * one of a few safe holds; within the level's difficulty when a level is given. With
 * constraints, nothing that is ruled out or spares a limited joint: a test goes to the limit.
 */
export function isTestable(exercise: Exercise, level?: Level, constraints?: Constraints): boolean {
  if (level && exercise.difficulty > levelCap(level, exercise)) return false;
  if (fitFor(exercise, constraints) !== 'ok') return false;
  if (HOLD_TESTS.has(exercise.id)) return true;
  return (
    exercise.metric === 'reps' &&
    REP_TEST_PATTERNS.has(exercise.pattern) &&
    !exercise.unilateral &&
    (exercise.loadType === 'bodyweight' || exercise.loadType === 'bodyweight-loadable') &&
    !exercise.tags.includes('plyometric') &&
    !exercise.tags.includes('ballistic') &&
    // Drills that also warm up are no test, except squats: a bodyweight squat is real work.
    (!exercise.tags.includes('warmup') || exercise.pattern === 'squat') &&
    !exercise.tags.includes('isolation') &&
    !NEVER_TESTED.test(exercise.id)
  );
}

export const testKind = (exercise: Exercise): SessionTest['kind'] =>
  exercise.metric === 'time' ? 'time' : 'reps';
