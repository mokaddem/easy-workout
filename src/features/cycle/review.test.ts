import { describe, expect, it } from 'vitest';
import type { Answer, SessionLog } from '@/domain';
import type { LiftChange } from '@/engine';
import { bodyFigure, countedLogs, isFinished, liftFigure, painRows, stripWeeks } from './review';

const programme = { id: 'p', weeks: 2, sessionsPerWeek: 2 };

const log = (
  n: number,
  extra: Partial<SessionLog> = {},
  sets: SessionLog['sets'] = [],
): SessionLog =>
  ({
    id: `l${n}`,
    source: { kind: 'programme', programmeId: 'p', week: 1, sessionId: 's' },
    plan: {} as SessionLog['plan'],
    status: 'completed',
    startedAt: `2026-01-0${n}T08:00:00.000Z`,
    sets,
    ...extra,
  }) as SessionLog;

describe('stripWeeks', () => {
  it('fills weeks in the order the sessions were done, early ones apart', () => {
    const logs = [log(1), log(2, { endedEarly: true }), log(3), log(4, { countsAsDone: false })];
    expect(stripWeeks(programme, logs)).toEqual([
      { label: '1', cells: ['done', 'early'] },
      { label: '2', cells: ['done', 'later'] },
    ]);
  });

  it('ignores other programmes, open sessions and abandoned ones', () => {
    const logs = [
      log(1, { status: 'in-progress' }),
      log(2, { status: 'abandoned' }),
      log(3, { source: { kind: 'quick' } }),
    ];
    expect(countedLogs(programme, logs)).toEqual([]);
    expect(isFinished(programme, logs)).toBe(false);
  });

  it('a programme is finished when every planned session counted, or it was closed', () => {
    const all = [1, 2, 3, 4].map((n) => log(n));
    expect(isFinished(programme, all)).toBe(true);
    expect(isFinished({ ...programme, status: 'completed' }, [])).toBe(true);
  });
});

const lift = (extra: Partial<LiftChange>): LiftChange => ({
  sessionId: 's',
  status: 'progressed',
  variantChanged: false,
  logged: true,
  ...extra,
});
const reading = (value: number, rir: number, kg?: number, id = 'push-up') => ({
  at: '2026-01-01T00:00:00.000Z',
  exerciseId: id,
  value,
  unit: 'reps' as const,
  rir,
  ...(kg && { load: { kind: 'kg' as const, kg } }),
});

describe('liftFigure', () => {
  it('shows a harder version as the progress itself', () => {
    expect(liftFigure(lift({ variantChanged: true, percent: 20 }))).toEqual({ kind: 'harder' });
  });

  it('shows the strength change of a weighted lift', () => {
    expect(liftFigure(lift({ percent: 24 }))).toEqual({ kind: 'percent', value: 24 });
  });

  it('counts bodyweight reps at equal effort', () => {
    const f = liftFigure(lift({ start: reading(5, 2), end: reading(7, 1) }));
    // 7 reps with one in the tank is 6 reps at two in the tank: one more than 5.
    expect(f).toEqual({ kind: 'reps', value: 1 });
    expect(liftFigure(lift({ start: reading(5, 2), end: reading(9, 2) }))).toEqual({
      kind: 'reps',
      value: 4,
    });
  });

  it('says held for a held lift and nothing for progress it cannot put a number on', () => {
    expect(liftFigure(lift({ status: 'held' }))).toEqual({ kind: 'held' });
    expect(liftFigure(lift({ start: reading(14, 2, 8), end: reading(16, 2, 10) }))).toEqual({
      kind: 'none',
    });
  });
});

describe('painRows', () => {
  const hurt = (n: number) =>
    log(n, {}, [
      {
        section: 'main',
        blockIndex: 0,
        itemIndex: 0,
        set: 1,
        exerciseId: 'push-up',
        planned: { target: { kind: 'reps', min: 8, max: 10 } },
        flag: 'pain',
        at: '2026-01-01T08:00:00.000Z',
      },
    ]);
  const clean = (n: number) =>
    log(n, {}, [
      {
        section: 'main',
        blockIndex: 0,
        itemIndex: 0,
        set: 1,
        exerciseId: 'push-up',
        planned: { target: { kind: 'reps', min: 8, max: 10 } },
        actual: { reps: 9 },
        at: '2026-01-01T08:00:00.000Z',
      },
    ]);
  const answer: Answer = {
    id: 'a',
    exerciseId: 'push-up',
    kind: 'pain',
    logId: 'l1',
    answer: 'lighter',
    at: '2026-01-02T00:00:00.000Z',
  };

  it('reports the answer and that pain did not come back', () => {
    const rows = painRows(programme, ['push-up'], [hurt(1), clean(2)], [answer]);
    expect(rows).toEqual([
      {
        exerciseId: 'push-up',
        at: hurt(1).startedAt,
        logId: 'l1',
        answer: 'lighter',
        after: { kind: 'clear' },
      },
    ]);
  });

  it('reports pain that came back, and a stop nobody answered', () => {
    const rows = painRows(programme, ['push-up'], [hurt(1), hurt(3)], []);
    expect(rows[0]?.answer).toBeUndefined();
    expect(rows[0]?.after).toEqual({ kind: 'again', at: hurt(3).startedAt });
  });
});

describe('bodyFigure', () => {
  it('compares the mean of the first two with the mean of the last two, to 0.5', () => {
    expect(bodyFigure([78, 79, 79.4, 80, 80.6, 81].map((value) => ({ value })))).toEqual({
      from: 78.5,
      to: 81,
    });
  });
});
