import { exerciseById } from '@/catalogue';
import type { JointRegion, Limitation, Profile, Programme } from '@/domain';
import { constraintsOf } from '@/engine';

/** What the profile keeps about avoided joints, noise and space. */
export type ConstraintFields = Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'>;

/** Top to bottom of the body: quicker to scan than alphabetical, and the same in both languages. */
export const REGION_ORDER: readonly JointRegion[] = [
  'shoulder',
  'elbow',
  'wrist',
  'lower-back',
  'hip',
  'knee',
  'ankle',
];

/** Weeks after a limitation started (or was last confirmed) before asking about it. */
export const REVIEW_WEEKS = 6;

const WEEK_MS = 7 * 86_400_000;

/** What the screen edits. */
export interface Draft {
  regions: JointRegion[];
  quiet: boolean;
  smallSpace: boolean;
}

const sortRegions = (regions: Iterable<JointRegion>): JointRegion[] => {
  const set = new Set(regions);
  return REGION_ORDER.filter((r) => set.has(r));
};

export const draftOf = (profile: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'>): Draft => {
  const c = constraintsOf(profile);
  return { regions: sortRegions(c.regions), quiet: c.quiet, smallSpace: c.smallSpace };
};

/** Same set of joints and the same switches, whatever the order. */
export const sameDraft = (a: Draft, b: Draft): boolean =>
  a.quiet === b.quiet &&
  a.smallSpace === b.smallSpace &&
  sortRegions(a.regions).join() === sortRegions(b.regions).join();

export const toggleRegion = (draft: Draft, region: JointRegion, on: boolean): Draft => ({
  ...draft,
  regions: sortRegions(on ? [...draft.regions, region] : draft.regions.filter((r) => r !== region)),
});

/** A joint row against what is saved: untouched (on or off), being added, or being lifted. */
export type RowState = 'off' | 'on' | 'adding' | 'lifting';

export const rowState = (saved: Draft, draft: Draft, region: JointRegion): RowState => {
  const was = saved.regions.includes(region);
  const now = draft.regions.includes(region);
  if (was === now) return now ? 'on' : 'off';
  return now ? 'adding' : 'lifting';
};

/** The draft's joints only add, only lift, or both: the preview words the count by it. */
export function draftKind(saved: Draft, draft: Draft): 'adding' | 'lifting' | 'mixed' | 'none' {
  const added = draft.regions.some((r) => !saved.regions.includes(r));
  const lifted = saved.regions.some((r) => !draft.regions.includes(r));
  if (added && lifted) return 'mixed';
  return added ? 'adding' : lifted ? 'lifting' : 'none';
}

/** The limitation that is in force for a joint. */
export const activeLimitation = (
  profile: Pick<Profile, 'limitations'>,
  region: JointRegion,
): Limitation | undefined => profile.limitations?.find((l) => l.region === region && !l.liftedAt);

/**
 * The fields to save for a draft. A joint that left the draft is lifted (its entry stays, with
 * `liftedAt`); a joint that joined starts now. Switches that are off are left out.
 */
export function fieldsFor(
  profile: Pick<Profile, 'limitations'>,
  draft: Draft,
  now: Date,
): ConstraintFields {
  const stamp = now.toISOString();
  const entries = (profile.limitations ?? []).map((l) =>
    !l.liftedAt && !draft.regions.includes(l.region) ? { ...l, liftedAt: stamp } : l,
  );
  for (const region of draft.regions)
    if (!entries.some((l) => l.region === region && !l.liftedAt))
      entries.push({ region, since: stamp });
  return {
    ...(entries.length > 0 && { limitations: entries }),
    ...(draft.quiet && { quiet: true }),
    ...(draft.smallSpace && { smallSpace: true }),
  };
}

/** The profile with a draft applied: what the programme is re-picked for. */
export function profileWith(profile: Profile, draft: Draft, now: Date): Profile {
  const { limitations: _l, quiet: _q, smallSpace: _s, ...rest } = profile;
  return { ...rest, ...fieldsFor(profile, draft, now) };
}

/** The profile with one more joint limited. */
export const withLimit = (profile: Profile, region: JointRegion, now: Date): Profile => {
  const draft = draftOf(profile);
  return profileWith(profile, toggleRegion(draft, region, true), now);
};

/** The profile with a joint lifted. */
export const withLift = (profile: Profile, region: JointRegion, now: Date): Profile => {
  const draft = draftOf(profile);
  return profileWith(profile, toggleRegion(draft, region, false), now);
};

/** Whole weeks since a date. */
export const weeksSince = (iso: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / WEEK_MS));

/** When a limitation is next asked about: six weeks after it started or was last confirmed. */
export const reviewAt = (limitation: Limitation): string =>
  new Date(
    Date.parse(limitation.reviewedAt ?? limitation.since) + REVIEW_WEEKS * WEEK_MS,
  ).toISOString();

/**
 * The limitation to ask about, if any: one at a time, the one that has waited longest. Lifted
 * ones are never asked about.
 */
export function reviewDue(
  profile: Pick<Profile, 'limitations'> | null | undefined,
  now: Date,
): Limitation | undefined {
  return (profile?.limitations ?? [])
    .filter((l) => !l.liftedAt && Date.parse(reviewAt(l)) <= now.getTime())
    .sort((a, b) => reviewAt(a).localeCompare(reviewAt(b)))[0];
}

/**
 * Exercises of the programme that go easy on a joint: the ones graded for it that are still in
 * the rotation, plus the slots left out because of it.
 */
export function adaptedCount(
  programme: Pick<Programme, 'rotation' | 'generation'>,
  region: JointRegion,
): number {
  const graded = new Set<string>();
  for (const session of programme.rotation)
    for (const block of [...session.warmup, ...session.main, ...session.finisher])
      for (const item of block.type === 'straight' ? [block.item] : block.items)
        if (exerciseById.get(item.exerciseId)?.joints[region] !== undefined)
          graded.add(item.exerciseId);
  const left = (programme.generation?.notes ?? []).filter(
    (n) => n.code === 'slot-limited' && n.params.region === region,
  ).length;
  return graded.size + left;
}
