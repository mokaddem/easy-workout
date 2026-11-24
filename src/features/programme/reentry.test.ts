import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { reentryPosition } from './reentry';

const log = (at: string, over: Partial<SessionLog> = {}): SessionLog =>
  ({
    id: at,
    source: { kind: 'programme', programmeId: 'p', week: 1, sessionId: 'a' },
    status: 'completed',
    startedAt: at,
    ...over,
  }) as unknown as SessionLog;

describe('reentryPosition', () => {
  it('is the first session when none ran lighter yet', () => {
    expect(reentryPosition([log('2026-08-01T10:00:00.000Z')])).toBe(1);
  });

  it('counts the lighter sessions since the break', () => {
    const logs = [
      log('2026-08-01T10:00:00.000Z'),
      log('2026-11-10T10:00:00.000Z', { adjustments: { reentry: 0.7 } }),
      log('2026-11-12T10:00:00.000Z', { adjustments: { reentry: 0.7 } }),
    ];
    expect(reentryPosition(logs)).toBe(3);
  });

  it('skips sessions that did not count and stops at the first full one', () => {
    const logs = [
      log('2026-11-01T10:00:00.000Z'),
      log('2026-11-10T10:00:00.000Z', { adjustments: { reentry: 0.7 } }),
      log('2026-11-11T10:00:00.000Z', { countsAsDone: false }),
    ];
    expect(reentryPosition(logs)).toBe(2);
  });
});
