import { useEffect, useState } from 'react';
import { updateSettings, useSessionLogs, useSettings } from '@/app/data';
import { backupReminder, snoozedUntil, storagePersisted, type BackupReminder } from '@/app/backup';
import { exportJsonBackup } from './backupActions';

export interface BackupReminderState {
  reminder: BackupReminder;
  /** Exports a backup; false when the person cancelled the share sheet. */
  exportNow: () => Promise<boolean>;
  later: () => Promise<void>;
  /** Age of the last backup in whole days; undefined when there never was one. */
  days: number | undefined;
}

/** The backup reminder for the current data, and what its two actions do. */
export function useBackupReminder(): BackupReminderState {
  const settings = useSettings();
  const logs = useSessionLogs();
  const [now] = useState(() => Date.now());
  const [persisted, setPersisted] = useState<{ value: boolean | undefined } | null>(null);
  useEffect(() => {
    let live = true;
    void storagePersisted().then((value) => live && setPersisted({ value }));
    return () => {
      live = false;
    };
  }, []);

  // Nothing shows until everything it depends on is known, so it never flips variant.
  const reminder: BackupReminder =
    settings && logs && persisted ? backupReminder(settings, logs, persisted.value, now) : 'none';
  const days = settings?.lastBackupAt
    ? Math.max(0, Math.floor((now - Date.parse(settings.lastBackupAt)) / 86_400_000))
    : undefined;

  return {
    reminder,
    days,
    exportNow: async () => (await exportJsonBackup()) !== 'cancelled',
    later: () => updateSettings({ backupSnoozedUntil: snoozedUntil(reminder) }),
  };
}
