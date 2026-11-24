import { describe, expect, it } from 'vitest';
import { catalogue, exerciseById } from '../src/catalogue';
import { JOINT_REGIONS, type Exercise, type JointRegion } from '../src/domain';

const GRADE = { moderate: 1, high: 2 } as const;
const grade = (ex: Exercise, region: JointRegion): number => {
  const load = ex.joints?.[region];
  return load ? GRADE[load] : 0;
};

/** Entries whose joints are graded; the rules below only judge those. */
const graded = catalogue.filter((ex) => ex.joints !== undefined);

const failing = (
  rule: (ex: Exercise) => string | undefined,
  pool: readonly Exercise[] = graded,
): string[] =>
  pool.flatMap((ex) => {
    const message = rule(ex);
    return message ? [`${ex.id}: ${message}`] : [];
  });

const has = (ex: Exercise, tag: Exercise['tags'][number]) => ex.tags.includes(tag);

describe('joint grades, impact and space tags', () => {
  it('every entry grades its joints', () => {
    expect(catalogue.filter((ex) => ex.joints === undefined).map((ex) => ex.id)).toEqual([]);
  });

  it('jumps land: plyometric means impact, knee and ankle at least moderate', () => {
    expect(
      failing((ex) =>
        has(ex, 'plyometric') &&
        (!has(ex, 'impact') || grade(ex, 'knee') < 1 || grade(ex, 'ankle') < 1)
          ? 'plyometric without impact or knee / ankle grade'
          : undefined,
      ),
    ).toEqual([]);
  });

  it('impact loads the ankle', () => {
    expect(
      failing((ex) =>
        has(ex, 'impact') && grade(ex, 'ankle') < 1 ? 'impact without an ankle grade' : undefined,
      ),
    ).toEqual([]);
  });

  it('ballistic hinges load the lower back', () => {
    expect(
      failing((ex) =>
        has(ex, 'ballistic') && ex.pattern === 'hinge' && grade(ex, 'lower-back') < 1
          ? 'ballistic hinge without a lower-back grade'
          : undefined,
      ),
    ).toEqual([]);
  });

  it('patterns grade their main joint', () => {
    const main: Partial<Record<Exercise['pattern'], JointRegion>> = {
      squat: 'knee',
      lunge: 'knee',
      'elbow-flexion': 'elbow',
      'elbow-extension': 'elbow',
      'push-vertical': 'shoulder',
    };
    expect(
      failing((ex) => {
        const region = main[ex.pattern];
        return region && grade(ex, region) < 1
          ? `${ex.pattern} without a ${region} grade`
          : undefined;
      }),
    ).toEqual([]);
  });

  it('warm-up drills are never hard on a joint and never static stretches', () => {
    expect(
      failing((ex) =>
        has(ex, 'warmup') &&
        (has(ex, 'stretch') || JOINT_REGIONS.some((r) => grade(ex, r) === GRADE.high))
          ? 'warm-up with a high joint or a stretch tag'
          : undefined,
      ),
    ).toEqual([]);
  });

  it('stretches are unloaded timed mobility holds', () => {
    const banned = [
      'warmup',
      'compound',
      'isolation',
      'isometric',
      'plyometric',
      'ballistic',
      'impact',
    ] as const;
    expect(
      failing(
        (ex) =>
          has(ex, 'stretch') &&
          (ex.pattern !== 'mobility' ||
            !has(ex, 'mobility') ||
            ex.metric !== 'time' ||
            (ex.loadType !== 'bodyweight' && ex.loadType !== 'band') ||
            banned.some((tag) => has(ex, tag)))
            ? 'stretch breaks the stretch rules'
            : undefined,
        catalogue,
      ),
    ).toEqual([]);
  });

  it('an easier variant is never harder on a joint', () => {
    const worse = graded.flatMap((ex) =>
      ex.easier.flatMap((id) => {
        const easier = exerciseById.get(id);
        if (!easier?.joints) return [];
        return JOINT_REGIONS.filter((r) => grade(easier, r) > grade(ex, r)).map(
          (r) => `${ex.id}: easier ${id} is harder on the ${r}`,
        );
      }),
    );
    expect(worse).toEqual([]);
  });
});
