import type { MaxTest, SessionTest } from '@/domain';
import { HOLD_TEST_CAP_SEC, REP_TEST_CAP, TEST_REST_SEC } from '@/engine';

/** Countdown before a hold test starts. */
export const TEST_LEAD_IN_SEC = 3;

export type TestKind = SessionTest['kind'];

/**
 * - `intro`: the test in hand: what to beat and the rules; the rest comes first.
 * - `rest`: the rest before the test.
 * - `ready`: a hold test waiting for its start (after the rest, or on its own).
 * - `lead-in` / `running`: a hold test about to start / counting up.
 * - `set`: a rep test; the user counts and says when done.
 * - `entry`: the result to confirm.
 */
export type TestStage =
  | { kind: 'intro' }
  | { kind: 'rest'; startedAt: number; endsAt: number }
  | { kind: 'ready' }
  | { kind: 'lead-in'; endsAt: number }
  | { kind: 'running'; startedAt: number }
  | { kind: 'set' }
  | { kind: 'entry'; value: number };

export interface TestFlow {
  kind: TestKind;
  stage: TestStage;
  /** Set while paused (epoch ms). */
  pausedAt?: number;
}

/** The most a test can record: 50 reps, three minutes. */
export const testCap = (kind: TestKind): number =>
  kind === 'reps' ? REP_TEST_CAP : HOLD_TEST_CAP_SEC;

/** In a session the test starts with its intro; on its own, straight on the set (reps) or the start (holds). */
export function openTest(kind: TestKind, mode: 'session' | 'fresh'): TestFlow {
  if (mode === 'session') return { kind, stage: { kind: 'intro' } };
  return { kind, stage: kind === 'reps' ? { kind: 'set' } : { kind: 'ready' } };
}

const afterRest = (flow: TestFlow): TestFlow => ({
  ...flow,
  stage: flow.kind === 'reps' ? { kind: 'set' } : { kind: 'ready' },
});

export function startRest(flow: TestFlow, now: number): TestFlow {
  if (flow.stage.kind !== 'intro' || flow.pausedAt !== undefined) return flow;
  return { ...flow, stage: { kind: 'rest', startedAt: now, endsAt: now + TEST_REST_SEC * 1000 } };
}

/** ±15 s on the rest; at zero it is over. */
export function adjustRest(flow: TestFlow, deltaSec: number, now: number): TestFlow {
  const stage = flow.stage;
  if (stage.kind !== 'rest' || flow.pausedAt !== undefined) return flow;
  const endsAt = Math.max(now, stage.endsAt + deltaSec * 1000);
  return endsAt <= now ? afterRest(flow) : { ...flow, stage: { ...stage, endsAt } };
}

export function skipRest(flow: TestFlow): TestFlow {
  return flow.stage.kind === 'rest' && flow.pausedAt === undefined ? afterRest(flow) : flow;
}

export function startHold(flow: TestFlow, now: number): TestFlow {
  if (flow.stage.kind !== 'ready' || flow.pausedAt !== undefined) return flow;
  return { ...flow, stage: { kind: 'lead-in', endsAt: now + TEST_LEAD_IN_SEC * 1000 } };
}

/** Seconds a running hold has counted, never past the cap. */
export function heldSeconds(flow: TestFlow, now: number): number {
  const stage = flow.stage;
  if (stage.kind !== 'running') return 0;
  const at = flow.pausedAt ?? now;
  return Math.min(HOLD_TEST_CAP_SEC, Math.max(0, Math.floor((at - stage.startedAt) / 1000)));
}

/** Moves the clocks on: the rest ends, the lead-in turns into the count, a hold stops at three minutes. */
export function tickTest(flow: TestFlow, now: number): TestFlow {
  if (flow.pausedAt !== undefined) return flow;
  const stage = flow.stage;
  if (stage.kind === 'rest' && now >= stage.endsAt) return afterRest(flow);
  if (stage.kind === 'lead-in' && now >= stage.endsAt)
    return tickTest({ ...flow, stage: { kind: 'running', startedAt: stage.endsAt } }, now);
  if (stage.kind === 'running' && now >= stage.startedAt + HOLD_TEST_CAP_SEC * 1000)
    return { ...flow, stage: { kind: 'entry', value: HOLD_TEST_CAP_SEC } };
  return flow;
}

/** The set is over: reps go to the entry at `prefill`; a hold goes with the time it held. */
export function finishSet(flow: TestFlow, now: number, prefill: number): TestFlow {
  if (flow.pausedAt !== undefined) return flow;
  const stage = flow.stage;
  if (stage.kind === 'set')
    return { ...flow, stage: { kind: 'entry', value: clampTest(flow.kind, prefill) } };
  if (stage.kind === 'running')
    return { ...flow, stage: { kind: 'entry', value: heldSeconds(flow, now) } };
  return flow;
}

export const clampTest = (kind: TestKind, value: number): number =>
  Math.min(testCap(kind), Math.max(0, Math.round(value)));

export function setEntry(flow: TestFlow, value: number): TestFlow {
  if (flow.stage.kind !== 'entry') return flow;
  return { ...flow, stage: { kind: 'entry', value: clampTest(flow.kind, value) } };
}

/** A hold in progress starts over after a pause; rest and lead-in clocks keep their remaining time. */
export function pauseTest(flow: TestFlow, now: number): TestFlow {
  if (flow.pausedAt !== undefined) return flow;
  const stage = flow.stage;
  if (stage.kind === 'running' || stage.kind === 'lead-in')
    return { ...flow, stage: { kind: 'ready' }, pausedAt: now };
  return { ...flow, pausedAt: now };
}

export function resumeTest(flow: TestFlow, now: number): TestFlow {
  if (flow.pausedAt === undefined) return flow;
  const shift = now - flow.pausedAt;
  const stage = flow.stage;
  const moved: TestStage =
    stage.kind === 'rest'
      ? { ...stage, startedAt: stage.startedAt + shift, endsAt: stage.endsAt + shift }
      : stage;
  const resumed = { ...flow, stage: moved };
  delete resumed.pausedAt;
  return resumed;
}

/** Seconds left on the rest. */
export function restSeconds(flow: TestFlow, now: number): number {
  const stage = flow.stage;
  if (stage.kind !== 'rest') return 0;
  return Math.max(0, Math.ceil((stage.endsAt - (flow.pausedAt ?? now)) / 1000));
}

/** Seconds left on the lead-in. */
export function leadInSeconds(flow: TestFlow, now: number): number {
  const stage = flow.stage;
  if (stage.kind !== 'lead-in') return 0;
  return Math.max(0, Math.ceil((stage.endsAt - (flow.pausedAt ?? now)) / 1000));
}

/**
 * What the result entry starts at: the last test of the same context; else the cycle's best set
 * of the exercise; else 10 reps or 30 s; never past the cap.
 */
export function entryPrefill(
  kind: TestKind,
  previous: MaxTest | undefined,
  best: number | undefined,
): number {
  const fromTest =
    previous && previous.result.kind === kind
      ? previous.result.kind === 'reps'
        ? previous.result.reps
        : previous.result.seconds
      : undefined;
  return clampTest(kind, fromTest ?? best ?? (kind === 'reps' ? 10 : 30));
}

/** The number of a stored result. */
export const resultValue = (test: Pick<MaxTest, 'result'>): number =>
  test.result.kind === 'reps' ? test.result.reps : test.result.seconds;

/** How a result compares with the last one of its context. */
export type TestVerdict = 'first' | 'better' | 'same' | 'lower';

export function verdictOf(value: number, previous: number | undefined): TestVerdict {
  if (previous === undefined) return 'first';
  return value > previous ? 'better' : value < previous ? 'lower' : 'same';
}

/** A new max test record; `id` is the log's for a session test, so saving twice replaces it. */
export function buildTest(input: {
  id: string;
  kind: TestKind;
  exerciseId: string;
  value: number;
  now: Date;
  localDate: string;
  context: MaxTest['context'];
  logId?: string;
  programmeId?: string;
  stopped?: 'pain';
}): MaxTest {
  const { id, kind, exerciseId, value, now, localDate, context, logId, programmeId, stopped } =
    input;
  return {
    id,
    date: localDate,
    at: now.toISOString(),
    exerciseId,
    context,
    ...(logId && { logId }),
    ...(programmeId && { programmeId }),
    ...(stopped && { stopped }),
    result: kind === 'reps' ? { kind: 'reps', reps: value } : { kind: 'time', seconds: value },
  };
}
