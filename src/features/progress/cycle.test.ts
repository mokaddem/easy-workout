import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { countedLogs, cycleProgress, slotsLeft } from './cycle';

const log = (n: number, extra: Partial<SessionLog> = {}): SessionLog =>
  ({
    id: `l${n}`,
    source: { kind: 'programme', programmeId: 'p', week: 1, sessionId: 's' },
    status: 'completed',
    startedAt: `2026-11-${String(n).padStart(2, '0')}T10:00:00.000Z`,
    sets: [],
    ...extra,
  }) as SessionLog;

const programme = { id: 'p', weeks: 3, sessionsPerWeek: 2 };
const label = (w: number) => `W${w}`;

describe('cycle progress', () => {
  it('fills the cells in order and marks the current week', () => {
    const p = cycleProgress(programme, [log(1), log(2, { endedEarly: true }), log(3)], label);
    expect(p.weeks.map((w) => w.cells)).toEqual([
      ['done', 'early'],
      ['done', 'remaining'],
      ['later', 'later'],
    ]);
    expect(p.week).toBe(2);
    expect(p.doneInWeek).toBe(1);
    expect(p.done).toBe(3);
    expect(p.weeks[1]!.current).toBe(true);
    expect(p.finished).toBe(false);
  });

  it('ignores sessions that did not count', () => {
    const logs = [
      log(1, { countsAsDone: false }),
      log(2, { status: 'abandoned' }),
      log(3, { source: { kind: 'quick' } }),
      log(4, { source: { kind: 'programme', programmeId: 'other', week: 1, sessionId: 's' } }),
    ];
    expect(countedLogs(programme, logs)).toHaveLength(0);
    expect(cycleProgress(programme, logs, label).done).toBe(0);
  });

  it('is finished with every cell filled and no current week', () => {
    const p = cycleProgress(
      programme,
      [1, 2, 3, 4, 5, 6].map((n) => log(n)),
      label,
    );
    expect(p.finished).toBe(true);
    expect(p.week).toBe(3);
    expect(p.doneInWeek).toBe(2);
    expect(p.weeks.some((w) => w.current)).toBe(false);
  });

  it('lists the slots still to come in a week', () => {
    expect(slotsLeft(['A', 'B', 'C', 'D'], 2, 2, 1)).toEqual(['D']);
    expect(slotsLeft(['A', 'B', 'C', 'D'], 3, 2, 0)).toEqual(['A', 'B']);
  });
});
