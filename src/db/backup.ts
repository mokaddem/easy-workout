import { z } from 'zod';
import {
  AnswerSchema,
  CheckInSchema,
  DateTimeSchema,
  EquipmentItemSchema,
  MaxTestSchema,
  ProfileSchema,
  ProgrammeSchema,
  SessionLogSchema,
  SessionSchema,
  SettingsSchema,
} from '../domain';
import { db as defaultDb, type ProgrammeRecord, type WorkoutDatabase } from './index';
import { defaultSettings } from './repo';

export const BACKUP_FORMAT = 'easy-workout-backup';
/** Raised whenever the stored shape changes; older files are migrated on import. */
export const BACKUP_SCHEMA_VERSION = 3;

const ProgrammeRecordSchema = z
  .looseObject({
    status: z.enum(['active', 'completed', 'archived']),
    startedAt: DateTimeSchema.optional(),
    whySeen: z.boolean().optional(),
  })
  .transform((record, ctx) => {
    const { status, startedAt, whySeen, ...programme } = record;
    const parsed = ProgrammeSchema.safeParse(programme);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, code: 'custom' });
      return z.NEVER;
    }
    const result: ProgrammeRecord = {
      ...parsed.data,
      status,
      ...(startedAt && { startedAt }),
      ...(whySeen !== undefined && { whySeen }),
    };
    return result;
  });

const BackupDataSchema = z.strictObject({
  profile: ProfileSchema.nullable(),
  settings: SettingsSchema.nullable(),
  equipment: z.array(EquipmentItemSchema),
  programmes: z.array(ProgrammeRecordSchema),
  customSessions: z.array(
    SessionSchema.extend({ updatedAt: DateTimeSchema, base: SessionSchema.optional() }),
  ),
  sessionLogs: z.array(SessionLogSchema),
  checkIns: z.array(CheckInSchema),
  maxTests: z.array(MaxTestSchema),
  answers: z.array(AnswerSchema),
});
export type BackupData = z.infer<typeof BackupDataSchema>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

/** Everything the app stores, as one file. */
export async function exportBackup(
  db: WorkoutDatabase = defaultDb,
  now = new Date(),
): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const profile = await db.profile.get('me');
    const settings = await db.settings.get('settings');
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      data: {
        profile: profile ? withoutKey(profile) : null,
        // Settings added after the record was saved get their default, as when the app reads them.
        settings: settings
          ? { ...defaultSettings(settings.language), ...withoutKey(settings) }
          : null,
        equipment: await db.equipment.toArray(),
        programmes: await db.programmes.toArray(),
        customSessions: await db.customSessions.toArray(),
        sessionLogs: await db.sessionLogs.orderBy('startedAt').toArray(),
        checkIns: await db.checkIns.toArray(),
        maxTests: await db.maxTests.toArray(),
        answers: await db.answers.orderBy('at').toArray(),
      },
    };
  });
}

export interface BackupSummary {
  exportedAt: string;
  programmes: number;
  sessions: number;
  equipment: number;
  checkIns: number;
  maxTests: number;
  /** Start of the most recent session in the file. */
  lastSessionAt?: string;
}

export type ParsedBackup =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; reason: 'not-a-backup' | 'newer-version' | 'invalid' };

/** Older files are brought up to the current shape here, one version at a time. */
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  /** Version 2 keeps the answers to proposals about exercises. */
  1: (data) => (data && typeof data === 'object' ? { answers: [], ...data } : data),
  /** Version 3 adds edited and replaced programme sessions; earlier files have none. */
  2: (data) => data,
};

/** Checks a file read from disk before anything is replaced. */
export function parseBackup(raw: unknown): ParsedBackup {
  const head = z
    .looseObject({
      format: z.literal(BACKUP_FORMAT),
      schemaVersion: z.number().int().min(1),
      exportedAt: DateTimeSchema,
      data: z.unknown(),
    })
    .safeParse(raw);
  if (!head.success) return { ok: false, reason: 'not-a-backup' };
  const { schemaVersion, exportedAt } = head.data;
  if (schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, reason: 'newer-version' };
  let data = head.data.data;
  for (let version = schemaVersion; version < BACKUP_SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return { ok: false, reason: 'invalid' };
    data = migrate(data);
  }
  const parsed = BackupDataSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: parsed.data,
  };
  return { ok: true, backup, summary: summarise(backup) };
}

export function summarise(backup: BackupFile): BackupSummary {
  const { data } = backup;
  const last = data.sessionLogs.reduce<string | undefined>(
    (latest, log) => (!latest || log.startedAt > latest ? log.startedAt : latest),
    undefined,
  );
  return {
    exportedAt: backup.exportedAt,
    programmes: data.programmes.length,
    sessions: data.sessionLogs.length,
    equipment: data.equipment.length,
    checkIns: data.checkIns.length,
    maxTests: data.maxTests.length,
    ...(last && { lastSessionAt: last }),
  };
}

/** Replaces everything stored with the file's content, in one transaction. */
export async function importBackup(
  backup: BackupFile,
  db: WorkoutDatabase = defaultDb,
): Promise<void> {
  const { data } = backup;
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    if (data.profile) await db.profile.put({ ...data.profile, id: 'me' });
    if (data.settings) await db.settings.put({ ...data.settings, id: 'settings' });
    await db.equipment.bulkPut(data.equipment);
    await db.programmes.bulkPut(data.programmes);
    await db.customSessions.bulkPut(data.customSessions);
    await db.sessionLogs.bulkPut(data.sessionLogs);
    await db.checkIns.bulkPut(data.checkIns);
    await db.maxTests.bulkPut(data.maxTests);
    await db.answers.bulkPut(data.answers);
  });
}

/** File name for a backup made at `now`, e.g. `easy-workout-2026-11-14.json`. */
export const backupFileName = (now = new Date()): string =>
  `easy-workout-${now.toISOString().slice(0, 10)}.json`;

function withoutKey<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...record };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}
