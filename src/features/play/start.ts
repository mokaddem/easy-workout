import { requestPersistence } from '@/app/backup';
import { loadProgressContext } from '@/app/progress';
import { nextSession } from '@/app/programme-state';
import type { ProgrammeRecord } from '@/db';
import { repo } from '@/db/repo';
import type { EquipmentInventory, Session, SessionLog } from '@/domain';
import {
  countsAsDoneByDefault,
  playSteps,
  prepareSession,
  resumeIndex,
  sessionForWeek,
  sessionTotals,
  setAdjustments,
  weekRole,
} from '@/engine';
import { idleSince } from './usePlayer';

/**
 * Opens the next session of the rotation: the week's changes, swaps and each exercise's
 * progression, resolved against the equipment owned now. The why of each change is kept on the
 * log. Throws `OpenSessionError` when a session is already open.
 */
export async function startProgrammeSession(
  programme: ProgrammeRecord,
  inventory: EquipmentInventory,
): Promise<SessionLog> {
  const ctx = { ...(await loadProgressContext()), inventory };
  const position = nextSession(programme, ctx.logs);
  const plan = sessionForWeek(programme, position.sessionId, position.week);
  const prepared = prepareSession(plan.session, ctx, 'programme', {
    role: weekRole(programme, position.week),
  });
  const adjustments = setAdjustments({ ...plan, session: prepared.session }, inventory);
  return repo.startSession({
    source: {
      kind: 'programme',
      programmeId: programme.id,
      week: position.week,
      sessionId: position.sessionId,
    },
    plan: prepared.session,
    ...(adjustments && { adjustments }),
    progression: prepared.notes,
  });
}

/** Stores a quick session as it starts: it was not kept before. */
export function startQuickSession(session: Session): Promise<SessionLog> {
  return repo.startSession({ source: { kind: 'quick' }, plan: session });
}

/**
 * Finishes the open session without the player, e.g. from the resume banner. A session left
 * idle ends at the last thing done, so the hours it sat open don't count.
 */
export async function finishOpenSession(log: SessionLog, now = Date.now()): Promise<void> {
  const end = idleSince(log, now) ?? now;
  const steps = playSteps(log.plan, log.adjustments);
  await repo.finishSession(
    log.id,
    {
      endedEarly: resumeIndex(steps, log.sets) < steps.length,
      countsAsDone: countsAsDoneByDefault(sessionTotals(log)),
    },
    new Date(end),
  );
  void requestPersistence();
}

/** Abandons the open session without the player: kept if anything was logged, never counted. */
export async function abandonOpenSession(log: SessionLog, now = Date.now()): Promise<void> {
  await repo.abandonSession(log.id, new Date(idleSince(log, now) ?? now));
}
