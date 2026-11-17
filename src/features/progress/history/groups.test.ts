import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { historyGroups, painStop, performedSets, rowStatus, weekDistance } from './groups';

const log = (id: string, startedAt: string, extra: Partial<SessionLog> = {}): SessionLog =>
  ({
    id,
    source: { kind: 'quick' },
    status: 'completed',
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 30 * 60_000).toISOString(),
    plan: { id: 'q', name: { fr: 'q', en: 'q' }, warmup: [], main: [], finisher: [] },
    sets: [],
    ...extra,
  }) as unknown as SessionLog;

describe('history groups', () => {
  it('groups by calendar week, newest first, leaving the open session out', () => {
    const groups = historyGroups([
      log('a', '2026-11-09T10:00:00'),
      log('b', '2026-11-12T10:00:00'),
      log('c', '2026-11-03T10:00:00'),
      log('open', '2026-11-13T10:00:00', { status: 'in-progress' }),
    ]);
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-11-09', '2026-11-02']);
    expect(groups[0]!.logs.map((l) => l.id)).toEqual(['b', 'a']);
    expect(groups[0]!.sessions).toBe(2);
    expect(groups[0]!.activeSec).toBe(3600);
  });

  it('lists abandoned sessions without counting them', () => {
    const [group] = historyGroups([
      log('a', '2026-11-09T10:00:00'),
      log('b', '2026-11-10T10:00:00', { status: 'abandoned' }),
    ]);
    expect(group!.logs).toHaveLength(2);
    expect(group!.sessions).toBe(1);
    expect(group!.activeSec).toBe(1800);
  });

  it('measures how many weeks back a group is', () => {
    const now = new Date(2026, 10, 12);
    expect(weekDistance('2026-11-09', now)).toBe(0);
    expect(weekDistance('2026-11-02', now)).toBe(1);
    expect(weekDistance('2026-10-26', now)).toBe(2);
  });

  it('marks abandoned, ended-early and own sessions', () => {
    expect(rowStatus(log('a', '2026-11-09T10:00:00', { status: 'abandoned' })).kind).toBe(
      'abandoned',
    );
    expect(rowStatus(log('a', '2026-11-09T10:00:00', { endedEarly: true })).kind).toBe('early');
    expect(
      rowStatus(log('a', '2026-11-09T10:00:00', { source: { kind: 'custom', sessionId: 's' } }))
        .kind,
    ).toBe('own-alone');
    expect(rowStatus(log('a', '2026-11-09T10:00:00')).kind).toBe('plain');
  });

  it('finds the pain stop and counts performed sets once per side pair', () => {
    const base = {
      section: 'main',
      blockIndex: 0,
      itemIndex: 0,
      exerciseId: 'x',
      planned: { target: { kind: 'reps', min: 8, max: 10 } },
      at: '2026-11-09T10:00:00.000Z',
    };
    const sets = [
      { ...base, set: 1, side: 'left', actual: { reps: 8 } },
      { ...base, set: 1, side: 'right', actual: { reps: 8 } },
      { ...base, set: 2, actual: { reps: 6 }, flag: 'pain' },
      { ...base, section: 'warmup', set: 1, actual: { reps: 5 } },
    ] as unknown as SessionLog['sets'];
    expect(performedSets({ sets })).toBe(2);
    expect(painStop({ sets })).toEqual({ exerciseId: 'x', set: 2 });
  });
});
