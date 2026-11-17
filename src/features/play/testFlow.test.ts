import { describe, expect, it } from 'vitest';
import type { MaxTest } from '@/domain';
import {
  adjustRest,
  buildTest,
  clampTest,
  entryPrefill,
  finishSet,
  heldSeconds,
  openTest,
  pauseTest,
  restSeconds,
  resumeTest,
  setEntry,
  skipRest,
  startHold,
  startRest,
  testCap,
  tickTest,
  verdictOf,
} from './testFlow';
import { valueText } from './testFormat';

const T0 = 1_000_000;

describe('opening a test', () => {
  it('starts a session test on its intro and a fresh one on the set', () => {
    expect(openTest('reps', 'session').stage.kind).toBe('intro');
    expect(openTest('reps', 'fresh').stage.kind).toBe('set');
    expect(openTest('time', 'fresh').stage.kind).toBe('ready');
  });
});

describe('the rest before a test', () => {
  it('runs 180 s, can be nudged by 15 s and ends on the set (reps) or the start (holds)', () => {
    const rest = startRest(openTest('reps', 'session'), T0);
    expect(restSeconds(rest, T0)).toBe(180);
    expect(restSeconds(adjustRest(rest, 15, T0), T0)).toBe(195);
    expect(restSeconds(adjustRest(rest, -15, T0 + 10_000), T0 + 10_000)).toBe(155);
    expect(tickTest(rest, T0 + 179_000).stage.kind).toBe('rest');
    expect(tickTest(rest, T0 + 180_000).stage.kind).toBe('set');
    expect(tickTest(startRest(openTest('time', 'session'), T0), T0 + 180_000).stage.kind).toBe(
      'ready',
    );
  });

  it('is skipped by Skip and by running out of nudges', () => {
    const rest = startRest(openTest('reps', 'session'), T0);
    expect(skipRest(rest).stage.kind).toBe('set');
    expect(adjustRest(rest, -15, T0 + 170_000).stage.kind).toBe('set');
  });

  it('only starts from the intro', () => {
    const set = openTest('reps', 'fresh');
    expect(startRest(set, T0)).toBe(set);
  });
});

describe('a hold test', () => {
  it('counts 3, 2, 1, then up, and stops by itself at the cap', () => {
    let flow = startHold(openTest('time', 'fresh'), T0);
    expect(flow.stage.kind).toBe('lead-in');
    flow = tickTest(flow, T0 + 3000);
    expect(flow.stage).toEqual({ kind: 'running', startedAt: T0 + 3000 });
    expect(heldSeconds(flow, T0 + 3000 + 72_500)).toBe(72);
    expect(tickTest(flow, T0 + 3000 + 179_000).stage.kind).toBe('running');
    const done = tickTest(flow, T0 + 3000 + 180_000);
    expect(done.stage).toEqual({ kind: 'entry', value: 180 });
  });

  it('goes to the entry with the time held when stopped', () => {
    let flow = tickTest(startHold(openTest('time', 'fresh'), T0), T0 + 3000);
    flow = finishSet(flow, T0 + 3000 + 72_900, 30);
    expect(flow.stage).toEqual({ kind: 'entry', value: 72 });
  });

  it('starts over after a pause', () => {
    let flow = tickTest(startHold(openTest('time', 'fresh'), T0), T0 + 3000);
    flow = pauseTest(flow, T0 + 20_000);
    expect(flow.stage.kind).toBe('ready');
    expect(tickTest(flow, T0 + 999_999)).toBe(flow);
  });
});

describe('a rep test', () => {
  it('goes to the entry at the prefill, capped', () => {
    expect(finishSet(openTest('reps', 'fresh'), T0, 18).stage).toEqual({
      kind: 'entry',
      value: 18,
    });
    expect(finishSet(openTest('reps', 'fresh'), T0, 80).stage).toEqual({
      kind: 'entry',
      value: 50,
    });
  });

  it('bounds the entry between 0 and the cap', () => {
    const entry = finishSet(openTest('reps', 'fresh'), T0, 18);
    expect(setEntry(entry, -3).stage).toEqual({ kind: 'entry', value: 0 });
    expect(setEntry(entry, 51).stage).toEqual({ kind: 'entry', value: 50 });
    expect(clampTest('time', 500)).toBe(180);
    expect(testCap('time')).toBe(180);
  });
});

describe('pausing', () => {
  it('freezes the rest and gives its time back on resume', () => {
    const rest = startRest(openTest('reps', 'session'), T0);
    const paused = pauseTest(rest, T0 + 60_000);
    expect(restSeconds(paused, T0 + 500_000)).toBe(120);
    expect(tickTest(paused, T0 + 500_000)).toBe(paused);
    const resumed = resumeTest(paused, T0 + 100_000);
    expect(restSeconds(resumed, T0 + 100_000)).toBe(120);
    expect(resumed.pausedAt).toBeUndefined();
  });
});

describe('the entry prefill', () => {
  const previous = (reps: number): MaxTest => ({
    id: 'a',
    date: '2026-09-08',
    at: '2026-09-08T10:00:00.000Z',
    exerciseId: 'push-up',
    context: 'session',
    result: { kind: 'reps', reps },
  });
  it('takes the last test, else the best set, else 10 reps or 30 s', () => {
    expect(entryPrefill('reps', previous(18), 25)).toBe(18);
    expect(entryPrefill('reps', undefined, 25)).toBe(25);
    expect(entryPrefill('reps', undefined, undefined)).toBe(10);
    expect(entryPrefill('time', undefined, undefined)).toBe(30);
    expect(entryPrefill('reps', undefined, 90)).toBe(50);
  });
});

describe('verdicts and records', () => {
  it('compares with the last test', () => {
    expect(verdictOf(24, 18)).toBe('better');
    expect(verdictOf(18, 18)).toBe('same');
    expect(verdictOf(12, 18)).toBe('lower');
    expect(verdictOf(12, undefined)).toBe('first');
  });

  it('builds a session test under the log id and a pain stop without a result flag lost', () => {
    const test = buildTest({
      id: 'log1-test',
      kind: 'reps',
      exerciseId: 'push-up',
      value: 24,
      now: new Date('2026-11-17T10:00:00Z'),
      localDate: '2026-11-17',
      context: 'session',
      logId: 'log1',
      programmeId: 'p1',
    });
    expect(test).toMatchObject({
      id: 'log1-test',
      context: 'session',
      logId: 'log1',
      programmeId: 'p1',
      result: { kind: 'reps', reps: 24 },
    });
    const pain = buildTest({
      id: 'x',
      kind: 'time',
      exerciseId: 'plank',
      value: 40,
      now: new Date(),
      localDate: '2026-11-17',
      context: 'fresh',
      stopped: 'pain',
    });
    expect(pain.stopped).toBe('pain');
    expect(pain.result).toEqual({ kind: 'time', seconds: 40 });
  });

  it('formats holds as m:ss', () => {
    expect(valueText('time', 72)).toBe('1:12');
    expect(valueText('time', 180)).toBe('3:00');
    expect(valueText('reps', 24)).toBe('24');
  });
});
