import type { Exercise, Limitation } from '../../domain';
import type { Exposure } from './exposures';

const DAY_MS = 86_400_000;

/** Days an exercise must have been left alone before a lifted limitation, to need easing back in. */
export const LIFT_STALE_DAYS = 28;
/** Exposures after a lift that keep the dose cap. */
export const LIFT_CAPPED_EXPOSURES = 2;

export interface LiftEasing {
  /** Days since the exercise was last done: the over-28-day treatment applies to the first one back. */
  gapDays?: number;
  /** Capped like an exercise sparing a joint, for its first exposures after the lift. */
  capped: boolean;
}

/**
 * Easing back in after a limitation is lifted. An exercise graded for the region, last done
 * more than 28 days before the lift, comes back with the long-break treatment (one load step
 * back, reps at the bottom of the range) and the dose cap for its first two exposures.
 * `all` is the exercise's own exposures, newest first.
 */
export function liftEasing(
  exercise: Exercise,
  limitations: readonly Limitation[] | undefined,
  all: readonly Exposure[],
  now: number,
): LiftEasing | undefined {
  let out: LiftEasing | undefined;
  for (const l of limitations ?? []) {
    if (!l.liftedAt || exercise.joints[l.region] === undefined) continue;
    const lifted = Date.parse(l.liftedAt);
    if (lifted > now) continue;
    const before = all.find((e) => Date.parse(e.at) < lifted);
    if (!before || lifted - Date.parse(before.at) <= LIFT_STALE_DAYS * DAY_MS) continue;
    const after = all.filter((e) => Date.parse(e.at) >= lifted).length;
    if (after >= LIFT_CAPPED_EXPOSURES) continue;
    const days = after === 0 ? (now - Date.parse(before.at)) / DAY_MS : undefined;
    const gapDays = days === undefined ? out?.gapDays : Math.max(days, out?.gapDays ?? 0);
    out = { capped: true, ...(gapDays !== undefined && { gapDays }) };
  }
  return out;
}
