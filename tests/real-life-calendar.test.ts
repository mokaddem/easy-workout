import { describe, expect, it } from 'vitest';
import type { SessionLog } from '../src/domain';
import {
  hiddenPrompts,
  isPaused,
  missedTrainingDay,
  pausedDays,
  pausedGapDays,
  projectRotation,
} from '../src/engine';
import { makeLog } from './support/logs';

// 2026-03-02 is a Monday. Local times throughout.
const day = (d: number, hour = 12) => new Date(2026, 2, d, hour);

const programmeLog = (id: string, d: number, hour = 9): SessionLog =>
  makeLog({
    id,
    at: day(d, hour).toISOString(),
    source: { kind: 'programme', programmeId: 'p', week: 1, sessionId: 'a' },
  });

const trainingDays = ['mon', 'wed', 'fri'] as const;

describe('rotation on the calendar', () => {
  it('gives today to the next session on a training day with nothing started', () => {
    const days = projectRotation({ trainingDays, now: day(4), logs: [], count: 4 });
    expect(days.map((d) => d.date)).toEqual([
      '2026-03-04',
      '2026-03-06',
      '2026-03-09',
      '2026-03-11',
    ]);
    expect(days[0]!.weekday).toBe('wed');
  });

  it('moves to the next training day once a programme session started today', () => {
    const days = projectRotation({
      trainingDays,
      now: day(4, 18),
      logs: [programmeLog('a', 4)],
      count: 2,
    });
    expect(days.map((d) => d.date)).toEqual(['2026-03-06', '2026-03-09']);
  });

  it('is not moved by a quick session started today', () => {
    const quick = makeLog({ id: 'q', at: day(4, 8).toISOString() });
    const days = projectRotation({ trainingDays, now: day(4), logs: [quick], count: 1 });
    expect(days[0]!.date).toBe('2026-03-04');
  });

  it('takes the next training day from a rest day, and after a missed day does not skip', () => {
    // Monday's session was never started; on Tuesday the rotation's next session takes Wednesday.
    const days = projectRotation({ trainingDays, now: day(3), logs: [], count: 3 });
    expect(days.map((d) => d.weekday)).toEqual(['wed', 'fri', 'mon']);
  });

  it('is empty without training days', () => {
    expect(projectRotation({ trainingDays: [], now: day(4), logs: [], count: 3 })).toEqual([]);
  });
});

describe('missed training day', () => {
  const base = { trainingDays, programmeStart: day(1).toISOString() };

  it('names the first training day without a programme session since', () => {
    // Started Sunday; Monday and Wednesday went by; today is Thursday.
    expect(missedTrainingDay({ ...base, now: day(5), logs: [] })?.date).toBe('2026-03-02');
  });

  it('is quiet when the session was started on or after the day', () => {
    const logs = [programmeLog('a', 2), programmeLog('b', 4)];
    expect(missedTrainingDay({ ...base, now: day(5), logs })).toBeUndefined();
  });

  it('finds a later missed day after an earlier one was kept', () => {
    const logs = [programmeLog('a', 2)];
    expect(missedTrainingDay({ ...base, now: day(5), logs })?.date).toBe('2026-03-04');
  });

  it('never counts today, the start day, or days before the pause end or dismissal', () => {
    expect(missedTrainingDay({ ...base, now: day(2), logs: [] })).toBeUndefined();
    expect(
      missedTrainingDay({
        trainingDays,
        programmeStart: day(2, 8).toISOString(),
        now: day(5),
        logs: [],
      })?.date,
    ).toBe('2026-03-04');
    expect(
      missedTrainingDay({ ...base, now: day(6), logs: [], pauseEnd: day(4, 9).toISOString() })
        ?.date,
    ).toBeUndefined();
    expect(
      missedTrainingDay({ ...base, now: day(6), logs: [], dismissedAt: day(3, 9).toISOString() })
        ?.date,
    ).toBe('2026-03-04');
  });

  it('is hidden while paused', () => {
    expect(missedTrainingDay({ ...base, now: day(5), logs: [], paused: true })).toBeUndefined();
  });

  it('is not moved by a quick session', () => {
    const quick = makeLog({ id: 'q', at: day(4).toISOString() });
    expect(missedTrainingDay({ ...base, now: day(5), logs: [quick] })?.date).toBe('2026-03-02');
  });
});

describe('pause', () => {
  const settings = { pause: { since: day(1, 9).toISOString() } };

  it('hides the prompts while paused only', () => {
    expect(isPaused(settings)).toBe(true);
    expect(hiddenPrompts(settings)).toEqual(['check-in', 'missed-day', 'lighter-week']);
    expect(isPaused({})).toBe(false);
    expect(hiddenPrompts({})).toEqual([]);
  });

  it('counts the paused days, and adds them to the gap since the last session', () => {
    expect(pausedDays(settings, day(11, 9))).toBe(10);
    expect(pausedDays({}, day(11))).toBe(0);
    // Last session 5 days before the pause began: the gap runs to now, pause included.
    expect(pausedGapDays(settings, day(1, 9).toISOString(), day(11, 9))).toBe(10);
    // A pause begun before the last session only counts from it.
    expect(pausedGapDays(settings, day(6, 9).toISOString(), day(11, 9))).toBe(5);
    expect(pausedGapDays({}, undefined, day(11))).toBe(0);
  });
});
