import { describe, expect, it } from 'vitest';
import type { Block, Session, SessionItem, SessionLog } from '@/domain';
import { SetLogSchema } from '@/domain';
import { SIDE_SWITCH_SEC } from '@/engine';
import {
  adjustPause,
  clockSeconds,
  finishTimer,
  intervalClock,
  LEAD_IN_SEC,
  liveClock,
  logAsPlanned,
  logSet,
  pausePlayer,
  playerFromLog,
  resumePlayer,
  setFeel,
  skipIntervalPart,
  skipPause,
  skipStep,
  startTimer,
  stopExercise,
  tick,
  type PlayerState,
  type Transition,
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

const plan = (main: Block[], finisher: Block[] = []): Session => ({
  id: 's',
  name: { fr: 'Séance', en: 'Session' },
  estimatedMinutes: 30,
  warmup: [],
  main,
  finisher,
});

const logOf = (session: Session, extra: Partial<SessionLog> = {}): SessionLog => ({
  id: 'l1',
  source: { kind: 'quick' },
  plan: session,
  status: 'in-progress',
  startedAt: new Date(T0).toISOString(),
  sets: [],
  ...extra,
});

/** Applies transitions and collects the sets they logged. */
function run(start: PlayerState) {
  let state = start;
  const sets: Transition['sets'] = [];
  const apply = (t: Transition | PlayerState | null) => {
    if (!t) throw new Error('no transition');
    if ('sets' in t) {
      state = t.state;
      sets.push(...t.sets);
    } else state = t;
    return state;
  };
  return { apply, get: () => state, sets };
}

describe('straight sets', () => {
  const session = plan([straight(item('press', { load: { kind: 'kg', kg: 14 }, rir: 2 }), 2, 90)]);

  it('logs as planned, rests, and finishes', () => {
    const p = run(playerFromLog(logOf(session), T0));
    p.apply(setFeel(p.get(), 'hard'));
    p.apply(logAsPlanned(p.get(), sec(30)));
    expect(p.get().phase).toMatchObject({ kind: 'pause', pause: { kind: 'rest', seconds: 90 } });
    expect(clockSeconds(p.get(), sec(60))).toBe(60);
    p.apply(tick(p.get(), sec(125)));
    expect(p.get().phase.kind).toBe('set');
    p.apply(logSet(p.get(), { reps: 7, load: { kind: 'kg', kg: 14 } }, sec(160)));
    expect(p.get().phase.kind).toBe('finished');
    expect(p.sets).toEqual([
      expect.objectContaining({
        actual: { reps: 8, load: { kind: 'kg', kg: 14 } },
        feel: 'hard',
        feelChosen: true,
        planned: {
          target: { kind: 'reps', min: 8, max: 10 },
          load: { kind: 'kg', kg: 14 },
          rir: 2,
        },
      }),
      expect.objectContaining({ set: 2, edited: true, feel: 'right', restSec: 90 }),
    ]);
    expect(p.sets[1]!.feelChosen).toBeUndefined();
    for (const set of p.sets) SetLogSchema.parse(set);
  });

  it('adjusts and skips the rest, recording the rest as it ran', () => {
    const p = run(playerFromLog(logOf(session), T0));
    p.apply(logAsPlanned(p.get(), sec(0)));
    p.apply(adjustPause(p.get(), 15, sec(10)));
    expect(clockSeconds(p.get(), sec(10))).toBe(95);
    p.apply(adjustPause(p.get(), -15, sec(10)));
    p.apply(skipPause(p.get(), sec(40)));
    expect(p.get().phase.kind).toBe('set');
    p.apply(logAsPlanned(p.get(), sec(70)));
    expect(p.sets[1]!.restSec).toBe(40);
  });

  it('takes no input while the session is paused, and shifts the rest on resume', () => {
    const p = run(playerFromLog(logOf(session), T0));
    p.apply(logAsPlanned(p.get(), sec(0)));
    p.apply(pausePlayer(p.get(), sec(30)));
    expect(logAsPlanned(p.get(), sec(40))).toBeNull();
    expect(tick(p.get(), sec(500)).state.phase.kind).toBe('pause');
    expect(clockSeconds(p.get(), sec(500))).toBe(60);
    p.apply(resumePlayer(p.get(), sec(330)));
    expect(clockSeconds(p.get(), sec(330))).toBe(60);
  });

  it('needs reps for an as-many-as-possible set', () => {
    const p = run(
      playerFromLog(logOf(plan([straight(item('pu', { target: { kind: 'max' } }), 1, 0)])), T0),
    );
    expect(logAsPlanned(p.get(), sec(10))).toBeNull();
    p.apply(logSet(p.get(), { reps: 17 }, sec(10)));
    expect(p.sets[0]).toMatchObject({ actual: { reps: 17 }, edited: true });
  });
});

describe('stopping an exercise', () => {
  const session = plan([
    straight(item('press'), 3, 90),
    straight(item('row', { perSide: true }), 2, 60),
  ]);

  it('flags the remaining sets, keeps reps done before pain, and moves on without rest', () => {
    const p = run(playerFromLog(logOf(session), T0));
    p.apply(logAsPlanned(p.get(), sec(0)));
    p.apply(skipPause(p.get(), sec(10)));
    p.apply(stopExercise(p.get(), 'pain', sec(20), { reps: 3 }));
    expect(p.sets.slice(1)).toEqual([
      expect.objectContaining({ set: 2, flag: 'pain', actual: { reps: 3 } }),
      expect.objectContaining({ set: 3, flag: 'pain' }),
    ]);
    expect(p.sets[2]!.actual).toBeUndefined();
    expect(p.get().phase.kind).toBe('set');
    expect(p.get()).toMatchObject({ index: 3, last: 0 });
    for (const set of p.sets) SetLogSchema.parse(set);
  });

  it('flags both sides of a per-side exercise', () => {
    const p = run(playerFromLog(logOf(session), T0));
    for (let i = 0; i < 3; i++) {
      p.apply(logAsPlanned(p.get(), sec(i * 100)));
      p.apply(skipPause(p.get(), sec(i * 100 + 1)));
    }
    p.apply(stopExercise(p.get(), 'no-equipment', sec(400)));
    expect(p.sets.slice(3).map((s) => `${s.set}${s.side}`)).toEqual([
      '1left',
      '1right',
      '2left',
      '2right',
    ]);
    expect(p.get().phase.kind).toBe('finished');
  });
});

describe('timed sets', () => {
  it('counts down a hold from the top of its range after a lead-in', () => {
    const hold = item('plank', { target: { kind: 'time', minSec: 30, maxSec: 45 } });
    const p = run(playerFromLog(logOf(plan([straight(hold, 2, 30)])), T0));
    expect(logAsPlanned(p.get(), sec(0))).not.toBeNull(); // timed by hand is allowed
    p.apply(startTimer(p.get(), sec(0)));
    expect(p.get().phase).toEqual({ kind: 'lead-in', endsAt: sec(LEAD_IN_SEC) });
    p.apply(tick(p.get(), sec(10)));
    expect(p.get().phase).toEqual({ kind: 'timing', startedAt: sec(LEAD_IN_SEC) });
    expect(clockSeconds(p.get(), sec(10))).toBe(38);
    p.apply(tick(p.get(), sec(60)));
    expect(p.sets[0]!.actual).toEqual({ durationSec: 45 });
    // Completed when the countdown ran out, then rest from that moment.
    expect(p.get().phase).toMatchObject({ kind: 'pause', startedAt: sec(48), endsAt: sec(78) });
  });

  it('records a hold stopped early as timed', () => {
    const hold = item('plank', { target: { kind: 'time', minSec: 30, maxSec: 45 } });
    const p = run(playerFromLog(logOf(plan([straight(hold, 1, 0)])), T0));
    p.apply(startTimer(p.get(), sec(0)));
    p.apply(tick(p.get(), sec(5)));
    p.apply(finishTimer(p.get(), sec(23)));
    expect(p.sets[0]!.actual).toEqual({ durationSec: 20 });
  });

  it('runs straight into the second side of a timed per-side hold', () => {
    const hold = item('side-plank', {
      target: { kind: 'time', minSec: 20, maxSec: 30 },
      perSide: true,
    });
    const p = run(playerFromLog(logOf(plan([straight(hold, 1, 0)])), T0));
    p.apply(startTimer(p.get(), sec(0)));
    p.apply(tick(p.get(), sec(40)));
    expect(p.get().phase).toMatchObject({ kind: 'pause', pause: { kind: 'side' } });
    const switched = sec(33 + SIDE_SWITCH_SEC);
    p.apply(tick(p.get(), switched));
    expect(p.get().phase).toEqual({ kind: 'timing', startedAt: switched });
    p.apply(tick(p.get(), switched + 30_000));
    expect(p.sets.map((s) => s.side)).toEqual(['left', 'right']);
    expect(p.get().phase.kind).toBe('finished');
  });

  it('logs the cardio time when the user is done', () => {
    const walk = item('walk', {
      target: { kind: 'cardio', minMinutes: 15, maxMinutes: 20, inclinePct: 8 },
    });
    const p = run(
      playerFromLog(logOf(plan([straight(item('press'), 1, 0)], [straight(walk, 1, 0)])), T0),
    );
    p.apply(logAsPlanned(p.get(), sec(0)));
    p.apply(tick(p.get(), sec(100)));
    expect(logAsPlanned(p.get(), sec(100))).toBeNull();
    p.apply(startTimer(p.get(), sec(100)));
    p.apply(tick(p.get(), sec(100 + 40 * 60))); // never ends on its own
    expect(p.get().phase.kind).toBe('timing');
    expect(clockSeconds(p.get(), sec(103 + 60))).toBe(60);
    p.apply(finishTimer(p.get(), sec(103 + 17 * 60)));
    expect(p.sets[1]!.actual).toEqual({ durationSec: 17 * 60, inclinePct: 8 });
  });

  it('tracks interval rounds and records the rounds completed', () => {
    const target = { kind: 'interval' as const, rounds: 4, workSec: 30, recoverySec: 60 };
    expect(intervalClock(target, 10)).toMatchObject({ round: 1, part: 'work', remainingSec: 20 });
    expect(intervalClock(target, 40)).toMatchObject({
      round: 1,
      part: 'recovery',
      remainingSec: 50,
      completedRounds: 1,
    });
    expect(intervalClock(target, 360)).toMatchObject({ done: true, completedRounds: 4 });
    const p = run(playerFromLog(logOf(plan([straight(item('run', { target }), 1, 0)])), T0));
    p.apply(startTimer(p.get(), sec(0)));
    p.apply(tick(p.get(), sec(3)));
    p.apply(finishTimer(p.get(), sec(3 + 200)));
    expect(p.sets[0]!.actual).toEqual({ durationSec: 200, rounds: 2 });
  });
});

describe('interval parts', () => {
  it('skips the rest of the current part', () => {
    const target = { kind: 'interval' as const, rounds: 3, workSec: 30, recoverySec: 60 };
    const p = run(playerFromLog(logOf(plan([straight(item('run', { target }), 1, 0)])), T0));
    p.apply(startTimer(p.get(), sec(0)));
    p.apply(tick(p.get(), sec(13))); // 10 s into round 1 work
    p.apply(skipIntervalPart(p.get(), sec(13)));
    const phase = p.get().phase;
    const elapsed = phase.kind === 'timing' ? (sec(13) - phase.startedAt) / 1000 : -1;
    expect(intervalClock(target, elapsed)).toMatchObject({
      round: 1,
      part: 'recovery',
      remainingSec: 60,
    });
    p.apply(skipIntervalPart(p.get(), sec(13)));
    const next = p.get().phase;
    const after = next.kind === 'timing' ? (sec(13) - next.startedAt) / 1000 : -1;
    expect(intervalClock(target, after)).toMatchObject({ round: 2, part: 'work' });
  });
});

describe('rebuilding from the stored log', () => {
  const session = plan([straight(item('press'), 3, 90)]);

  it('resumes on the next set with a rest still running', () => {
    const first = run(playerFromLog(logOf(session), T0));
    first.apply(logAsPlanned(first.get(), sec(0)));
    const live = liveClock(first.get());
    expect(live).toMatchObject({ kind: 'pause', pause: 'rest' });
    const log = logOf(session, { sets: first.sets, live: live! });
    const back = playerFromLog(log, sec(30));
    expect(back).toMatchObject({ index: 1, last: 0, phase: { kind: 'pause' } });
    expect(clockSeconds(back, sec(30))).toBe(60);
    // A rest that ran out while the app was closed is over.
    expect(playerFromLog(log, sec(300)).phase.kind).toBe('set');
  });

  it('keeps a paused session paused, with its rest', () => {
    const first = run(playerFromLog(logOf(session), T0));
    first.apply(logAsPlanned(first.get(), sec(0)));
    const log = logOf(session, {
      sets: first.sets,
      live: liveClock(first.get())!,
      pausedAt: new Date(sec(20)).toISOString(),
    });
    const back = playerFromLog(log, sec(3000));
    expect(back.phase.kind).toBe('pause');
    expect(clockSeconds(resumePlayer(back, sec(3000)), sec(3000))).toBe(70);
  });

  it('is finished when every set is logged', () => {
    const single = plan([straight(item('press'), 1, 0)]);
    const p = run(playerFromLog(logOf(single), T0));
    p.apply(logAsPlanned(p.get(), sec(0)));
    expect(liveClock(p.get())).toBeNull();
    expect(playerFromLog(logOf(single, { sets: p.sets }), sec(10)).phase.kind).toBe('finished');
  });
});

describe('pausing and skipping', () => {
  it('drops a hold in progress but keeps cardio running', () => {
    const hold = item('plank', { target: { kind: 'time', minSec: 30, maxSec: 45 } });
    const walk = item('walk', { target: { kind: 'cardio', minMinutes: 10, maxMinutes: 15 } });
    const p = run(playerFromLog(logOf(plan([straight(hold, 1, 0)], [straight(walk, 1, 0)])), T0));
    p.apply(startTimer(p.get(), sec(0)));
    p.apply(tick(p.get(), sec(10)));
    p.apply(pausePlayer(p.get(), sec(10)));
    expect(p.get().phase.kind).toBe('set');
    p.apply(resumePlayer(p.get(), sec(20)));
    p.apply(logAsPlanned(p.get(), sec(20)));
    p.apply(tick(p.get(), sec(100)));
    p.apply(startTimer(p.get(), sec(100)));
    p.apply(tick(p.get(), sec(203)));
    p.apply(pausePlayer(p.get(), sec(203)));
    expect(p.get().phase.kind).toBe('timing');
    p.apply(resumePlayer(p.get(), sec(300)));
    expect(clockSeconds(p.get(), sec(300))).toBe(100);
  });

  it('skips warm-up items only', () => {
    const session: Session = {
      ...plan([straight(item('press'), 1, 0)]),
      warmup: [straight(item('arm-circles'), 1, 0)],
    };
    const p = run(playerFromLog(logOf(session), T0));
    p.apply(skipStep(p.get(), sec(5)));
    expect(p.sets[0]).toMatchObject({ section: 'warmup', flag: 'skipped' });
    expect(p.get().phase.kind).toBe('set');
    expect(skipStep(p.get(), sec(6)).sets).toEqual([]);
    for (const set of p.sets) SetLogSchema.parse(set);
  });
});
