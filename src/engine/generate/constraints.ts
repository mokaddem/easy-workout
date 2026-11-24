import {
  JOINT_REGIONS,
  type Exercise,
  type JointLoad,
  type JointRegion,
  type Profile,
} from '../../domain';

/** What the user avoids: joints to spare, noise, floor space. */
export interface Constraints {
  /** Joints currently limited (lifted limitations are not in it), in a fixed order. */
  regions: readonly JointRegion[];
  quiet: boolean;
  smallSpace: boolean;
}

/** How an exercise sits with the constraints: fine, spared (a limited joint works), or not at all. */
export type Fit = 'ok' | 'moderate' | 'out';

const FIT_RANK: Record<Fit, number> = { ok: 0, moderate: 1, out: 2 };

export const fitRank = (fit: Fit): number => FIT_RANK[fit];

/** The constraints a profile asks for. Always an object; {@link isConstrained} tells if any is set. */
export const constraintsOf = (
  profile: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'> | undefined,
): Constraints => {
  const active = new Set(
    (profile?.limitations ?? []).filter((l) => !l.liftedAt).map((l) => l.region),
  );
  return {
    regions: JOINT_REGIONS.filter((r) => active.has(r)),
    quiet: profile?.quiet === true,
    smallSpace: profile?.smallSpace === true,
  };
};

export const isConstrained = (c: Constraints | undefined): c is Constraints =>
  c !== undefined && (c.regions.length > 0 || c.quiet || c.smallSpace);

/** The same constraints with one more joint limited. */
export const withRegion = (c: Constraints, region: JointRegion): Constraints => ({
  ...c,
  regions: JOINT_REGIONS.filter((r) => r === region || c.regions.includes(r)),
});

/** Fit counting the limited joints only (not noise or space). */
export const jointFit = (exercise: Exercise, c: Constraints | undefined): Fit => {
  let fit: Fit = 'ok';
  for (const region of c?.regions ?? []) {
    const grade = exercise.joints[region];
    if (grade === 'high') return 'out';
    if (grade === 'moderate') fit = 'moderate';
  }
  return fit;
};

/**
 * Quiet rules out jumps and impacts, small space what needs room; a limited joint the exercise is
 * hard on rules it out (`high`) or spares it (`moderate`: one per joint and session, dosed gently).
 */
export const fitFor = (exercise: Exercise, c: Constraints | undefined): Fit => {
  if (!c) return 'ok';
  if (c.quiet && exercise.tags.includes('impact')) return 'out';
  if (c.smallSpace && exercise.tags.includes('needs-space')) return 'out';
  return jointFit(exercise, c);
};

/** Limited joints the exercise is graded `moderate` on. */
export const moderateRegions = (exercise: Exercise, c: Constraints | undefined): JointRegion[] =>
  (c?.regions ?? []).filter((r) => exercise.joints[r] === 'moderate');

/** The joint an exercise is hardest on: high before moderate, then the fixed joint order. */
export const topGrade = (
  exercise: Exercise,
  skip: readonly JointRegion[] = [],
): { region: JointRegion; grade: JointLoad } | undefined => {
  for (const grade of ['high', 'moderate'] as const) {
    const region = JOINT_REGIONS.find((r) => !skip.includes(r) && exercise.joints[r] === grade);
    if (region) return { region, grade };
  }
  return undefined;
};

/** The constraint that rules an exercise out, for a note: a limited joint, quiet or small space. */
export const outCause = (
  exercise: Exercise,
  c: Constraints | undefined,
): { cause: 'region'; region: JointRegion } | { cause: 'quiet' | 'small-space' } | undefined => {
  if (!c) return undefined;
  const region = c.regions.find((r) => exercise.joints[r] === 'high');
  if (region) return { cause: 'region', region };
  if (c.quiet && exercise.tags.includes('impact')) return { cause: 'quiet' };
  if (c.smallSpace && exercise.tags.includes('needs-space')) return { cause: 'small-space' };
  return undefined;
};
