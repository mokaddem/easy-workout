import { describe, expect, it } from 'vitest';
import type { Load, MaxTest, Programme } from '../../domain';
import { kg, makeLog, makeProgramme, values, type EntrySpec } from '../../../tests/support/logs';
import { compareScores, recordPoints, recordScore, sessionRecords, setRecord } from './records';
import { highlights } from './highlights';
import { exerciseById } from '../../catalogue';

const at = (day: number) => new Date(2026, 10, day, 10).toISOString();
const squat = exerciseById.get('goblet-squat');
const pullUp = exerciseById.get('band-assisted-pull-up');

const quick = (id: string, day: number, entry: EntrySpec) =>
  makeLog({ id, at: at(day), main: [entry] });

const pushUps = (id: string, day: number, ...v: number[]) =>
  quick(id, day, { exerciseId: 'push-up', sets: values(...v) });

describe('record score', () => {
  const score = (value: number, load: Load | undefined, ex = squat) =>
    recordScore({ value, unit: 'reps', ...(load && { load }) }, ex, 70);

  it('ranks weights in hand by load moved with reps as an estimated max', () => {
    expect(compareScores(score(10, kg(24)), score(12, kg(20)))).toBeGreaterThan(0);
    expect(compareScores(score(12, kg(20)), score(10, kg(24)))).toBeLessThan(0);
  });

  it('stops counting reps at 12 and breaks the tie with more reps', () => {
    const a = score(12, kg(20));
    const b = score(15, kg(20));
    expect(a.primary).toBeCloseTo(b.primary);
    expect(compareScores(b, a)).toBeGreaterThan(0);
  });

  it('counts the share of the body a leg move lifts', () => {
    const squatScore = score(10, kg(10), squat);
    const press = score(10, kg(10), exerciseById.get('dumbbell-floor-press'));
    expect(squatScore.primary).toBeGreaterThan(press.primary);
  });

  it('ranks bodyweight by reps, added load by load then reps', () => {
    const push = exerciseById.get('push-up');
    expect(compareScores(score(12, undefined, push), score(10, undefined, push))).toBeGreaterThan(
      0,
    );
    const added = (kgs: number, n: number) => score(n, { kind: 'added-kg', kg: kgs }, push);
    expect(compareScores(added(5, 5), added(2.5, 15))).toBeGreaterThan(0);
    expect(compareScores(added(5, 8), added(5, 7))).toBeGreaterThan(0);
    expect(compareScores(added(2.5, 1), score(30, undefined, push))).toBeGreaterThan(0);
  });

  it('ranks a heavier band higher and a lighter assisting band higher', () => {
    const push = exerciseById.get('push-up');
    const band = (level: 'light' | 'heavy', ex = push) => score(8, { kind: 'band', level }, ex);
    expect(compareScores(band('heavy'), band('light'))).toBeGreaterThan(0);
    expect(compareScores(band('light', pullUp), band('heavy', pullUp))).toBeGreaterThan(0);
  });

  it('ranks holds by load then seconds', () => {
    const hold = (sec: number) =>
      recordScore({ value: sec, unit: 'seconds' }, exerciseById.get('plank'), 70);
    expect(compareScores(hold(45), hold(40))).toBeGreaterThan(0);
  });
});

describe('records along an exercise', () => {
  const find = (
    logs: ReturnType<typeof quick>[],
    tests: MaxTest[] = [],
    programmes: Programme[] = [],
  ) => recordPoints('push-up', logs, programmes, tests);

  it('needs two earlier sessions and strictly beats the history', () => {
    expect(find([pushUps('a', 1, 10), pushUps('b', 2, 12)])).toEqual([]);
    const records = find([pushUps('a', 1, 10), pushUps('b', 2, 10), pushUps('c', 3, 11)]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      logId: 'c',
      set: { value: 11, unit: 'reps', itemKey: 'main/0/0', set: 1 },
      previous: { value: 10 },
    });
    expect(find([pushUps('a', 1, 10), pushUps('b', 2, 10), pushUps('c', 3, 10)])).toEqual([]);
  });

  it('takes the best set of the session', () => {
    const records = find([pushUps('a', 1, 10), pushUps('b', 2, 10), pushUps('c', 3, 11, 13, 12)]);
    expect(records[0]!.set).toMatchObject({ value: 13, set: 2 });
  });

  it('ignores back-off sets, flagged sets, and reps under the range minimum', () => {
    const squats = (id: string, day: number) =>
      quick(id, day, { exerciseId: 'goblet-squat', load: kg(20), sets: values(10) });
    const backOff = makeLog({
      id: 'c',
      at: at(3),
      main: [
        {
          exerciseId: 'goblet-squat',
          sets: [
            { value: 10, load: kg(20) },
            { value: 14, load: kg(18) },
          ],
        },
      ],
      adjustments: { backOffLoads: { 'main/0/0': kg(18) } },
    });
    expect(recordPoints('goblet-squat', [squats('a', 1), squats('b', 2), backOff], [])).toEqual([]);
    const under = quick('u', 3, { exerciseId: 'push-up', sets: values(7) });
    expect(find([pushUps('a', 1, 4), pushUps('b', 2, 5), under])).toEqual([]);
    const stopped = quick('s', 3, {
      exerciseId: 'push-up',
      sets: [{ value: 10 }, { value: 14, flag: 'pain' }],
    });
    expect(find([pushUps('a', 1, 8), pushUps('b', 2, 9), stopped])).toEqual([]);
  });

  it('counts calibration and deload sets as history but never as records', () => {
    const programme = makeProgramme();
    const prog = (id: string, day: number, week: number, v: number) =>
      makeLog({
        id,
        at: at(day),
        source: { kind: 'programme', programmeId: 'p', week, sessionId: 'a' },
        main: [{ exerciseId: 'push-up', sets: values(v) }],
      });
    // The first build session (calibration) set a high bar that later sessions must beat.
    const calibrated = [
      prog('a', 1, 1, 20),
      prog('b', 2, 3, 10),
      prog('c', 3, 3, 11),
      prog('d', 4, 4, 12),
    ];
    expect(find(calibrated, [], [programme])).toEqual([]);
    const withDeload = [
      prog('a', 1, 1, 8),
      prog('b', 2, 3, 9),
      prog('c', 3, 4, 9),
      prog('d', 4, 8, 15),
    ];
    expect(find(withDeload, [], [programme])).toEqual([]);
    // The deload set raised the bar for what follows.
    expect(find([...withDeload, prog('e', 5, 5, 14)], [], [programme])).toEqual([]);
    expect(find([...withDeload, prog('e', 5, 5, 16)], [], [programme])).toHaveLength(1);
  });

  it('ignores an untouched one-tap at a new weight but not a touched one', () => {
    const entry = (extra: Record<string, unknown>): EntrySpec => ({
      exerciseId: 'goblet-squat',
      load: kg(24),
      sets: [{ value: 10, ...extra }],
    });
    const run = (extra: Record<string, unknown>) =>
      recordPoints(
        'goblet-squat',
        [
          quick('a', 1, { exerciseId: 'goblet-squat', load: kg(20), sets: values(10) }),
          quick('b', 2, { exerciseId: 'goblet-squat', load: kg(20), sets: values(10) }),
          {
            ...makeLog({ id: 'c', at: at(3), main: [entry(extra)] }),
            progression: { 'main/0/0': { code: 'load-up', params: {}, newLoad: true } },
          },
        ],
        [],
      );
    expect(run({})).toEqual([]);
    expect(run({ chosen: true, feel: 'right' })).toHaveLength(1);
    expect(run({ edited: true })).toHaveLength(1);
  });

  it('compares with max tests', () => {
    const test: MaxTest = {
      id: 't',
      date: '2026-11-02',
      at: at(2),
      exerciseId: 'push-up',
      context: 'fresh',
      result: { kind: 'reps', reps: 20 },
    };
    const logs = [pushUps('a', 1, 10), pushUps('b', 3, 10), pushUps('c', 4, 12)];
    expect(find(logs, [test])).toEqual([]);
    expect(find(logs, [{ ...test, stopped: 'pain' }])).toHaveLength(1);
  });

  it('flags a heavier load or a 5 % gain as notable', () => {
    const squats = (id: string, day: number, load: Load, v: number) =>
      quick(id, day, { exerciseId: 'goblet-squat', load, sets: values(v) });
    const run = (last: ReturnType<typeof squats>) =>
      recordPoints(
        'goblet-squat',
        [squats('a', 1, kg(20), 10), squats('b', 2, kg(20), 10), last],
        [],
      )[0]!;
    expect(run(squats('c', 3, kg(22), 10)).notable).toBe(true);
    expect(run(squats('c', 3, kg(20), 11)).notable).toBe(false);
    expect(run(squats('c', 3, kg(20), 12)).notable).toBe(true);
    const bodyweight = (v: number) =>
      find([pushUps('a', 1, 20), pushUps('b', 2, 20), pushUps('c', 3, v)])[0]!;
    expect(bodyweight(21).notable).toBe(true);
    expect(bodyweight(30).notable).toBe(true);
  });
});

describe('session records and the set cue', () => {
  const history = [pushUps('a', 1, 10), pushUps('b', 2, 10)];

  it('gives the best record set per exercise with the previous best', () => {
    const today = pushUps('c', 3, 12, 11);
    expect(sessionRecords(today, history, [])).toMatchObject([
      { exerciseId: 'push-up', set: { value: 12 }, previous: { value: 10 } },
    ]);
    expect(sessionRecords(pushUps('d', 3, 9), history, [])).toEqual([]);
  });

  it('cues a notable record on an in-progress log, once, for the set that beats earlier ones', () => {
    const live = (v: number[]) => ({ ...pushUps('c', 3, ...v), status: 'in-progress' as const });
    const ref = (set: number) => ({ section: 'main' as const, blockIndex: 0, itemIndex: 0, set });
    expect(setRecord(live([14]), ref(1), history, [])?.set.value).toBe(14);
    // Set 2 ties set 1: it does not beat the earlier set.
    expect(setRecord(live([14, 14]), ref(2), history, [])).toBeUndefined();
    expect(setRecord(live([14, 15]), ref(2), history, [])?.set.value).toBe(15);
    // Not notable: one rep more than 20.
    const high = [pushUps('a', 1, 20), pushUps('b', 2, 20)];
    expect(setRecord(live([21]), ref(1), high, [])?.notable).toBe(true);
    const higher = [pushUps('a', 1, 30), pushUps('b', 2, 30)];
    expect(setRecord(live([31]), ref(1), higher, [])).toBeUndefined();
    // Sets logged after the asked one are ignored.
    expect(setRecord(live([14, 20]), ref(1), history, [])?.set.value).toBe(14);
  });
});

describe('highlights share the record rule', () => {
  it('shows a new best only when it is a record', () => {
    const logs = [pushUps('a', 10, 10), pushUps('b', 11, 10), pushUps('c', 12, 11)];
    const rows = highlights(logs, [], [], new Date(2026, 10, 14));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'best',
      logId: 'c',
      record: { previous: { value: 10 } },
    });
    expect(highlights(logs.slice(0, 2), [], [], new Date(2026, 10, 14))).toEqual([]);
  });
});
