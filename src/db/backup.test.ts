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

async function withProgressRecords() {
  const db = await populated();
  const repo = createRepo(db);
  const programme = (await repo.getActiveProgramme())!;
  const next = await repo.startNextCycle(
    programme.id,
    generateProgramme({ profile, equipment }),
    new Date('2026-12-01T09:00:00Z'),
  );
  const log = (await repo.listSessionLogs())[0]!;
  await db.sessionLogs.put({
    ...log,
    test: { exerciseId: 'push-up', kind: 'reps', placement: 'end', outcome: 'done' },
  });
  await repo.saveCheckIn({
    date: '2026-11-10',
    weightKg: 80.5,
    waistCm: 85,
    sleepHours: 7.5,
    notes: 'ok',
  });
  await repo.saveMaxTest({
    id: 'mt1',
    date: '2026-11-14',
    at: '2026-11-14T08:30:00.000Z',
    exerciseId: 'push-up',
    context: 'session',
    logId: log.id,
    programmeId: programme.id,
    result: { kind: 'reps', reps: 22 },
    load: { kind: 'added-kg', kg: 5, implement: 'weight-vest' },
  });
  await repo.saveSettings({
    ...(await repo.getSettings('fr')),
    checkInPrompt: false,
    checkInDismissedAt: '2026-11-12T08:00:00.000Z',
  });
  return { db, next };
}

describe('backup', () => {
  it('round-trips check-ins, tests, cycles and check-in settings', async () => {
    const { db: source, next } = await withProgressRecords();
    const file = await exportBackup(source, new Date('2026-12-02T09:00:00Z'));
    const parsed = parseBackup(JSON.parse(JSON.stringify(file)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { data } = parsed.backup;
    expect(data.checkIns).toHaveLength(1);
    expect(data.maxTests[0]).toMatchObject({ context: 'session', programmeId: expect.any(String) });
    expect(data.sessionLogs[0]!.test).toMatchObject({ outcome: 'done' });
    expect(data.programmes.find((p) => p.id === next.id)).toMatchObject({
      previousId: expect.any(String),
    });
    expect(data.programmes.some((p) => p.status === 'completed' && p.endedAt)).toBe(true);
    expect(data.settings).toMatchObject({
      checkInPrompt: false,
      checkInDismissedAt: '2026-11-12T08:00:00.000Z',
    });
    const { db: target } = fresh();
    await importBackup(parsed.backup, target);
    expect(await exportBackup(target, new Date('2026-12-02T09:00:00Z'))).toEqual(parsed.backup);
  });

  it('still imports a version 3 file', async () => {
    const file = await exportBackup(await populated());
    const old = JSON.parse(JSON.stringify({ ...file, schemaVersion: 3 }));
    const parsed = parseBackup(old);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

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
