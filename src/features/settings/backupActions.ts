import { updateSettings } from '@/app/data';
import { exportBackup, backupFileName } from '@/db/backup';
import { deliverFile, type DeliverResult } from './files';

/** A full JSON backup. Counts as a backup only once the file has left the app. */
export async function exportJsonBackup(): Promise<DeliverResult> {
  const backup = await exportBackup();
  const result = await deliverFile(JSON.stringify(backup), backupFileName(), 'application/json');
  if (result !== 'cancelled') await updateSettings({ lastBackupAt: backup.exportedAt });
  return result;
}
