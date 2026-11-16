import {
  setLogKey,
  type Feel,
  type LiveClock,
  type SessionLog,
  type SetActual,
  type SetFlag,
  type SetLog,
  type Target,
} from '@/domain';
import {
  asPlanned,
  setGoal,
  pauseBetween,
  playSteps,
  restOfExercise,
  setLogBase,
  type Pause,
  type PlayStep,
} from '@/engine';

/** Countdown before a timed set started by a tap. */
export const LEAD_IN_SEC = 3;

/**
 * - `set`: the set is on screen. Rep sets wait for Done; timed sets wait for Start.
 * - `lead-in`: countdown before a timed set.
 * - `timing`: a hold, steady cardio or intervals running.
 * - `pause`: between two steps (rest, side switch, next exercise, next block).
 * - `finished`: every step is logged.
 */
export type Phase =
  | { kind: 'set' }
  | { kind: 'lead-in'; endsAt: number }
  | { kind: 'timing'; startedAt: number }
  | { kind: 'pause'; pause: Pause; startedAt: number; endsAt: number }
  | { kind: 'finished' };

export interface PlayerState {
  steps: readonly PlayStep[];
  logged: ReadonlySet<string>;
  /** Current step; `steps.length` once finished. */
  index: number;
  /** Last performed step, which the pause after it depends on. */
  last?: number;
  phase: Phase;
  /** Feel selected for the current step; back to "right" on every new step. */
  feel: Feel;
  /** The feel was picked rather than left on its default. */
  feelChosen: boolean;
  /** The rest timer before the current step as it ran. */
  restBefore?: number;
  /** Set while the session is paused (epoch ms). */
  pausedAt?: number;
}

/** A state change and the sets it logged, which the screen persists. */
export interface Transition {
  state: PlayerState;
  sets: SetLog[];
}

type TimedTarget = Extract<Target, { kind: 'time' | 'cardio' | 'interval' }>;

export const isTimed = (step: PlayStep | undefined): boolean =>
  !!step && ['time', 'cardio', 'interval'].includes(step.planned.target.kind);

export const currentStep = (state: PlayerState): PlayStep | undefined => state.steps[state.index];

const ms = (iso: string) => Date.parse(iso);
const iso = (epoch: number) => new Date(epoch).toISOString();
const unchanged = (state: PlayerState): Transition => ({ state, sets: [] });

function firstOpen(steps: readonly PlayStep[], logged: ReadonlySet<string>, from = 0): number {
  for (let i = from; i < steps.length; i++) if (!logged.has(setLogKey(steps[i]!))) return i;
  return steps.length;
}

/** Rebuilds the player from a stored log: on the first step not logged, with any clock still running. */
export function playerFromLog(log: SessionLog, now: number): PlayerState {
  const steps = playSteps(log.plan, log.adjustments);
  const byKey = new Map(log.sets.map((set) => [setLogKey(set), set]));
  const logged = new Set(byKey.keys());
  const index = firstOpen(steps, logged);
  let last: number | undefined;
  for (let i = index - 1; i >= 0; i--)
    if (byKey.get(setLogKey(steps[i]!))?.actual) {
      last = i;
      break;
    }
  const base: PlayerState = {
    steps,
    logged,
    index,
    ...(last !== undefined && { last }),
    phase: index >= steps.length ? { kind: 'finished' } : { kind: 'set' },
    feel: 'right',
    feelChosen: false,
    ...(log.pausedAt && { pausedAt: ms(log.pausedAt) }),
  };
  const live = log.live;
  if (!live || base.phase.kind === 'finished') return base;
  if (live.kind === 'timing')
    return isTimed(steps[index])
      ? { ...base, phase: { kind: 'timing', startedAt: ms(live.startedAt) } }
      : base;
  const pauseStart = ms(live.startedAt);
  const pause: Pause = {
    kind: live.pause,
    seconds: Math.round((ms(live.endsAt) - pauseStart) / 1000),
  };
  const restored = {
    ...base,
    phase: { kind: 'pause' as const, pause, startedAt: pauseStart, endsAt: ms(live.endsAt) },
  };
  // A rest that ran out while the app was closed is over; a paused session keeps it.
  return base.pausedAt ? restored : tick(restored, now).state;
}

/** The clock to store with the log, so the player can be rebuilt after the app is closed. */
export function liveClock(state: PlayerState): LiveClock | null {
  const phase = state.phase;
  if (phase.kind === 'timing') return { kind: 'timing', startedAt: iso(phase.startedAt) };
  if (phase.kind === 'pause' && phase.pause.kind !== 'end')
    return {
      kind: 'pause',
      pause: phase.pause.kind,
      startedAt: iso(phase.startedAt),
      endsAt: iso(phase.endsAt),
    };
  return null;
}

/** Moves on to the next open step after logging `sets`, with the pause that goes between. */
function advance(
  state: PlayerState,
  sets: SetLog[],
  now: number,
  options: { performed: boolean },
): Transition {
  const logged = new Set(state.logged);
  for (const set of sets) logged.add(setLogKey(set));
  const done = state.index;
  const next = firstOpen(state.steps, logged);
  const last = options.performed ? done : state.last;
  const base: PlayerState = {
    ...state,
    logged,
    index: next,
    ...(last !== undefined && { last }),
    feel: 'right',
    feelChosen: false,
  };
  delete base.restBefore;
  if (next >= state.steps.length) return { state: { ...base, phase: { kind: 'finished' } }, sets };
  // Stopping an exercise goes straight on: there is nothing to rest from.
  const pause = options.performed
    ? pauseBetween(state.steps[done]!, state.steps[next])
    : { kind: 'end' as const, seconds: 0 };
  const phase: Phase =
    pause.seconds > 0
      ? { kind: 'pause', pause, startedAt: now, endsAt: now + pause.seconds * 1000 }
      : { kind: 'set' };
  return { state: { ...base, phase }, sets };
}

function performedSet(state: PlayerState, actual: SetActual, now: number, edited = false): SetLog {
  const step = currentStep(state)!;
  return {
    ...setLogBase(step),
    actual,
    ...(edited && { edited: true }),
    ...(step.section !== 'warmup' && {
      feel: state.feel,
      ...(state.feelChosen && { feelChosen: true }),
    }),
    ...(state.restBefore !== undefined && { restSec: state.restBefore }),
    at: iso(now),
  };
}

export function setFeel(state: PlayerState, feel: Feel): PlayerState {
  return { ...state, feel, feelChosen: true };
}

/** Logs the current step with values entered or changed in the edit sheet. */
export function logSet(state: PlayerState, actual: SetActual, now: number): Transition {
  if (!currentStep(state) || state.pausedAt) return unchanged(state);
  return advance(state, [performedSet(state, actual, now, true)], now, { performed: true });
}

/**
 * "Done as planned"; null when the set needs input (as many reps as possible) or only its timer
 * can tell (cardio, intervals). A hold logged this way records the bottom of its range.
 */
export function logAsPlanned(state: PlayerState, now: number): Transition | null {
  const step = currentStep(state);
  const actual = step && asPlanned(step.planned);
  if (!actual || state.pausedAt) return null;
  return advance(state, [performedSet(state, actual, now)], now, { performed: true });
}

/**
 * Ends the current exercise for this session: its remaining sets are logged with the flag.
 * With pain, the current set keeps the reps done before it hurt, if given.
 */
export function stopExercise(
  state: PlayerState,
  flag: SetFlag,
  now: number,
  partial?: SetActual,
): Transition {
  const current = currentStep(state);
  if (!current || state.pausedAt) return unchanged(state);
  const sets = restOfExercise(state.steps, state.index)
    .filter((step) => !state.logged.has(setLogKey(step)))
    .map((step): SetLog => ({
      ...setLogBase(step),
      ...(flag === 'pain' && partial && step === current && { actual: partial }),
      flag,
      at: iso(now),
    }));
  return advance(state, sets, now, { performed: false });
}

/** Start on a timed set: a short countdown, then the timer. */
export function startTimer(state: PlayerState, now: number): PlayerState {
  if (state.phase.kind !== 'set' || !isTimed(currentStep(state)) || state.pausedAt) return state;
  return { ...state, phase: { kind: 'lead-in', endsAt: now + LEAD_IN_SEC * 1000 } };
}

const elapsedSec = (state: PlayerState, startedAt: number, now: number) =>
  Math.max(0, ((state.pausedAt ?? now) - startedAt) / 1000);

export interface IntervalClock {
  round: number;
  part: 'work' | 'recovery';
  remainingSec: number;
  completedRounds: number;
  done: boolean;
}

/** Where a work/recovery interval set stands after `elapsed` seconds. */
export function intervalClock(
  target: Extract<Target, { kind: 'interval' }>,
  elapsed: number,
): IntervalClock {
  const roundSec = target.workSec + target.recoverySec;
  if (elapsed >= target.rounds * roundSec)
    return {
      round: target.rounds,
      part: 'recovery',
      remainingSec: 0,
      completedRounds: target.rounds,
      done: true,
    };
  const round = Math.floor(elapsed / roundSec) + 1;
  const into = elapsed - (round - 1) * roundSec;
  const work = into < target.workSec;
  return {
    round,
    part: work ? 'work' : 'recovery',
    remainingSec: work ? target.workSec - into : roundSec - into,
    completedRounds: work ? round - 1 : round,
    done: false,
  };
}

/** What a timed set records when it ends after `elapsed` seconds: the timer, not the plan. */
function timedActual(step: PlayStep, elapsed: number): SetActual {
  const target = step.planned.target as TimedTarget;
  const durationSec = Math.round(elapsed);
  switch (target.kind) {
    case 'time':
      return { durationSec, ...(step.planned.load && { load: step.planned.load }) };
    case 'cardio':
      return {
        durationSec,
        ...(target.speedKmh && { speedKmh: target.speedKmh }),
        ...(target.inclinePct !== undefined && { inclinePct: target.inclinePct }),
      };
    case 'interval':
      return {
        durationSec,
        rounds: intervalClock(target, elapsed).completedRounds,
        ...(target.workSpeedKmh && { speedKmh: target.workSpeedKmh }),
        ...(target.workInclinePct !== undefined && { inclinePct: target.workInclinePct }),
      };
  }
}

/** Ends a running timer by hand: a hold stopped early, cardio done, intervals cut short. */
/** Ends the current work or recovery part of an interval set now; the next part starts. */
export function skipIntervalPart(state: PlayerState, now: number): PlayerState {
  const step = currentStep(state);
  const target = step?.planned.target;
  if (state.phase.kind !== 'timing' || target?.kind !== 'interval' || state.pausedAt) return state;
  const clock = intervalClock(target, elapsedSec(state, state.phase.startedAt, now));
  if (clock.done) return state;
  return {
    ...state,
    phase: { kind: 'timing', startedAt: state.phase.startedAt - clock.remainingSec * 1000 },
  };
}

export function finishTimer(state: PlayerState, now: number): Transition {
  const step = currentStep(state);
  if (state.phase.kind !== 'timing' || !step) return unchanged(state);
  const actual = timedActual(step, elapsedSec(state, state.phase.startedAt, now));
  return advance({ ...state, pausedAt: undefined }, [performedSet(state, actual, now)], now, {
    performed: true,
  });
}

/** Seconds a timed set runs on its own before it completes; undefined when only the user ends it. */
function autoEndSec(step: PlayStep): number | undefined {
  const target = step.planned.target;
  // A hold counts down from its goal (the bottom of its range when it has none), as "done as
  // planned" logs it; stopping earlier records the time held.
  if (target.kind === 'time') return setGoal(step.planned);
  if (target.kind === 'interval') return target.rounds * (target.workSec + target.recoverySec);
  return undefined;
}

function endPause(state: PlayerState, at: number): PlayerState {
  if (state.phase.kind !== 'pause') return state;
  const { pause, startedAt } = state.phase;
  const ran = Math.round((at - startedAt) / 1000);
  const timedNext = isTimed(currentStep(state));
  return {
    ...state,
    ...(pause.kind !== 'side' && { restBefore: ran }),
    // Switching sides on a timed set leads straight into the other side.
    phase: pause.kind === 'side' && timedNext ? { kind: 'timing', startedAt: at } : { kind: 'set' },
  };
}

/** Moves clocks on: ends a countdown, a pause, or a timed set that ran its course. */
export function tick(state: PlayerState, now: number): Transition {
  if (state.pausedAt) return unchanged(state);
  const phase = state.phase;
  if (phase.kind === 'lead-in' && now >= phase.endsAt)
    return tick({ ...state, phase: { kind: 'timing', startedAt: phase.endsAt } }, now);
  if (phase.kind === 'pause' && now >= phase.endsAt)
    return tick(endPause(state, phase.endsAt), now);
  if (phase.kind === 'timing') {
    const step = currentStep(state)!;
    const end = autoEndSec(step);
    if (end !== undefined && now >= phase.startedAt + end * 1000) {
      const at = phase.startedAt + end * 1000;
      return advance(state, [performedSet(state, timedActual(step, end), at)], at, {
        performed: true,
      });
    }
  }
  return unchanged(state);
}

/** ±15 s on the running pause; never below zero. */
export function adjustPause(state: PlayerState, deltaSec: number, now: number): PlayerState {
  const phase = state.phase;
  if (phase.kind !== 'pause') return state;
  const endsAt = Math.max(now, phase.endsAt + deltaSec * 1000);
  const adjusted = { ...state, phase: { ...phase, endsAt } };
  return endsAt <= now ? endPause(adjusted, now) : adjusted;
}

export function skipPause(state: PlayerState, now: number): PlayerState {
  return state.phase.kind === 'pause' ? endPause(state, now) : state;
}

/** Pausing drops a hold in progress (it starts over); cardio and intervals keep their clock. */
export function pausePlayer(state: PlayerState, now: number): PlayerState {
  if (state.pausedAt) return state;
  const phase = state.phase;
  const dropsAttempt =
    phase.kind === 'lead-in' ||
    (phase.kind === 'timing' && currentStep(state)?.planned.target.kind === 'time');
  return { ...state, ...(dropsAttempt && { phase: { kind: 'set' } }), pausedAt: now };
}

/** Skips a warm-up item: logged as skipped, straight on to the next step. */
export function skipStep(state: PlayerState, now: number): Transition {
  const step = currentStep(state);
  if (!step || step.section !== 'warmup' || state.pausedAt) return unchanged(state);
  const set: SetLog = { ...setLogBase(step), flag: 'skipped', at: iso(now) };
  return advance(state, [set], now, { performed: false });
}

/** Resumes where it stopped: running clocks are shifted by the time spent paused. */
export function resumePlayer(state: PlayerState, now: number): PlayerState {
  if (!state.pausedAt) return state;
  const shift = now - state.pausedAt;
  const phase = state.phase;
  const shifted: Phase =
    phase.kind === 'lead-in'
      ? { ...phase, endsAt: phase.endsAt + shift }
      : phase.kind === 'timing'
        ? { ...phase, startedAt: phase.startedAt + shift }
        : phase.kind === 'pause'
          ? { ...phase, startedAt: phase.startedAt + shift, endsAt: phase.endsAt + shift }
          : phase;
  const resumed = { ...state, phase: shifted };
  delete resumed.pausedAt;
  return resumed;
}

/** Seconds left on the running countdown (lead-in, pause, timed set), or elapsed for open-ended cardio. */
export function clockSeconds(state: PlayerState, now: number): number {
  const at = state.pausedAt ?? now;
  const phase = state.phase;
  if (phase.kind === 'lead-in' || phase.kind === 'pause')
    return Math.max(0, Math.ceil((phase.endsAt - at) / 1000));
  if (phase.kind === 'timing') {
    const end = autoEndSec(currentStep(state)!);
    const elapsed = (at - phase.startedAt) / 1000;
    return end === undefined ? Math.floor(elapsed) : Math.max(0, Math.ceil(end - elapsed));
  }
  return 0;
}
