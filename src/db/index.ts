import Dexie, { type EntityTable } from 'dexie';
import type {
  Answer,
  CheckIn,
  DateTimeSchema,
  EquipmentItem,
  MaxTest,
  Profile,
  Programme,
  Session,
  SessionLog,
  Settings,
} from '../domain';
import type { z } from 'zod';

type DateTime = z.infer<typeof DateTimeSchema>;

export type ProfileRecord = Profile & { id: 'me' };
export type SettingsRecord = Settings & { id: 'settings' };
export type ProgrammeRecord = Programme & {
  status: 'active' | 'completed' | 'archived';
  startedAt?: DateTime;
  /** The one-time "why this programme" card was dismissed. */
  whySeen?: boolean;
  /** When it was finished (`completed`) or replaced (`archived`). */
  endedAt?: DateTime;
  /** The finished programme this one continues, as its next cycle. */
  previousId?: string;
  /** When its cycle review was first seen. */
  reviewSeenAt?: DateTime;
};
/**
 * A session of the user's own. `base`: what it started from when it was copied (a programme
 * session, a quick session), so checks only flag what the user changed.
 */
export type CustomSessionRecord = Session & { updatedAt: DateTime; base?: Session };

export class WorkoutDatabase extends Dexie {
  profile!: EntityTable<ProfileRecord, 'id'>;
  settings!: EntityTable<SettingsRecord, 'id'>;
  equipment!: EntityTable<EquipmentItem, 'id'>;
  programmes!: EntityTable<ProgrammeRecord, 'id'>;
  customSessions!: EntityTable<CustomSessionRecord, 'id'>;
  sessionLogs!: EntityTable<SessionLog, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  maxTests!: EntityTable<MaxTest, 'id'>;
  answers!: EntityTable<Answer, 'id'>;

  constructor(name = 'easy-workout') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      equipment: 'id, kind',
      programmes: 'id, status',
      customSessions: 'id, updatedAt',
      sessionLogs: 'id, startedAt, status',
      checkIns: 'id, date',
      maxTests: 'id, date, exerciseId',
    });
    this.version(2).stores({ answers: 'id, exerciseId, at' });
  }
}

export const db = new WorkoutDatabase();
