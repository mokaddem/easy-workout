import { afterEach, describe, expect, it } from 'vitest';
import type { Profile } from '../domain';
import { asPlanned, generateProgramme, playSteps, sessionForWeek, setLogBase } from '../engine';
import { BACKUP_SCHEMA_VERSION, exportBackup, importBackup, parseBackup } from './backup';
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

const databases: WorkoutDatabase[] = [];
function fresh() {
  const db = new WorkoutDatabase(`test-${Math.random().toString(36).slice(2)}`);
  databases.push(db);
  return { db, repo: createRepo(db) };
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

async function populated() {
  const { db, repo } = fresh();
  const programme = await repo.completeSetup(
    profile,
    equipment,
    generateProgramme({ profile, equipment }),
  );
  // An old settings record, saved before a setting existed.
  await db.settings.put({
    id: 'settings',
    language: 'fr',
    theme: 'dark',
    voice: true,
    sounds: false,
    vibration: true,
  } as never);
  const plan = sessionForWeek(programme, programme.rotation[0]!.id, 1).session;
  const log = await repo.startSession({
    source: {
      kind: 'programme',
      programmeId: programme.id,
      week: 1,
      sessionId: programme.rotation[0]!.id,
    },
    plan,
  });
  const step = playSteps(plan)[0]!;
  await repo.logSets(log.id, [
    {
      ...setLogBase(step),
      actual: asPlanned(step.planned) ?? { reps: 5 },
      at: '2026-11-14T08:00:00Z',
    },
  ]);
  await repo.finishSession(log.id, { endedEarly: true, countsAsDone: false });
  // An edited session, and a session of the user's own copied from another one and placed.
  const [first, second] = programme.rotation;
  await repo.saveProgrammeSession(programme.id, { ...first!, main: first!.main.slice(1) });
  const { id: _, ...copy } = second!;
  const own = await repo.saveCustomSession({ ...copy, base: second! });
  await repo.placeCustomSession(programme.id, second!.id, own.id);
  return db;
}

describe('backup', () => {
  it('round-trips everything through a JSON file', async () => {
    const source = await populated();
    const file = await exportBackup(source, new Date('2026-11-14T09:00:00Z'));
    const parsed = parseBackup(JSON.parse(JSON.stringify(file)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toMatchObject({ programmes: 1, sessions: 1, equipment: 1 });
    expect(parsed.backup.data.settings).toMatchObject({ theme: 'dark', restDisplay: 'takeover' });

    const { db: target, repo } = fresh();
    await repo.replaceEquipment([]);
    await target.checkIns.put({ id: 'old', date: '2026-01-01', weightKg: 80 });
    await importBackup(parsed.backup, target);
    expect(await target.checkIns.count()).toBe(0);
    const again = await exportBackup(target, new Date('2026-11-14T09:00:00Z'));
    expect(again).toEqual(parsed.backup);
  });

  it('refuses files that are not backups, newer versions and broken data', async () => {
    expect(parseBackup({ hello: 'world' })).toEqual({ ok: false, reason: 'not-a-backup' });
    const file = await exportBackup(await populated());
    expect(parseBackup({ ...file, schemaVersion: BACKUP_SCHEMA_VERSION + 1 })).toEqual({
      ok: false,
      reason: 'newer-version',
    });
    const broken = { ...file, data: { ...file.data, sessionLogs: [{ id: 'x' }] } };
    expect(parseBackup(JSON.parse(JSON.stringify(broken)))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
