import { requestPersistence } from '@/app/backup';
import { nextSession } from '@/app/programme-state';
import type { ProgrammeRecord } from '@/db';
import { repo } from '@/db/repo';
import type { EquipmentInventory, Session, SessionLog } from '@/domain';
import {
  countsAsDoneByDefault,
  playSteps,
  resumeIndex,
  sessionForWeek,
  sessionTotals,
  setAdjustments,
} from '@/engine';
import { idleSince } from './usePlayer';

/**
 * Opens the next session of the rotation with the week's changes resolved against the
 * equipment owned now. Throws `OpenSessionError` when a session is already open.
 */
export async function startProgrammeSession(
  programme: ProgrammeRecord,
  inventory: EquipmentInventory,
): Promise<SessionLog> {
  const position = nextSession(programme, await repo.listSessionLogs());
  const plan = sessionForWeek(programme, position.sessionId, position.week);
  const adjustments = setAdjustments(plan, inventory);
  return repo.startSession({
    source: {
      kind: 'programme',
      programmeId: programme.id,
      week: position.week,
      sessionId: position.sessionId,
    },
    plan: plan.session,
    ...(adjustments && { adjustments }),
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
