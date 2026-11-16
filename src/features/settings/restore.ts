import { backupFileName, exportBackup, parseBackup, type BackupFile } from '@/db/backup';
import type { Language } from '@/domain';
import { deliverFile } from './files';
import type { Counts } from './phone';

export type ReadFailure = 'not-a-backup' | 'invalid' | 'newer-version';
export type ReadResult = { ok: true; backup: BackupFile } | { ok: false; reason: ReadFailure };

/** Reads a picked file as a backup, brought up to the current shape. */
export async function readBackupFile(file: Blob): Promise<ReadResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, reason: 'not-a-backup' };
  }
  const parsed = parseBackup(raw);
  return parsed.ok ? { ok: true, backup: parsed.backup } : { ok: false, reason: parsed.reason };
}

/**
 * Downloads what is on the phone now, before an import replaces it. Always a download: no share
 * sheet before a replace. Returns the file name.
 */
export async function downloadCopyBeforeImport(lang: Language): Promise<string> {
  const name = backupFileName().replace(
    'easy-workout-',
    lang === 'fr' ? 'easy-workout-avant-import-' : 'easy-workout-before-import-',
  );
  await deliverFile(JSON.stringify(await exportBackup()), name, 'application/json', {
    share: false,
  });
  return name;
}

/** Whether the phone holds anything worth a copy before it is replaced (settings alone don't count). */
export const holdsData = (counts: Counts): boolean =>
  counts.sessions +
    counts.programmes +
    counts.equipment +
    counts.checkIns +
    counts.maxTests +
    counts.customSessions >
  0;

/** Whether the app opens on the programme once this backup is in: a profile and a programme in progress. */
export const resumesSetup = (backup: BackupFile): boolean =>
  backup.data.profile !== null && backup.data.programmes.some((p) => p.status === 'active');
