import { afterEach, describe, expect, it } from 'vitest';
import type { EquipmentInventory, Profile } from '../domain';
import { generateProgramme } from '../engine';
import { createConstraints } from './constraints';
import { WorkoutDatabase } from './index';
import { createRepo } from './repo';

const profile: Profile = {
  goal: 'muscle',
  level: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 45,
};
const equipment: EquipmentInventory = [{ id: 'bands', kind: 'band', levels: ['light', 'medium'] }];
const since = '2026-11-01T00:00:00.000Z';

let db: WorkoutDatabase;
function setup() {
  db = new WorkoutDatabase(`test-${Math.random().toString(36).slice(2)}`);
  return { repo: createRepo(db), constraints: createConstraints(db) };
}
afterEach(async () => {
  await db.delete();
});

describe('constraints repo', () => {
  it('saves joints and switches on the profile, and drops switches that are off', async () => {
    const { repo, constraints } = setup();
    await repo.saveProfile({ ...profile, quiet: true, smallSpace: true });
    await constraints.saveConstraints({ limitations: [{ region: 'knee', since }], quiet: true });
    expect(await repo.getProfile()).toEqual({
      ...profile,
      limitations: [{ region: 'knee', since }],
      quiet: true,
    });
    await constraints.saveConstraints({});
    expect(await repo.getProfile()).toEqual(profile);
  });

  it('saves the re-picked programme under the same id, keeping what the record holds', async () => {
    const { repo, constraints } = setup();
    await repo.saveProfile(profile);
    const programme = generateProgramme({ profile, equipment });
    const record = await repo.activateProgramme(programme);
    await repo.markWhySeen(record.id);
    const repicked = { ...record, name: { fr: 'Autre', en: 'Other' } };
    await constraints.saveConstraints({ quiet: true }, repicked);
    const stored = await repo.getActiveProgramme();
    expect(stored?.id).toBe(record.id);
    expect(stored?.name.en).toBe('Other');
    expect(stored?.status).toBe('active');
    expect(stored?.whySeen).toBe(true);
    expect((await repo.listProgrammes()).length).toBe(1);
  });

  it('writes nothing when the programme to save is unknown', async () => {
    const { repo, constraints } = setup();
    await repo.saveProfile(profile);
    const programme = generateProgramme({ profile, equipment });
    await expect(constraints.saveConstraints({ quiet: true }, programme)).rejects.toThrow();
    expect(await repo.getProfile()).toEqual(profile);
  });

  it('confirms a limitation until six weeks later, and takes it back', async () => {
    const { repo, constraints } = setup();
    await repo.saveProfile({
      ...profile,
      limitations: [
        { region: 'knee', since },
        { region: 'hip', since, liftedAt: '2026-11-10T00:00:00.000Z' },
      ],
    });
    const now = new Date('2026-12-15T10:00:00.000Z');
    await constraints.setLimitationReviewedAt('knee', now);
    await constraints.setLimitationReviewedAt('hip', now);
    const after = (await repo.getProfile())!.limitations!;
    expect(after.find((l) => l.region === 'knee')?.reviewedAt).toBe(now.toISOString());
    expect(after.find((l) => l.region === 'hip')?.reviewedAt).toBeUndefined();
    await constraints.setLimitationReviewedAt('knee', undefined);
    expect((await repo.getProfile())!.limitations![0]).toEqual({ region: 'knee', since });
  });

  it('keeps training days, pause and travel kit in the settings and clears them', async () => {
    const { repo, constraints } = setup();
    await constraints.setTrainingDays(['mon', 'wed', 'fri']);
    expect((await repo.getSettings('en')).trainingDays).toEqual(['mon', 'wed', 'fri']);
    await constraints.setTrainingDays([]);
    expect((await repo.getSettings('en')).trainingDays).toBeUndefined();

    const first = new Date('2026-11-10T08:00:00.000Z');
    await constraints.pauseProgramme(first);
    await constraints.pauseProgramme(new Date('2026-11-12T08:00:00.000Z'));
    expect((await repo.getSettings('en')).pause).toEqual({ since: first.toISOString() });
    const back = new Date('2026-11-18T08:00:00.000Z');
    await constraints.resumeProgramme('en', back);
    expect((await repo.getSettings('en')).pause).toBeUndefined();
    // The days paused are not missed ones.
    expect((await repo.getSettings('en')).missedDayDismissedAt).toBe(back.toISOString());

    await constraints.startTravelKit(equipment, '2026-11-30');
    expect((await repo.getSettings('en')).travelKit).toEqual({ equipment, until: '2026-11-30' });
    await constraints.endTravelKit();
    expect((await repo.getSettings('en')).travelKit).toBeUndefined();
    // Other settings are untouched.
    expect((await repo.getSettings('en')).voice).toBe(true);
  });
});
