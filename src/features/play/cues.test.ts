import { describe, expect, it } from 'vitest';
import type { Block, Session, SessionItem, SessionLog } from '@/domain';
import { cuesBetween, type Reading } from './cues';
import {
  logAsPlanned,
  pausePlayer,
  playerFromLog,
  skipPause,
  startTimer,
  tick,
  type PlayerState,
} from './machine';

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const sec = (s: number) => T0 + s * 1000;

const item = (exerciseId: string, extra: Partial<SessionItem> = {}): SessionItem => ({
  exerciseId,
  target: { kind: 'reps', min: 8, max: 10 },
  ...extra,
});
const straight = (it: SessionItem, sets: number, restSec: number): Block => ({
  type: 'straight',
  item: it,
  sets,
  restSec,
});
const start = (main: Block[]): PlayerState => {
  const plan: Session = {
    id: 's',
    name: { fr: 'S', en: 'S' },
    estimatedMinutes: 10,
    warmup: [],
    main,
    finisher: [],
  };
  const log: SessionLog = {
    id: 'l',
    source: { kind: 'quick' },
    plan,
    status: 'in-progress',
    startedAt: new Date(T0).toISOString(),
    sets: [],
  };
  return playerFromLog(log, T0);
};

const at = (state: PlayerState, s: number): Reading => ({ state, now: sec(s) });

describe('cuesBetween', () => {
  it('ticks the last three seconds of a rest, then goes and announces the next set', () => {
    const resting = logAsPlanned(start([straight(item('press'), 2, 10)]), sec(0))!.state;
    expect(cuesBetween(at(resting, 1), at(resting, 6))).toEqual([]);
    expect(cuesBetween(at(resting, 6), at(resting, 7.2))).toEqual([{ kind: 'tick' }]);
    expect(cuesBetween(at(resting, 7.2), at(resting, 8.1))).toEqual([{ kind: 'tick' }]);
    const over = tick(resting, sec(10.1)).state;
    expect(cuesBetween(at(resting, 9.5), at(over, 10.1))).toEqual([
      { kind: 'go' },
      { kind: 'announce', index: 1 },
    ]);
  });

  it('announces without a beep when the rest is skipped', () => {
    const resting = logAsPlanned(start([straight(item('press'), 2, 10)]), sec(0))!.state;
    const skipped = skipPause(resting, sec(3));
    expect(cuesBetween(at(resting, 2.9), at(skipped, 3))).toEqual([{ kind: 'announce', index: 1 }]);
  });

  it('stays quiet while paused', () => {
    const resting = logAsPlanned(start([straight(item('press'), 2, 10)]), sec(0))!.state;
    const paused = pausePlayer(resting, sec(7));
    expect(cuesBetween(at(resting, 6.5), at(paused, 8))).toEqual([]);
  });

  it('counts a hold in, ticks its last seconds and signals the end', () => {
    const hold = item('plank', { target: { kind: 'time', minSec: 20, maxSec: 30 } });
    const ready = start([straight(hold, 2, 30)]);
    const leadIn = startTimer(ready, sec(0));
    expect(cuesBetween(at(leadIn, 0.5), at(leadIn, 2.1))).toEqual([{ kind: 'tick' }]);
    const timing = tick(leadIn, sec(3.1)).state;
    expect(cuesBetween(at(leadIn, 2.9), at(timing, 3.1))).toEqual([{ kind: 'go' }]);
    expect(cuesBetween(at(timing, 30), at(timing, 31.1))).toEqual([{ kind: 'tick' }]);
    const done = tick(timing, sec(33.2)).state;
    expect(done.phase.kind).toBe('pause');
    expect(cuesBetween(at(timing, 32.9), at(done, 33.2))).toEqual([{ kind: 'go' }]);
  });

  it('signals each switch between work and recovery', () => {
    const intervals = item('run', {
      target: { kind: 'interval', rounds: 3, workSec: 20, recoverySec: 10 },
    });
    const timing = tick(startTimer(start([straight(intervals, 1, 0)]), sec(0)), sec(3)).state;
    expect(cuesBetween(at(timing, 3 + 19.5), at(timing, 3 + 20.1))).toEqual([{ kind: 'go' }]);
    expect(cuesBetween(at(timing, 3 + 26.5), at(timing, 3 + 27.1))).toEqual([{ kind: 'tick' }]);
  });

  it('does not count open-ended cardio down', () => {
    const walk = item('walk', { target: { kind: 'cardio', minMinutes: 10, maxMinutes: 15 } });
    const timing = tick(startTimer(start([straight(walk, 1, 0)]), sec(0)), sec(3)).state;
    expect(cuesBetween(at(timing, 600), at(timing, 1200))).toEqual([]);
  });
});
