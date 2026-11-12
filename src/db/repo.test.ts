import { afterEach, describe, expect, it } from 'vitest';
import type { Profile } from '../domain';
import { generateProgramme } from '../engine';
import { WorkoutDatabase } from './index';
import { createRepo } from './repo';

const profile: Profile = {
  goal: 'muscle',
  level: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 45,
};
const equipment = [
  { id: 'bands', kind: 'band' as const, levels: ['light' as const, 'medium' as const] },
];

let db: WorkoutDatabase;
function setup() {
  db = new WorkoutDatabase(`test-${Math.random().toString(36).slice(2)}`);
  return createRepo(db);
}
afterEach(async () => {
  await db.delete();
});

describe('repo', () => {
  it('returns defaults before anything is saved', async () => {
    const repo = setup();
    expect(await repo.getProfile()).toBeUndefined();
    expect(await repo.getActiveProgramme()).toBeUndefined();
    expect(await repo.getSettings('fr')).toMatchObject({ language: 'fr', theme: 'system' });
  });

  it('completes setup in one go', async () => {
    const repo = setup();
    const programme = generateProgramme({ profile, equipment });
    const stored = await repo.completeSetup(
      profile,
      equipment,
      programme,
      new Date('2026-11-12T10:00:00Z'),
    );
    expect(await repo.getProfile()).toEqual(profile);
    expect(await repo.getEquipment()).toEqual(equipment);
    expect((await repo.getActiveProgramme())?.id).toBe(stored.id);
    expect(stored.createdAt).toBe('2026-11-12T10:00:00.000Z');
  });

  it('keeps one active programme and archives the previous one', async () => {
    const repo = setup();
    const first = await repo.activateProgramme(
      generateProgramme({ profile, equipment }),
      new Date(1),
    );
    const second = await repo.activateProgramme(
      generateProgramme({ profile, equipment }),
      new Date(2),
    );
    expect(second.id).not.toBe(first.id);
    expect((await repo.getActiveProgramme())?.id).toBe(second.id);
    expect((await db.programmes.get(first.id))?.status).toBe('archived');
  });

  it('replaces the whole inventory', async () => {
    const repo = setup();
    await repo.replaceEquipment(equipment);
    await repo.replaceEquipment([]);
    expect(await repo.getEquipment()).toEqual([]);
  });
});
