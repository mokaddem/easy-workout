import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { sessionDays, weekStrip } from './weekStrip';

// Friday 20 November 2026, local time.
const NOW = new Date(2026, 10, 20, 9, 0);
const DAYS = ['mon', 'wed', 'fri', 'sat'] as const;

const startedToday = (): SessionLog =>
  ({
    id: 'l1',
    source: { kind: 'programme', programmeId: 'p', week: 1, sessionId: 'a' },
    startedAt: new Date(2026, 10, 20, 7, 0).toISOString(),
  }) as unknown as SessionLog;

describe('weekStrip', () => {
  it('lays the next sessions on the coming training days, today first', () => {
    const cells = weekStrip({ trainingDays: DAYS, now: NOW, logs: [], next: 1, size: 4 });
    expect(cells).toHaveLength(7);
    expect(cells.map((c) => c.day)).toEqual([20, 21, 22, 23, 24, 25, 26]);
    expect(cells[0]).toMatchObject({ today: true, weekday: 'fri' });
    // Friday takes the next session (index 1); the others follow on Saturday, Monday, Wednesday.
    expect(cells.map((c) => c.session)).toEqual([
      { index: 1, kind: 'next' },
      { index: 2, kind: 'later' },
      undefined,
      { index: 3, kind: 'later' },
      undefined,
      { index: 0, kind: 'later' },
      undefined,
    ]);
  });

  it('shows a session started today as done and moves the next one to the next training day', () => {
    const cells = weekStrip({
      trainingDays: DAYS,
      now: NOW,
      logs: [startedToday()],
      next: 2,
      size: 4,
    });
    expect(cells[0]!.session).toEqual({ index: -1, kind: 'done' });
    // Today is taken: the next session waits for Saturday.
    expect(cells[1]!.session).toEqual({ index: 2, kind: 'next' });
  });

  it('has no sessions without training days', () => {
    const cells = weekStrip({ trainingDays: [], now: NOW, logs: [], next: 0, size: 4 });
    expect(cells.every((c) => c.session === undefined)).toBe(true);
  });
});

describe('sessionDays', () => {
  it('gives each rotation index its day', () => {
    const days = sessionDays({ trainingDays: DAYS, now: NOW, logs: [], next: 1, size: 4 });
    expect(days.map((d) => d?.date)).toEqual([
      '2026-11-25',
      '2026-11-20',
      '2026-11-21',
      '2026-11-23',
    ]);
  });
});
