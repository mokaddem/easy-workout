import type { SessionLog, Settings } from '@/domain';

/** A backup is due this long after the last one, or after the first session when there was none. */
export const BACKUP_DUE_DAYS = 30;
/** "Later" hides the reminder this long; less when the browser may clear the data on its own. */
export const SNOOZE_DAYS = 7;
export const SNOOZE_DAYS_AT_RISK = 3;

const DAY_MS = 86_400_000;

/** Whether the browser keeps the data even under storage pressure; undefined when it can't say. */
export async function storagePersisted(): Promise<boolean | undefined> {
  try {
    return await navigator.storage?.persisted?.();
  } catch {
    return undefined;
  }
}

/** Asks the browser to keep the data; some browsers ask the user, others decide on their own. */
export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return await navigator.storage?.persist?.();
  } catch {
    return undefined;
  }
}

/**
 * - `none`: nothing to say.
 * - `due`: no backup for 30 days (or since the first session).
 * - `at-risk`: due, and the browser has not promised to keep the data.
 */
export type BackupReminder = 'none' | 'due' | 'at-risk';

export function backupReminder(
  settings: Pick<Settings, 'lastBackupAt' | 'backupSnoozedUntil'>,
  logs: readonly SessionLog[],
  persisted: boolean | undefined,
  now = Date.now(),
): BackupReminder {
  if (settings.backupSnoozedUntil && Date.parse(settings.backupSnoozedUntil) > now) return 'none';
  const firstSession = logs
    .filter((log) => log.status === 'completed')
    .map((log) => Date.parse(log.endedAt ?? log.startedAt))
    .reduce((first, at) => Math.min(first, at), Number.POSITIVE_INFINITY);
  const since = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : firstSession;
  if (!Number.isFinite(since) || now - since < BACKUP_DUE_DAYS * DAY_MS) return 'none';
  return persisted === false ? 'at-risk' : 'due';
}

/** When "Later" should let the reminder come back. */
export function snoozedUntil(reminder: BackupReminder, now = Date.now()): string {
  const days = reminder === 'at-risk' ? SNOOZE_DAYS_AT_RISK : SNOOZE_DAYS;
  return new Date(now + days * DAY_MS).toISOString();
}
