import { describe, expect, it } from 'vitest';
import type { Block, Session, SessionLog } from '@/domain';
import { playSteps, rampSharePct } from '@/engine';
import { progressOf } from './format';
import { currentStep, logAsPlanned, playerFromLog, skipRamp, skipStep } from './machine';
import { rampOf, rampSummary, warmupCounter } from './ramp';

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);

const ramp = (n: number, kg: number, reps: number): Block => ({
  type: 'straight',
  item: {
    slot: `ramp-${n}`,
    exerciseId: 'back-squat',
    target: { kind: 'reps', min: reps, max: reps },
    load: { kind: 'kg', kg },
  },
  sets: 1,
  restSec: 30,
});
const drill: Block = {
  type: 'straight',
  item: { exerciseId: 'arm-circles', target: { kind: 'time', minSec: 30, maxSec: 30 } },
  sets: 1,
  restSec: 0,
};
const lift: Block = {
  type: 'straight',
  item: {
    slot: 'main-1',
    exerciseId: 'back-squat',
    target: { kind: 'reps', min: 6, max: 8 },
    load: { kind: 'kg', kg: 40 },
  },
  sets: 3,
  restSec: 90,
};

const session = (warmup: Block[]): Session => ({
  id: 's',
  name: { fr: 'Séance', en: 'Session' },
  estimatedMinutes: 30,
  warmup,
  main: [lift],
  finisher: [],
});
const logOf = (plan: Session): SessionLog => ({
  id: 'l1',
  source: { kind: 'quick' },
  plan,
  status: 'in-progress',
  startedAt: new Date(T0).toISOString(),
  sets: [],
});

const withRamps = session([drill, ramp(1, 20, 10), ramp(2, 30, 5)]);

describe('ramp-up sets in the player', () => {
  it('counts the ramp sets of one lift as one warm-up item', () => {
    const steps = playSteps(withRamps);
    const warm = steps.filter((s) => s.section === 'warmup');
    expect(warm).toHaveLength(3);
    expect(warm.map((s) => warmupCounter(steps, s))).toEqual([
      { current: 1, total: 2 },
      { current: 2, total: 2 },
      { current: 2, total: 2 },
    ]);
    expect(progressOf(steps, warm[2]!)).toMatchObject({ section: 'warmup', current: 2, total: 2 });
    // The main exercises are still numbered from their own start.
    expect(progressOf(steps, steps[3]!)).toMatchObject({ section: 'main', current: 1, total: 1 });
  });

  it('is unchanged without ramp sets', () => {
    const steps = playSteps(session([drill, drill]));
    expect(warmupCounter(steps, steps[0]!)).toEqual({ current: 1, total: 2 });
  });

  it('says where a ramp set stands and its share of the working load', () => {
    const steps = playSteps(withRamps);
    expect(rampOf(steps, steps[0])).toBeUndefined();
    expect(rampOf(steps, steps[1])).toMatchObject({
      set: 1,
      count: 2,
      workingKg: 40,
      sharePct: 50,
    });
    expect(rampOf(steps, steps[2])).toMatchObject({
      set: 2,
      count: 2,
      workingKg: 40,
      sharePct: 75,
    });
  });

  it('rounds the share to the nearest 5 %', () => {
    expect(rampSharePct(22, 40)).toBe(55);
    expect(rampSharePct(20, 40)).toBe(50);
    expect(rampSharePct(24, 40)).toBe(60);
    expect(rampSharePct(10, 0)).toBe(0);
  });

  it('skips the whole ramp in one tap, logged as skipped, and the first work set is untouched', () => {
    const state = playerFromLog(logOf(withRamps), T0);
    const onFirstRamp = skipStep(state, T0).state;
    expect(currentStep(onFirstRamp)?.item.slot).toBe('ramp-1');
    const t = skipRamp(onFirstRamp, T0);
    expect(t.sets.map((s) => [s.section, s.flag])).toEqual([
      ['warmup', 'skipped'],
      ['warmup', 'skipped'],
    ]);
    expect(currentStep(t.state)?.section).toBe('main');
    expect(t.state.phase).toEqual({ kind: 'set' });
    expect(t.sets.every((s) => s.actual === undefined)).toBe(true);
  });

  it('skips only what is left of the ramp after one set was done', () => {
    let state = playerFromLog(logOf(withRamps), T0);
    state = skipStep(state, T0).state;
    state = logAsPlanned(state, T0)!.state;
    expect(rampOf(state.steps, currentStep(state))?.set).toBe(2);
    const t = skipRamp(state, T0);
    expect(t.sets).toHaveLength(1);
    expect(currentStep(t.state)?.section).toBe('main');
  });

  it('does nothing on a step that is not a ramp set', () => {
    const state = playerFromLog(logOf(withRamps), T0);
    expect(skipRamp(state, T0).sets).toEqual([]);
  });

  it('sums up the ramp sets for the summary', () => {
    const base = logOf(withRamps);
    expect(rampSummary(base)).toBeUndefined();
    const sets = playSteps(withRamps)
      .filter((s) => s.section === 'warmup' && s.item.slot)
      .map((s, i) => ({
        section: s.section,
        blockIndex: s.blockIndex,
        itemIndex: s.itemIndex,
        set: s.set,
        exerciseId: s.item.exerciseId,
        at: new Date(T0).toISOString(),
        ...(i === 0 ? { actual: { reps: 10 } } : { flag: 'skipped' as const }),
      })) as SessionLog['sets'];
    expect(rampSummary({ ...base, sets })).toEqual({ total: 2, done: 1, skipped: 1 });
  });
});
