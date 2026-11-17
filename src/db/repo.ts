import {
  setLogKey,
  type Answer,
  type EquipmentInventory,
  type Language,
  type LiveClock,
  type Profile,
  type Programme,
  type ProgressionNote,
  type Session,
  type SessionLog,
  type SessionSource,
  type Settings,
  type SetAdjustments,
  type SetLog,
} from '../domain';
import {
  placeSession,
  placesOf,
  removePlacements,
  resetSession,
  saveSessionEdit,
  syncPlacements,
} from '../engine/edit';
import {
  db as defaultDb,
  type CustomSessionRecord,
  type ProgrammeRecord,
  type WorkoutDatabase,
} from './index';

export function defaultSettings(language: Language): Settings {
  return {
    language,
    theme: 'system',
    voice: true,
    sounds: true,
    vibration: true,
    restDisplay: 'takeover',
  };
}

/** Only one session can be open at a time. */
export class OpenSessionError extends Error {
  constructor(readonly openId: string) {
    super('another session is already open');
  }
}

export function createRepo(db: WorkoutDatabase = defaultDb) {
  async function getProfile(): Promise<Profile | undefined> {
    const record = await db.profile.get('me');
    return record && withoutId(record);
  }

  async function saveProfile(profile: Profile): Promise<void> {
    await db.profile.put({ ...profile, id: 'me' });
  }

  async function getSettings(fallbackLanguage: Language): Promise<Settings> {
    const record = await db.settings.get('settings');
    // Settings added later get their default until they are saved.
    return { ...defaultSettings(fallbackLanguage), ...(record && withoutId(record)) };
  }

  async function saveSettings(settings: Settings): Promise<void> {
    await db.settings.put({ ...settings, id: 'settings' });
  }

  function getEquipment(): Promise<EquipmentInventory> {
    return db.equipment.toArray();
  }

  /** The inventory is edited as a whole, so it is stored as a whole. */
  async function replaceEquipment(items: EquipmentInventory): Promise<void> {
    await db.transaction('rw', db.equipment, async () => {
      await db.equipment.clear();
      await db.equipment.bulkPut(items);
    });
  }

  function getActiveProgramme(): Promise<ProgrammeRecord | undefined> {
    return db.programmes.where('status').equals('active').first();
  }

  /** Every programme, archived ones included: their logs still count. */
  function listProgrammes(): Promise<ProgrammeRecord[]> {
    return db.programmes.toArray();
  }

  /**
   * Makes `programme` the active one. The previous programme is kept as archived,
   * not deleted, so its history stays available.
   */
  async function activateProgramme(
    programme: Programme,
    now = new Date(),
  ): Promise<ProgrammeRecord> {
    const record: ProgrammeRecord = {
      ...programme,
      id: programmeId(programme, now),
      createdAt: programme.createdAt ?? now.toISOString(),
      status: 'active',
    };
    await db.transaction('rw', db.programmes, async () => {
      await db.programmes.where('status').equals('active').modify({ status: 'archived' });
      await db.programmes.put(record);
    });
    return record;
  }

  async function markWhySeen(programmeId: string): Promise<void> {
    await db.programmes.update(programmeId, { whySeen: true });
  }

  /** Profile, equipment and first programme are written together, so a half-finished setup never sticks. */
  function completeSetup(
    profile: Profile,
    equipment: EquipmentInventory,
    programme: Programme,
    now = new Date(),
  ): Promise<ProgrammeRecord> {
    return db.transaction('rw', [db.profile, db.equipment, db.programmes], async () => {
      await saveProfile(profile);
      await replaceEquipment(equipment);
      return activateProgramme(programme, now);
    });
  }

  function getOpenSession(): Promise<SessionLog | undefined> {
    return db.sessionLogs.where('status').equals('in-progress').first();
  }

  function getSessionLog(id: string): Promise<SessionLog | undefined> {
    return db.sessionLogs.get(id);
  }

  function listSessionLogs(): Promise<SessionLog[]> {
    return db.sessionLogs.orderBy('startedAt').toArray();
  }

  /** Opens a session log with a snapshot of the plan. Throws `OpenSessionError` if one is already open. */
  function startSession(
    {
      source,
      plan,
      adjustments,
      progression,
    }: {
      source: SessionSource;
      plan: Session;
      adjustments?: SetAdjustments;
      progression?: Record<string, ProgressionNote>;
    },
    now = new Date(),
  ): Promise<SessionLog> {
    return db.transaction('rw', db.sessionLogs, async () => {
      const open = await getOpenSession();
      if (open) throw new OpenSessionError(open.id);
      const log: SessionLog = {
        id: newLogId(now),
        source,
        plan,
        ...(adjustments && { adjustments }),
        ...(progression && Object.keys(progression).length > 0 && { progression }),
        status: 'in-progress',
        startedAt: now.toISOString(),
        sets: [],
      };
      await db.sessionLogs.add(log);
      return log;
    });
  }

  /** Changes an open session inside one transaction. */
  function changeOpen(id: string, change: (log: SessionLog) => SessionLog | null) {
    return db.transaction('rw', db.sessionLogs, async () => {
      const log = await db.sessionLogs.get(id);
      if (!log || log.status !== 'in-progress') throw new Error(`session ${id} is not open`);
      const next = change(log);
      if (next) await db.sessionLogs.put(next);
      else await db.sessionLogs.delete(id);
    });
  }

  /**
   * Records sets; a set logged again replaces its earlier record in place.
   * `live` is the player clock after these sets (null clears it, undefined leaves it).
   */
  function logSets(id: string, sets: readonly SetLog[], live?: LiveClock | null): Promise<void> {
    return changeOpen(id, (current) => {
      const log = live === undefined ? current : withLive(current, live);
      const incoming = new Map(sets.map((set) => [setLogKey(set), set]));
      const kept = log.sets.map((set) => {
        const key = setLogKey(set);
        const replacement = incoming.get(key);
        incoming.delete(key);
        return replacement ?? set;
      });
      return { ...log, sets: [...kept, ...incoming.values()] };
    });
  }

  function setLive(id: string, live: LiveClock | null): Promise<void> {
    return changeOpen(id, (log) => withLive(log, live));
  }

  function pauseSession(id: string, now = new Date()): Promise<void> {
    return changeOpen(id, (log) => (log.pausedAt ? log : { ...log, pausedAt: now.toISOString() }));
  }

  /** Ends a running pause, `since` a given time when the app was closed without one. */
  function resumeSession(id: string, now = new Date(), since?: Date): Promise<void> {
    return changeOpen(id, (log) => {
      const pausedAt = log.pausedAt ? new Date(log.pausedAt) : since;
      return pausedAt ? withPauseOver(log, pausedAt, now) : log;
    });
  }

  function finishSession(
    id: string,
    outcome: { endedEarly: boolean; countsAsDone: boolean },
    now = new Date(),
  ): Promise<void> {
    return changeOpen(id, (log) => ({
      ...endPause(withLive(log, null), now),
      status: 'completed',
      endedAt: now.toISOString(),
      ...(outcome.endedEarly && { endedEarly: true }),
      countsAsDone: outcome.countsAsDone,
    }));
  }

  /** The summary's "counts as done" switch, after the session has ended. */
  async function setCountsAsDone(id: string, countsAsDone: boolean): Promise<void> {
    await db.transaction('rw', db.sessionLogs, async () => {
      const log = await db.sessionLogs.get(id);
      if (!log || log.status !== 'completed') throw new Error(`session ${id} is not completed`);
      await db.sessionLogs.put({ ...log, countsAsDone });
    });
  }

  /** Keeps what was logged without moving the rotation on; a session with nothing logged is deleted. */
  function abandonSession(id: string, now = new Date()): Promise<void> {
    return changeOpen(id, (log) =>
      log.sets.length === 0
        ? null
        : {
            ...endPause(withLive(log, null), now),
            status: 'abandoned',
            endedAt: now.toISOString(),
          },
    );
  }

  /** The user's own sessions, most recently changed first. */
  function listCustomSessions(): Promise<CustomSessionRecord[]> {
    return db.customSessions.orderBy('updatedAt').reverse().toArray();
  }

  function getCustomSession(id: string): Promise<CustomSessionRecord | undefined> {
    return db.customSessions.get(id);
  }

  /**
   * Saves one of the user's own sessions (a new one gets an id); wherever the active programme
   * runs it, the programme gets the new version too.
   */
  function saveCustomSession(
    session: Omit<Session, 'id'> & { id?: string; base?: Session; updatedAt?: string },
    now = new Date(),
  ): Promise<CustomSessionRecord> {
    return db.transaction('rw', [db.customSessions, db.programmes], async () => {
      const id = session.id ?? `own-${newLogId(now)}`;
      // What it was copied from stays, whatever the caller kept of the record.
      const base =
        session.base ?? (session.id ? (await db.customSessions.get(id))?.base : undefined);
      const record: CustomSessionRecord = {
        ...withoutUpdatedAt({ ...session, id, updatedAt: '' }),
        id,
        updatedAt: now.toISOString(),
        ...(base && { base }),
      };
      await db.customSessions.put(record);
      const active = await getActiveProgramme();
      if (active && placesOf(active, record.id).length > 0)
        await db.programmes.put(syncPlacements(active, withoutUpdatedAt(record)));
      return record;
    });
  }

  /** Deletes one of the user's own sessions; the programme gets back what it replaced. */
  function deleteCustomSession(id: string): Promise<void> {
    return db.transaction('rw', [db.customSessions, db.programmes], async () => {
      await db.customSessions.delete(id);
      const active = await getActiveProgramme();
      if (active && placesOf(active, id).length > 0)
        await db.programmes.put(removePlacements(active, id));
    });
  }

  /** Changes the active programme in one transaction. */
  function changeProgramme(
    programmeId: string,
    change: (programme: ProgrammeRecord) => ProgrammeRecord,
  ): Promise<void> {
    return db.transaction('rw', db.programmes, async () => {
      const programme = await db.programmes.get(programmeId);
      if (!programme) throw new Error(`no programme ${programmeId}`);
      await db.programmes.put(change(programme));
    });
  }

  /** The user's version of a programme session, for the whole cycle. */
  function saveProgrammeSession(programmeId: string, session: Session): Promise<void> {
    return changeProgramme(programmeId, (p) => saveSessionEdit(p, session));
  }

  /** A programme session back to how it was generated (or out of the programme, for a placed one). */
  function resetProgrammeSession(programmeId: string, sessionId: string): Promise<void> {
    return changeProgramme(programmeId, (p) => resetSession(p, sessionId));
  }

  /** Runs one of the user's own sessions in place of a programme session. */
  function placeCustomSession(
    programmeId: string,
    sessionId: string,
    customId: string,
  ): Promise<void> {
    return db.transaction('rw', [db.customSessions, db.programmes], async () => {
      const custom = await db.customSessions.get(customId);
      if (!custom) throw new Error(`no session ${customId}`);
      const programme = await db.programmes.get(programmeId);
      if (!programme) throw new Error(`no programme ${programmeId}`);
      await db.programmes.put(placeSession(programme, sessionId, withoutUpdatedAt(custom)));
    });
  }

  /** Every answer to a proposal, oldest first. */
  function listAnswers(): Promise<Answer[]> {
    return db.answers.orderBy('at').toArray();
  }

  async function saveAnswer(answer: Omit<Answer, 'id' | 'at'>, now = new Date()): Promise<Answer> {
    const record = { ...answer, id: newLogId(now), at: now.toISOString() } as Answer;
    await db.answers.add(record);
    return record;
  }

  /** Undo: the answer never happened. */
  async function deleteAnswer(id: string): Promise<void> {
    await db.answers.delete(id);
  }

  return {
    getProfile,
    saveProfile,
    getSettings,
    saveSettings,
    getEquipment,
    replaceEquipment,
    getActiveProgramme,
    activateProgramme,
    markWhySeen,
    completeSetup,
    getOpenSession,
    getSessionLog,
    listSessionLogs,
    startSession,
    logSets,
    setLive,
    pauseSession,
    resumeSession,
    finishSession,
    setCountsAsDone,
    abandonSession,
    listProgrammes,
    listAnswers,
    saveAnswer,
    deleteAnswer,
    listCustomSessions,
    getCustomSession,
    saveCustomSession,
    deleteCustomSession,
    saveProgrammeSession,
    resetProgrammeSession,
    placeCustomSession,
  };
}

/** The session itself, without what the record keeps around it. */
function withoutUpdatedAt(record: CustomSessionRecord): Session {
  const copy: Partial<CustomSessionRecord> = { ...record };
  delete copy.updatedAt;
  delete copy.base;
  return copy as Session;
}

/** Unique enough for one device; `crypto.randomUUID` is missing outside secure contexts (LAN dev server). */
const newLogId = (now: Date) =>
  `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function withPauseOver(log: SessionLog, pausedAt: Date, now: Date): SessionLog {
  const copy = { ...log };
  delete copy.pausedAt;
  const seconds = Math.max(0, Math.round((now.getTime() - pausedAt.getTime()) / 1000));
  return { ...copy, pausedSec: (log.pausedSec ?? 0) + seconds };
}

function withLive(log: SessionLog, live: LiveClock | null): SessionLog {
  const copy = { ...log };
  delete copy.live;
  return live ? { ...copy, live } : copy;
}

const endPause = (log: SessionLog, now: Date): SessionLog =>
  log.pausedAt ? withPauseOver(log, new Date(log.pausedAt), now) : log;

/** Singleton records carry a fixed key that is not part of the domain object. */
function withoutId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...record };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

/** Generated ids describe the inputs, so the same inputs give the same id; stored ids must be unique. */
function programmeId(programme: Programme, now: Date): string {
  return `${programme.id}-${now.getTime().toString(36)}`;
}

export type Repo = ReturnType<typeof createRepo>;
export const repo = createRepo();
