import type {
  EquipmentInventory,
  JointRegion,
  Language,
  Profile,
  Programme,
  Settings,
  Weekday,
} from '../domain';
import { createRepo } from './repo';
import { db as defaultDb, type ProgrammeRecord, type WorkoutDatabase } from './index';

/** What the profile keeps about avoided joints, noise and space. */
export type ConstraintFields = Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'>;

/** Settings that are removed rather than set to a value. */
type Clearable = 'trainingDays' | 'pause' | 'travelKit';

/** The record keeps what the programme itself does not carry. */
const META = ['status', 'startedAt', 'whySeen', 'endedAt', 'previousId', 'reviewSeenAt'] as const;

export function createConstraints(db: WorkoutDatabase = defaultDb) {
  const repo = createRepo(db);

  async function patchSettings(
    change: Partial<Settings>,
    clear: readonly Clearable[] = [],
    language: Language = 'en',
  ): Promise<void> {
    await db.transaction('rw', db.settings, async () => {
      const next: Settings = { ...(await repo.getSettings(language)), ...change };
      for (const key of clear) delete next[key];
      await repo.saveSettings(next);
    });
  }

  /**
   * Saves joints, quiet and small space on the profile and, when given, the re-picked programme
   * under the same id: its position and logs stay valid. One transaction, so a failure changes
   * nothing. Constraints that are off are removed rather than stored as false.
   */
  function saveConstraints(fields: ConstraintFields, programme?: Programme): Promise<void> {
    return db.transaction('rw', [db.profile, db.programmes], async () => {
      const profile = await repo.getProfile();
      if (!profile) throw new Error('no profile');
      const { limitations: _l, quiet: _q, smallSpace: _s, ...rest } = profile;
      await repo.saveProfile({
        ...rest,
        ...(fields.limitations && fields.limitations.length > 0
          ? { limitations: fields.limitations }
          : {}),
        ...(fields.quiet ? { quiet: true } : {}),
        ...(fields.smallSpace ? { smallSpace: true } : {}),
      });
      if (!programme) return;
      const record = await db.programmes.get(programme.id);
      if (!record) throw new Error(`no programme ${programme.id}`);
      const meta = Object.fromEntries(META.filter((k) => k in record).map((k) => [k, record[k]]));
      await db.programmes.put({ ...programme, ...meta } as ProgrammeRecord);
    });
  }

  /**
   * "Yes, keep it" on the review card: the joint is asked about again six weeks from `at`.
   * `undefined` takes the stamp away again (Undo).
   */
  function setLimitationReviewedAt(
    region: JointRegion,
    at: Date | string | undefined,
  ): Promise<void> {
    const stamp = at instanceof Date ? at.toISOString() : at;
    return db.transaction('rw', db.profile, async () => {
      const profile = await repo.getProfile();
      if (!profile?.limitations) return;
      await repo.saveProfile({
        ...profile,
        limitations: profile.limitations.map((l) => {
          if (l.region !== region || l.liftedAt) return l;
          const { reviewedAt: _r, ...rest } = l;
          return stamp === undefined ? rest : { ...rest, reviewedAt: stamp };
        }),
      });
    });
  }

  /** Days the user trains on; empty clears them. */
  function setTrainingDays(days: readonly Weekday[], language?: Language): Promise<void> {
    return days.length > 0
      ? patchSettings({ trainingDays: [...days] }, [], language)
      : patchSettings({}, ['trainingDays'], language);
  }

  /** Programme paused since `now`; a pause already running keeps its start. */
  async function pauseProgramme(now = new Date(), language?: Language): Promise<void> {
    const settings = await repo.getSettings(language ?? 'en');
    if (settings.pause) return;
    await patchSettings({ pause: { since: now.toISOString() } }, [], language);
  }

  /**
   * Back to the rotation. The days that went by while paused were not missed: the "still next"
   * line starts counting again from `now`.
   */
  async function resumeProgramme(language?: Language, now = new Date()): Promise<void> {
    const settings = await repo.getSettings(language ?? 'en');
    if (!settings.pause) return;
    await patchSettings({ missedDayDismissedAt: now.toISOString() }, ['pause'], language);
  }

  /** The kit applies from now until the end of `until` (`YYYY-MM-DD`). */
  function startTravelKit(
    equipment: EquipmentInventory,
    until: string,
    language?: Language,
  ): Promise<void> {
    return patchSettings({ travelKit: { equipment, until } }, [], language);
  }

  /** Back to the home equipment now. */
  function endTravelKit(language?: Language): Promise<void> {
    return patchSettings({}, ['travelKit'], language);
  }

  return {
    saveConstraints,
    setLimitationReviewedAt,
    setTrainingDays,
    pauseProgramme,
    resumeProgramme,
    startTravelKit,
    endTravelKit,
  };
}

export type Constraints = ReturnType<typeof createConstraints>;
export const constraintsRepo = createConstraints();
