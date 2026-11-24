import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { JointRegion, Profile, Programme, SessionLog } from '../src/domain';
import {
  constraintsOf,
  fitFor,
  generateProgramme,
  generateQuickSession,
  insertLighterWeek,
  nextSession,
  repickInPlace,
  saveSessionEdit,
} from '../src/engine';
import { programmeFreshness } from '../src/app/programme-state';
import { referenceEquipment } from './fixtures/reference-equipment';
import { equipmentSets } from './fixtures/equipment-sets';
import { makeLog } from './support/logs';

const SINCE = '2026-01-01T00:00:00.000Z';

const base: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 5,
  sessionMinutes: 60,
};
const limit = (...regions: JointRegion[]): Partial<Profile> => ({
  limitations: regions.map((region) => ({ region, since: SINCE })),
});

describe('without constraints nothing changes', () => {
  const golden = JSON.parse(
    readFileSync(
      new URL('./__snapshots__/programmes/unconstrained.golden.json', import.meta.url),
      'utf8',
    ),
  ) as Record<string, unknown>;

  const current = () => ({
    ref: generateProgramme({
      profile: { goal: 'recomposition', level: 'intermediate', daysPerWeek: 6, sessionMinutes: 60 },
      equipment: referenceEquipment,
    }),
    bw: generateProgramme({
      profile: { goal: 'general-fitness', level: 'beginner', daysPerWeek: 3, sessionMinutes: 45 },
      equipment: equipmentSets.bodyweight!,
    }),
    quick: generateQuickSession({
      profile: { goal: 'recomposition', level: 'intermediate', daysPerWeek: 3, sessionMinutes: 45 },
      equipment: referenceEquipment,
      minutes: 30,
      focus: 'full',
    }),
  });

  it('gives the reference programmes and a quick session byte for byte', () => {
    const now = current();
    expect(JSON.stringify(now, null, 1) + '\n').toBe(JSON.stringify(golden, null, 1) + '\n');
  });

  it('does not put the constraint fields in the recorded profile', () => {
    const programme = current().ref;
    expect(Object.keys(programme.generation!.profile)).toEqual([
      'goal',
      'level',
      'daysPerWeek',
      'sessionMinutes',
    ]);
  });

  it('is the same with lifted limitations and switches off', () => {
    const profile: Profile = {
      ...base,
      limitations: [{ region: 'knee', since: SINCE, liftedAt: '2026-03-01T00:00:00.000Z' }],
      quiet: false,
      smallSpace: false,
    };
    const was = generateProgramme({ profile: base, equipment: referenceEquipment });
    const now = generateProgramme({ profile, equipment: referenceEquipment });
    expect(now.rotation).toEqual(was.rotation);
    expect(now.phases).toEqual(was.phases);
  });
});

describe('re-picking in place', () => {
  const equipment = referenceEquipment;
  const programme = (): Programme => {
    const generated = generateProgramme({ profile: base, equipment, id: 'active' });
    // A lighter week inserted at week 3, and a few sessions done.
    return insertLighterWeek(generated, 3, new Date('2026-02-01T00:00:00.000Z'));
  };
  const done = (p: Programme, n: number): SessionLog[] =>
    Array.from({ length: n }, (_, i) =>
      makeLog({
        id: `log-${i}`,
        at: `2026-02-0${i + 1}T09:00:00.000Z`,
        source: {
          kind: 'programme',
          programmeId: p.id,
          week: 1,
          sessionId: p.rotation[i % p.rotation.length]!.id,
        },
        main: [],
      }),
    );

  it('keeps the id, phases, weeks and position, and swaps the slots the limitation changes', () => {
    const active = programme();
    const logs = done(active, 7);
    const result = repickInPlace(active, { ...base, ...limit('knee') });
    const next = result.programme;
    expect(next.id).toBe(active.id);
    expect(next.weeks).toBe(active.weeks);
    expect(next.sessionsPerWeek).toBe(active.sessionsPerWeek);
    expect(next.phases).toEqual(active.phases);
    expect(next.phases.some((ph) => ph.origin === 'early')).toBe(true);
    expect(next.rotation.map((s) => s.id)).toEqual(active.rotation.map((s) => s.id));
    expect(nextSession(next, logs)).toEqual(nextSession(active, logs));
    expect(next.generation?.seed).toBe(active.generation?.seed);
    expect(next.generation?.profile.limitations).toEqual([{ region: 'knee', since: SINCE }]);

    expect(result.changes.length).toBeGreaterThan(0);
    const constraints = constraintsOf({ ...limit('knee') });
    for (const session of next.rotation)
      for (const block of [...session.warmup, ...session.main, ...session.finisher])
        for (const item of block.type === 'straight' ? [block.item] : block.items)
          expect(fitFor(exerciseById.get(item.exerciseId)!, constraints)).not.toBe('out');
  });

  it('is a no-op when nothing changed', () => {
    const active = programme();
    const result = repickInPlace(active, base);
    expect(result.changes).toEqual([]);
    expect(result.programme.rotation).toEqual(active.rotation);
  });

  it('keeps the user’s edits, and lists those that are now out', () => {
    const active = programme();
    const session = active.rotation.find((s) => s.id.endsWith('lower-core'))!;
    // The user put a pistol squat in place of the first main exercise.
    const edited = {
      ...session,
      main: session.main.map((block, i) =>
        i === 0 && block.type === 'straight'
          ? { ...block, item: { ...block.item, exerciseId: 'pistol-squat' } }
          : block,
      ),
    };
    const withEdit = saveSessionEdit(active, edited);
    const result = repickInPlace(withEdit, { ...base, ...limit('knee') });
    const kept = result.programme.rotation.find((s) => s.id === session.id)!;
    const first = kept.main[0]!;
    expect(first.type === 'straight' && first.item.exerciseId).toBe('pistol-squat');
    expect(result.outEdits).toEqual([
      expect.objectContaining({ sessionId: session.id, exerciseId: 'pistol-squat' }),
    ]);
    expect(result.ledger?.kept.some((k) => k.exerciseId === 'pistol-squat')).toBe(true);
  });

  it('lets the user’s kept exercise use up the session’s budget for that joint', () => {
    const active = programme();
    const session = active.rotation.find((s) => s.id.endsWith('lower-core'))!;
    const edited = {
      ...session,
      main: session.main.map((block, i) =>
        i === 0 && block.type === 'straight'
          ? { ...block, item: { ...block.item, exerciseId: 'reverse-lunge' } }
          : block,
      ),
    };
    const knee = { ...base, ...limit('knee') };
    const sparing = (p: Programme) =>
      [
        ...p.rotation.find((s) => s.id === session.id)!.main,
        ...p.rotation.find((s) => s.id === session.id)!.finisher,
      ]
        .flatMap((b) => (b.type === 'straight' ? [b.item] : b.items))
        .filter((i) => exerciseById.get(i.exerciseId)!.joints.knee === 'moderate');
    const plain = repickInPlace(active, knee).programme;
    expect(sparing(plain).length).toBeGreaterThanOrEqual(1);
    const result = repickInPlace(saveSessionEdit(active, edited), knee);
    const generated = result.programme.generatedRotation!;
    const regenerated = { ...result.programme, rotation: generated };
    // Only the user's own exercise spares the knee in that session now.
    expect(sparing(result.programme).map((i) => i.exerciseId)).toEqual(['reverse-lunge']);
    expect(sparing(regenerated)).toHaveLength(0);
  });

  it('points the max test at one that is still allowed', () => {
    const active = programme();
    const result = repickInPlace(active, { ...base, ...limit('wrist', 'shoulder') });
    const test = result.programme.phases
      .flatMap((p) => p.adjustments)
      .find((a) => a.kind === 'max-test');
    const constraints = constraintsOf({ ...limit('wrist', 'shoulder') });
    if (test)
      for (const id of test.exerciseIds)
        expect(fitFor(exerciseById.get(id)!, constraints)).toBe('ok');
  });
});

describe('programme freshness', () => {
  const generated = generateProgramme({ profile: base, equipment: referenceEquipment });

  it('is current when only the dates of a limitation differ', () => {
    const was = generateProgramme({
      profile: { ...base, ...limit('knee') },
      equipment: referenceEquipment,
    });
    const later: Profile = {
      ...base,
      limitations: [
        {
          region: 'knee',
          since: '2026-05-05T00:00:00.000Z',
          reviewedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    };
    expect(programmeFreshness(was, later, referenceEquipment)).toBe('current');
  });

  it('is out of date when a limitation is added, lifted, or quiet and small space change', () => {
    expect(programmeFreshness(generated, { ...base, ...limit('knee') }, referenceEquipment)).toBe(
      'out-of-date',
    );
    expect(programmeFreshness(generated, { ...base, quiet: true }, referenceEquipment)).toBe(
      'out-of-date',
    );
    expect(programmeFreshness(generated, { ...base, smallSpace: true }, referenceEquipment)).toBe(
      'out-of-date',
    );
    const was = generateProgramme({
      profile: { ...base, ...limit('knee') },
      equipment: referenceEquipment,
    });
    const lifted: Profile = {
      ...base,
      limitations: [{ region: 'knee', since: SINCE, liftedAt: '2026-05-01T00:00:00.000Z' }],
    };
    expect(programmeFreshness(was, lifted, referenceEquipment)).toBe('out-of-date');
  });

  it('is current for a lifted limitation and none, and for switches off and absent', () => {
    const lifted: Profile = {
      ...base,
      limitations: [{ region: 'knee', since: SINCE, liftedAt: '2026-05-01T00:00:00.000Z' }],
      quiet: false,
    };
    expect(programmeFreshness(generated, lifted, referenceEquipment)).toBe('current');
  });

  it('is current again after the in-place re-pick', () => {
    const profile = { ...base, ...limit('knee') };
    const result = repickInPlace(generated, profile);
    expect(programmeFreshness(result.programme, profile, referenceEquipment)).toBe('current');
  });
});
