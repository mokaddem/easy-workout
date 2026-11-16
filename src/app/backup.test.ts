import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { backupReminder, snoozedUntil } from './backup';

const day = (n: number) => Date.UTC(2026, 10, 1) + n * 86_400_000;
const iso = (n: number) => new Date(day(n)).toISOString();
const completed = (n: number) =>
  ({ status: 'completed', startedAt: iso(n), endedAt: iso(n) }) as unknown as SessionLog;

describe('backupReminder', () => {
  it('waits 30 days from the first session when there was never a backup', () => {
    expect(backupReminder({}, [], true, day(100))).toBe('none');
    expect(backupReminder({}, [completed(0)], true, day(29))).toBe('none');
    expect(backupReminder({}, [completed(0), completed(20)], true, day(30))).toBe('due');
  });

  it('counts from the last backup and turns firm when the data may be cleared', () => {
    expect(backupReminder({ lastBackupAt: iso(10) }, [completed(0)], true, day(35))).toBe('none');
    expect(backupReminder({ lastBackupAt: iso(10) }, [completed(0)], false, day(40))).toBe(
      'at-risk',
    );
  });

  it('stays hidden while snoozed', () => {
    const settings = { lastBackupAt: iso(0), backupSnoozedUntil: snoozedUntil('due', day(40)) };
    expect(backupReminder(settings, [], true, day(46))).toBe('none');
    expect(backupReminder(settings, [], true, day(47))).toBe('due');
    expect(Date.parse(snoozedUntil('at-risk', day(40)))).toBe(day(43));
  });
});
