import { BACKUP_DUE_DAYS } from '@/app/backup';

/** The toast key and values for a cancelled export: it names the backup's age when one was due. */
export function exportCancelled(days: number | undefined): { key: string; count?: number } {
  return days !== undefined && days >= BACKUP_DUE_DAYS
    ? { key: 'adapt.notes.export.cancelledDue', count: days }
    : { key: 'adapt.notes.export.cancelled' };
}
