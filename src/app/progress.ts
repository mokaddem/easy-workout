import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { exerciseById } from '@/catalogue';
import type { Answer, Programme, SessionLog } from '@/domain';
import type { ProgrammeRecord } from '@/db';
import { repo } from '@/db/repo';
import {
  nextTime,
  pendingProposals,
  prepareSession,
  sessionForWeek,
  weekRole,
  type NextTime,
  type PreparedSession,
  type ProgressContext,
  type Proposal,
} from '@/engine';
import { useAnswers, useEquipment, useProfile, useProgrammes, useSessionLogs } from './data';

/** How often the clock progression reads moves on while the app stays open. */
const CLOCK_MS = 5 * 60_000;

/**
 * The time progression reads (breaks, pending proposals): refreshed every few minutes and when
 * the app comes back to the foreground, so a long-open app doesn't miss a break.
 */
function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, CLOCK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

const Shared = createContext<ProgressContext | undefined | null>(null);

/** Reads the database once for every screen below it. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const ctx = useOwnProgressContext();
  return createElement(Shared.Provider, { value: ctx }, children);
}

/** What progression reads, from the live database. `undefined` while anything is loading. */
export function useProgressContext(): ProgressContext | undefined {
  const shared = useContext(Shared);
  const own = useOwnProgressContext(shared !== null);
  return shared === null ? own : shared;
}

function useOwnProgressContext(skip = false): ProgressContext | undefined {
  const logs = useSessionLogs();
  const programmes = useProgrammes();
  const answers = useAnswers();
  const inventory = useEquipment();
  const profile = useProfile();
  const now = useClock();
  return useMemo(() => {
    if (skip) return undefined;
    if (!logs || !programmes || !answers || !inventory || profile === undefined) return undefined;
    return {
      logs,
      programmes,
      answers,
      inventory,
      ...(profile && { profile }),
      now: new Date(now),
      exercises: exerciseById,
    };
  }, [skip, logs, programmes, answers, inventory, profile, now]);
}

/** Reads the same context once, outside React (starting a session). */
export async function loadProgressContext(now = new Date()): Promise<ProgressContext> {
  const [logs, programmes, answers, inventory, profile] = await Promise.all([
    repo.listSessionLogs(),
    repo.listProgrammes(),
    repo.listAnswers(),
    repo.getEquipment(),
    repo.getProfile(),
  ]);
  return {
    logs,
    programmes,
    answers,
    inventory,
    ...(profile && { profile }),
    now,
    exercises: exerciseById,
  };
}

/**
 * A programme session as it will run in `week`: the week's changes, swaps, then each exercise's
 * load, goal and tempo from its history. `undefined` while loading.
 */
export function usePreparedSession(
  programme: Programme | null | undefined,
  sessionId: string | undefined,
  week: number | undefined,
): (PreparedSession & { week: number }) | undefined {
  const ctx = useProgressContext();
  return useMemo(() => {
    if (!ctx || !programme || !sessionId || week === undefined) return undefined;
    if (!programme.rotation.some((s) => s.id === sessionId)) return undefined;
    const plan = sessionForWeek(programme, sessionId, week);
    return {
      ...prepareSession(plan.session, ctx, 'programme', { role: weekRole(programme, week) }),
      week,
    };
  }, [ctx, programme, sessionId, week]);
}

/** What changes next time, for a finished session's summary. */
export function useNextTime(log: SessionLog | null | undefined): NextTime | undefined {
  const ctx = useProgressContext();
  const programmes = ctx?.programmes;
  return useMemo(() => {
    if (!ctx || !log || !programmes) return undefined;
    const programme =
      log.source.kind === 'programme'
        ? programmes.find((p) => p.id === (log.source as { programmeId: string }).programmeId)
        : undefined;
    return nextTime(log, programme, ctx);
  }, [ctx, log, programmes]);
}

/** Everything waiting for an answer across the active programme, and exercises at their limit. */
export function usePendingProposals(
  programme: ProgrammeRecord | null | undefined,
  week: number | undefined,
): { proposals: Proposal[]; buyNext: string[] } | undefined {
  const ctx = useProgressContext();
  return useMemo(() => {
    if (!ctx || !programme || week === undefined) return undefined;
    return pendingProposals(programme, week, ctx);
  }, [ctx, programme, week]);
}

/** Records the user's answer to a proposal; returns it so the card can offer Undo. */
export function answerProposal(proposal: Proposal, answer: Answer['answer']): Promise<Answer> {
  return repo.saveAnswer({
    exerciseId: proposal.exerciseId,
    kind: proposal.kind,
    logId: proposal.logId,
    answer,
    ...(answer === 'swap' && proposal.substituteId && { substituteId: proposal.substituteId }),
  });
}

/** Goes back to the original exercise of a swap. */
export async function switchBack(originalId: string): Promise<Answer> {
  const swap = (await repo.listAnswers())
    .filter((a) => a.exerciseId === originalId && a.answer === 'swap')
    .at(-1);
  return repo.saveAnswer({ exerciseId: originalId, kind: swap?.kind ?? 'harder', answer: 'back' });
}

export const undoAnswer = (answer: Answer): Promise<void> => repo.deleteAnswer(answer.id);
