import type { Exercise, SessionItem } from '../../domain';
import { jointFit, type Constraints } from '../generate/constraints';

/** Reps in reserve a spared joint's exercises never go under. */
export const DOSE_CAP_RIR = 2;

/**
 * The exercise works a limited joint (graded for it, whatever the grade: one the user kept in
 * the programme though it is now out counts too). Noise and space don't spare a joint.
 */
export const isDoseCapped = (exercise: Exercise, constraints: Constraints | undefined): boolean =>
  jointFit(exercise, constraints) !== 'ok';

/**
 * The item at no less than {@link DOSE_CAP_RIR} reps in reserve; a goal set at a closer reserve
 * gives up a rep for each one added. Items with no effort target stay as they are.
 */
export function capItem(item: SessionItem): SessionItem {
  if (item.rir === undefined || item.rir >= DOSE_CAP_RIR) return item;
  const added = DOSE_CAP_RIR - item.rir;
  return {
    ...item,
    rir: DOSE_CAP_RIR,
    ...(item.goal !== undefined &&
      item.target.kind === 'reps' && { goal: Math.max(1, item.goal - added) }),
  };
}
