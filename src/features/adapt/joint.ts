import type { Exercise, JointRegion, Profile } from '@/domain';
import { constraintsOf } from '@/engine';

/**
 * The joint a note speaks of for this exercise: the limited joint it is graded on (the first, in
 * body order), else the first limited joint. Nothing when no joint is limited.
 */
export function sparedJoint(
  exercise: Pick<Exercise, 'joints'> | undefined,
  profile: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'> | null | undefined,
): JointRegion | undefined {
  const { regions } = constraintsOf(profile ?? undefined);
  if (regions.length === 0) return undefined;
  return regions.find((r) => exercise?.joints[r] !== undefined) ?? regions[0];
}
