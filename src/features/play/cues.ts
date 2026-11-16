import { setGoal } from '@/engine';
import { clockSeconds, currentStep, intervalClock, type PlayerState } from './machine';

/**
 * What the player signals between two readings of its state.
 * - `tick`: one of the last three seconds of a countdown.
 * - `go`: a countdown ran out, or an interval switched between work and recovery.
 * - `announce`: a new set is on screen; say what it is.
 */
export type Cue = { kind: 'tick' } | { kind: 'go' } | { kind: 'announce'; index: number };

export interface Reading {
  state: PlayerState;
  now: number;
}

const COUNTDOWN_TICKS = new Set([1, 2, 3]);

/** Identifies the countdown on screen, so ticks never carry over from one countdown to the next. */
function countdownId(state: PlayerState): string | null {
  const phase = state.phase;
  if (phase.kind === 'pause') return `pause/${phase.startedAt}/${phase.endsAt}`;
  if (phase.kind === 'lead-in') return `lead-in/${phase.endsAt}`;
  if (phase.kind === 'timing') {
    const target = currentStep(state)?.planned.target;
    // Open-ended cardio counts up: nothing to count down.
    if (target?.kind === 'time' || target?.kind === 'interval')
      return `timing/${state.index}/${phase.startedAt}`;
  }
  return null;
}

function intervalPart(reading: Reading): string | null {
  const { state, now } = reading;
  const target = currentStep(state)?.planned.target;
  if (state.phase.kind !== 'timing' || target?.kind !== 'interval') return null;
  const elapsed = Math.max(0, ((state.pausedAt ?? now) - state.phase.startedAt) / 1000);
  const clock = intervalClock(target, elapsed);
  return `${clock.round}/${clock.part}`;
}

/** Seconds left before the current interval part ends, for its own countdown ticks. */
function intervalPartSeconds(reading: Reading): number | null {
  const { state, now } = reading;
  const target = currentStep(state)?.planned.target;
  if (state.phase.kind !== 'timing' || target?.kind !== 'interval') return null;
  const elapsed = Math.max(0, ((state.pausedAt ?? now) - state.phase.startedAt) / 1000);
  return Math.ceil(intervalClock(target, elapsed).remainingSec);
}

/** The cues to give between two readings of the player. Nothing while the session is paused. */
export function cuesBetween(prev: Reading, next: Reading): Cue[] {
  if (next.state.pausedAt !== undefined || next.state.phase.kind === 'finished') return [];
  const cues: Cue[] = [];
  const before = prev.state.phase.kind;
  const after = next.state.phase.kind;
  const sameCountdown =
    countdownId(prev.state) !== null && countdownId(prev.state) === countdownId(next.state);

  if (sameCountdown) {
    const interval = intervalPartSeconds(next);
    const from =
      interval === null ? clockSeconds(prev.state, prev.now) : intervalPartSeconds(prev)!;
    const to = interval ?? clockSeconds(next.state, next.now);
    if (to < from && COUNTDOWN_TICKS.has(to)) cues.push({ kind: 'tick' });
    const part = intervalPart(prev);
    if (part !== null && part !== intervalPart(next)) cues.push({ kind: 'go' });
    return cues;
  }

  const countdownEnded =
    (before === 'pause' || before === 'lead-in' || before === 'timing') &&
    prev.state.pausedAt === undefined;
  // A tap (Done, Skip, Start) needs no sound: only clocks running out do.
  const ranOut =
    countdownEnded &&
    ((before === 'pause' && (after === 'set' || after === 'timing')) ||
      (before === 'lead-in' && after === 'timing') ||
      (before === 'timing' && next.state.index !== prev.state.index));
  if (ranOut && next.now >= endOf(prev.state)) cues.push({ kind: 'go' });

  const newSet = after === 'set' && (before !== 'set' || next.state.index !== prev.state.index);
  if (newSet || (before === 'pause' && after === 'timing'))
    cues.push({ kind: 'announce', index: next.state.index });
  return cues;
}

/** When the countdown of a phase was due to end (∞ when it has none). */
function endOf(state: PlayerState): number {
  const phase = state.phase;
  if (phase.kind === 'pause' || phase.kind === 'lead-in') return phase.endsAt;
  if (phase.kind === 'timing') {
    const planned = currentStep(state)?.planned;
    const target = planned?.target;
    if (planned && target?.kind === 'time') return phase.startedAt + (setGoal(planned) ?? 0) * 1000;
    if (target?.kind === 'interval')
      return phase.startedAt + target.rounds * (target.workSec + target.recoverySec) * 1000;
  }
  return Number.POSITIVE_INFINITY;
}
