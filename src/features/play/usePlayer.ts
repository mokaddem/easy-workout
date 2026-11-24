import { useCallback, useEffect, useRef, useState } from 'react';
import { requestPersistence } from '@/app/backup';
import { repo } from '@/db/repo';
import { isCooldownLog } from '@/domain';
import type { Feel, SessionLog, SetActual, SetFlag, SetLog } from '@/domain';
import { countsAsDoneByDefault, defaultCountsAsDone, isTravelLog, sessionTotals } from '@/engine';
import * as machine from './machine';
import type { PlayerState, Transition } from './machine';

/** How often running clocks are read. Countdowns show whole seconds. */
const FRAME_MS = 250;
/** Back after longer than this with nothing running: the gap is a pause from the last thing done. */
export const IDLE_GAP_MS = 10 * 60_000;

/** When an open session went idle, if the gap since then is long enough to count as a pause. */
export function idleSince(log: SessionLog, now: number): number | undefined {
  if (log.pausedAt || log.live?.kind === 'timing') return undefined;
  const last = Math.max(
    Date.parse(log.startedAt),
    ...log.sets.map((set) => Date.parse(set.at)),
    log.live?.kind === 'pause' ? Date.parse(log.live.endsAt) : 0,
  );
  return now - last > IDLE_GAP_MS ? last : undefined;
}

function initialState(log: SessionLog, now: number): PlayerState {
  const state = machine.playerFromLog(log, now);
  const idle = idleSince(log, now);
  return idle === undefined ? state : machine.pausePlayer(state, idle);
}

export interface Player {
  state: PlayerState;
  /** Clock reading of the last frame (epoch ms). */
  now: number;
  /** A write to the local database failed. */
  error?: unknown;
  doneAsPlanned: () => boolean;
  logSet: (actual: SetActual) => void;
  setFeel: (feel: Feel) => void;
  stopExercise: (flag: Exclude<SetFlag, 'skipped'>, partial?: SetActual) => void;
  skipWarmupItem: () => void;
  skipRamp: () => void;
  startTimer: () => void;
  finishTimer: () => void;
  /** Intervals: end the current work or recovery part now. */
  skipIntervalPart: () => void;
  adjustPause: (deltaSec: number) => void;
  skipPause: () => void;
  pause: () => void;
  resume: () => void;
  /** Ends the session; resolves once it is stored. */
  finish: (options: { endedEarly: boolean }) => Promise<void>;
  abandon: () => Promise<void>;
}

/**
 * Runs an open session: the player state lives here, every change is written to the local
 * database in order, and running clocks are read from timestamps, never counted.
 * Mount it under a component keyed by the log id.
 */
export function usePlayer(log: SessionLog): Player {
  const id = log.id;
  const [state, setState] = useState(() => initialState(log, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<unknown>();
  const current = useRef(state);
  const storedClock = useRef(JSON.stringify(log.live ?? null));
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback((write: () => Promise<unknown>) => {
    queue.current = queue.current.then(write).catch(setError);
    return queue.current;
  }, []);

  // Coming back to an idle session opens it paused; storing that pause is idempotent.
  useEffect(() => {
    const pausedAt = current.current.pausedAt;
    if (pausedAt !== undefined && !log.pausedAt)
      void enqueue(() => repo.pauseSession(id, new Date(pausedAt)));
  }, [enqueue, id, log.pausedAt]);

  const commit = useCallback(
    (next: PlayerState, sets: readonly SetLog[] = []) => {
      current.current = next;
      setState(next);
      setNow(Date.now());
      const clock = machine.liveClock(next);
      const key = JSON.stringify(clock);
      if (sets.length === 0 && key === storedClock.current) return;
      storedClock.current = key;
      void enqueue(() =>
        sets.length > 0 ? repo.logSets(id, sets, clock) : repo.setLive(id, clock),
      );
    },
    [enqueue, id],
  );

  const apply = useCallback(
    (step: (state: PlayerState, now: number) => Transition | PlayerState | null): boolean => {
      const result = step(current.current, Date.now());
      if (!result) return false;
      if ('sets' in result) {
        if (result.state !== current.current || result.sets.length > 0)
          commit(result.state, result.sets);
      } else if (result !== current.current) commit(result);
      return true;
    },
    [commit],
  );

  const running =
    state.pausedAt === undefined &&
    (state.phase.kind === 'lead-in' ||
      state.phase.kind === 'timing' ||
      state.phase.kind === 'pause');

  useEffect(() => {
    if (!running) return;
    const frame = () => {
      setNow(Date.now());
      apply(machine.tick);
    };
    const timer = setInterval(frame, FRAME_MS);
    document.addEventListener('visibilitychange', frame);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', frame);
    };
  }, [running, apply]);

  const finish = useCallback(
    async ({ endedEarly }: { endedEarly: boolean }) => {
      await queue.current;
      const stored = await repo.getOpenSession();
      if (!stored || stored.id !== id) return;
      // Away from home it counts when half the plan's main sets were done, as the original or a stand-in.
      // A cooldown has no such switch: it never counts towards anything.
      const countsAsDone = isCooldownLog(stored)
        ? undefined
        : isTravelLog(stored)
          ? defaultCountsAsDone(stored)
          : endedEarly
            ? countsAsDoneByDefault(sessionTotals(stored))
            : true;
      await enqueue(() =>
        repo.finishSession(id, { endedEarly, ...(countsAsDone !== undefined && { countsAsDone }) }),
      );
      // Each finished session asks again, until the browser promises to keep the data.
      void requestPersistence();
    },
    [enqueue, id],
  );

  const abandon = useCallback(async () => {
    await queue.current;
    await enqueue(() => repo.abandonSession(id));
  }, [enqueue, id]);

  return {
    state,
    now,
    error,
    doneAsPlanned: () => apply(machine.logAsPlanned),
    logSet: (actual) => void apply((s, t) => machine.logSet(s, actual, t)),
    setFeel: (feel) => void apply((s) => machine.setFeel(s, feel)),
    stopExercise: (flag, partial) =>
      void apply((s, t) => machine.stopExercise(s, flag, t, partial)),
    skipWarmupItem: () => void apply(machine.skipStep),
    skipRamp: () => void apply(machine.skipRamp),
    startTimer: () => void apply(machine.startTimer),
    finishTimer: () => void apply(machine.finishTimer),
    skipIntervalPart: () => void apply(machine.skipIntervalPart),
    adjustPause: (deltaSec) => void apply((s, t) => machine.adjustPause(s, deltaSec, t)),
    skipPause: () => void apply(machine.skipPause),
    pause: () => {
      const at = Date.now();
      apply((s) => machine.pausePlayer(s, at));
      void enqueue(() => repo.pauseSession(id, new Date(at)));
    },
    resume: () => {
      const at = Date.now();
      apply((s) => machine.resumePlayer(s, at));
      void enqueue(() => repo.resumeSession(id, new Date(at)));
    },
    finish,
    abandon,
  };
}
