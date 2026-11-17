import { afterEach, describe, expect, it } from 'vitest';
import type { Profile } from '../domain';
import { asPlanned, generateProgramme, playSteps, sessionForWeek, setLogBase } from '../engine';
import { SessionLogSchema, type SetLog } from '../domain';
import { WorkoutDatabase } from './index';
import { createRepo, OpenSessionError } from './repo';

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

describe('session logs', () => {
  const programme = generateProgramme({ profile, equipment });
  const template = programme.rotation[0]!;
  const plan = sessionForWeek(programme, template.id, 1).session;
  const source = {
    kind: 'programme' as const,
    programmeId: 'p1',
    week: 1,
    sessionId: template.id,
  };
  const steps = playSteps(plan);
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 12, 10, minute));
  const performed = (index: number, reps?: number): SetLog => {
    const actual = asPlanned(steps[index]!.planned) ?? { reps: 8 };
    return {
      ...setLogBase(steps[index]!),
      actual: reps === undefined ? actual : { ...actual, reps },
      feel: 'right',
      at: at(index).toISOString(),
    };
  };

  it('opens one session at a time', async () => {
    const repo = setup();
    const log = await repo.startSession({ source, plan }, at(0));
    expect(await repo.getOpenSession()).toEqual(log);
    await expect(repo.startSession({ source: { kind: 'quick' }, plan })).rejects.toBeInstanceOf(
      OpenSessionError,
    );
  });

  it('records sets, replacing a set logged twice in place', async () => {
    const repo = setup();
    const { id } = await repo.startSession({ source, plan }, at(0));
    await repo.logSets(id, [performed(0), performed(1)]);
    await repo.logSets(id, [performed(0, 3)]);
    const sets = (await repo.getOpenSession())!.sets;
    expect(sets).toHaveLength(2);
    expect(sets[0]!.actual?.reps).toBe(3);
  });

  it('adds up pauses, including one left running when the session ends', async () => {
    const repo = setup();
    const { id } = await repo.startSession({ source, plan }, at(0));
    await repo.pauseSession(id, at(10));
    await repo.pauseSession(id, at(11)); // already paused: unchanged
    await repo.resumeSession(id, at(15));
    await repo.resumeSession(id, at(20), at(18)); // closed without a pause: counted from `since`
    await repo.logSets(id, [performed(0)]);
    await repo.pauseSession(id, at(30));
    await repo.finishSession(id, { endedEarly: true, countsAsDone: false }, at(40));
    const log = (await repo.listSessionLogs())[0]!;
    expect(log).toMatchObject({
      status: 'completed',
      pausedSec: (5 + 2 + 10) * 60,
      endedEarly: true,
      countsAsDone: false,
      endedAt: at(40).toISOString(),
    });
    expect(log.pausedAt).toBeUndefined();
    expect(SessionLogSchema.parse(log)).toEqual(log);
    await repo.setCountsAsDone(id, true);
    expect((await repo.listSessionLogs())[0]!.countsAsDone).toBe(true);
    await expect(repo.logSets(id, [performed(1)])).rejects.toThrow(/not open/);
  });

  it('abandons: keeps logged sets, deletes an empty session', async () => {
    const repo = setup();
    const empty = await repo.startSession({ source, plan }, at(0));
    await repo.abandonSession(empty.id, at(1));
    expect(await repo.listSessionLogs()).toEqual([]);
    const { id } = await repo.startSession({ source, plan }, at(2));
    await repo.logSets(id, [performed(0)]);
    await repo.abandonSession(id, at(3));
    expect(await repo.listSessionLogs()).toMatchObject([{ id, status: 'abandoned' }]);
    expect(await repo.getOpenSession()).toBeUndefined();
  });

  it('fills settings added later with their default', async () => {
    const repo = setup();
    await db.settings.put({
      id: 'settings',
      language: 'en',
      theme: 'dark',
      voice: false,
      sounds: true,
      vibration: true,
    } as never);
    expect(await repo.getSettings('fr')).toMatchObject({
      language: 'en',
      voice: false,
      restDisplay: 'takeover',
    });
  });
});

describe("sessions of the user's own", () => {
  it('saves, places, keeps in sync and deletes', async () => {
    const repo = setup();
    const stored = await repo.completeSetup(
      profile,
      equipment,
      generateProgramme({ profile, equipment }),
    );
    const generated = stored.rotation[0]!;
    const { id: _, ...draft } = { ...generated, name: { fr: 'Ma séance', en: 'My session' } };
    const own = await repo.saveCustomSession(draft, new Date('2026-11-16T10:00:00Z'));
    expect(own.id).toMatch(/^own-/);
    expect((await repo.listCustomSessions()).map((s) => s.id)).toEqual([own.id]);

    await repo.placeCustomSession(stored.id, generated.id, own.id);
    let active = (await repo.getActiveProgramme())!;
    expect(active.placements).toEqual({ [generated.id]: own.id });
    expect(active.rotation[0]!.name.en).toBe('My session');

    await repo.saveCustomSession({ ...own, name: { fr: 'Poussée', en: 'Push day' } });
    active = (await repo.getActiveProgramme())!;
    expect(active.rotation[0]!.name.en).toBe('Push day');

    await repo.deleteCustomSession(own.id);
    active = (await repo.getActiveProgramme())!;
    expect(active.placements).toBeUndefined();
    expect(active.rotation[0]).toEqual(generated);
    expect(await repo.listCustomSessions()).toEqual([]);
  });

  it('stores an edit of a programme session and resets it', async () => {
    const repo = setup();
    const stored = await repo.completeSetup(
      profile,
      equipment,
      generateProgramme({ profile, equipment }),
    );
    const session = stored.rotation[0]!;
    await repo.saveProgrammeSession(stored.id, { ...session, main: session.main.slice(1) });
    let active = (await repo.getActiveProgramme())!;
    expect(active.rotation[0]!.main).toHaveLength(session.main.length - 1);
    expect(active.generatedRotation?.[0]).toEqual(session);
    await repo.resetProgrammeSession(stored.id, session.id);
    active = (await repo.getActiveProgramme())!;
    expect(active.rotation[0]).toEqual(session);
    expect(active.generatedRotation).toBeUndefined();
  });
});
