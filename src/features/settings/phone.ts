import { db } from '@/db';
import type { BackupFile } from '@/db/backup';

/** How much there is of each kind, for the "this file / this phone" table. */
export interface Counts {
  sessions: number;
  sets: number;
  programmes: number;
  equipment: number;
  checkIns: number;
  maxTests: number;
  customSessions: number;
  /** Profile and settings are saved. */
  profile: boolean;
}

export const countsOf = (backup: BackupFile): Counts => ({
  sessions: backup.data.sessionLogs.length,
  sets: backup.data.sessionLogs.reduce((sum, log) => sum + log.sets.length, 0),
  programmes: backup.data.programmes.length,
  equipment: backup.data.equipment.length,
  checkIns: backup.data.checkIns.length,
  maxTests: backup.data.maxTests.length,
  customSessions: backup.data.customSessions.length,
  profile: backup.data.profile !== null || backup.data.settings !== null,
});

/** What this phone holds right now. */
export async function phoneCounts(): Promise<{ counts: Counts; sessionStarts: string[] }> {
  return db.transaction('r', db.tables, async () => {
    const logs = await db.sessionLogs.toArray();
    return {
      sessionStarts: logs.map((log) => log.startedAt),
      counts: {
        sessions: logs.length,
        sets: logs.reduce((sum, log) => sum + log.sets.length, 0),
        programmes: await db.programmes.count(),
        equipment: await db.equipment.count(),
        checkIns: await db.checkIns.count(),
        maxTests: await db.maxTests.count(),
        customSessions: await db.customSessions.count(),
        profile: (await db.profile.count()) + (await db.settings.count()) > 0,
      },
    };
  });
}
