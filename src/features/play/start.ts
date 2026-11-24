import { requestPersistence } from '@/app/backup';
import { loadProgressContext } from '@/app/progress';
import { nextSession } from '@/app/programme-state';
import type { ProgrammeRecord } from '@/db';
import { constraintsRepo } from '@/db/constraints';
import { repo } from '@/db/repo';
import { isCooldownLog } from '@/domain';
import type { EquipmentInventory, Profile, Session, SessionLog } from '@/domain';
import {
  activeTravelKit,
  buildCooldown,
  countsAsDoneByDefault,
  defaultCountsAsDone,
  isPaused,
  isTravelLog,
  scheduledTest,
  playSteps,
  prepareSession,
  resumeIndex,
  sessionForWeek,
  sessionTotals,
  setAdjustments,
  weekRole,
} from '@/engine';
import { attachTest } from './testStore';
import { idleSince } from './usePlayer';

/**
 * Opens the next session of the rotation: the week's changes, swaps and each exercise's
 * progression, resolved against the equipment owned now, or the travel kit while one is in
 * force. A long break shapes it (lighter volume) and starting it resumes a paused programme.
 * The why of each change is kept on the log. Throws `OpenSessionError` when a session is
 * already open.
 */
export async function startProgrammeSession(
  programme: ProgrammeRecord,
  inventory: EquipmentInventory,
): Promise<SessionLog> {
  const ctx = { ...(await loadProgressContext()), inventory };
  const settings = await repo.getSettings('en');
  const kit = activeTravelKit(settings, ctx.now);
  const position = nextSession(programme, ctx.logs);
  const plan = sessionForWeek(programme, position.sessionId, position.week);
  const prepared = prepareSession(plan.session, ctx, 'programme', {
    role: weekRole(programme, position.week),
    place: { programme, week: position.week },
    ...(kit && { travelKit: kit }),
  });
  const adjustments = setAdjustments(
    { ...plan, session: prepared.session },
    kit ?? inventory,
    undefined,
    prepared.doseCapped,
    prepared,
  );
  // The test week's chosen session runs the max test; a movement that hurt lately gets none,
  // nor does a session away from home or at the lighter volume after a long break.
  const test = scheduledTest(programme, position.sessionId, position.week, {
    ...ctx,
    ...(ctx.profile && { level: ctx.profile.level }),
    ...(ctx.profile?.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
    maxTests: ctx.maxTests ?? [],
    travel: kit !== undefined,
    reentry: prepared.reentry !== undefined,
  });
  const log = await repo.startSession({
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
  // Only a programme session takes the programme out of its pause.
  if (isPaused(settings)) await constraintsRepo.resumeProgramme('en', ctx.now);
  return test?.kind === 'run' ? attachTest(log, test.test) : log;
}

/**
 * Opens one of the user's own sessions on its own: prefilled from each exercise's latest loads
 * (its last run of this session included); nothing in it moves them. Exercises the user chose
 * to skip are already left out of `session`.
 */
export async function startCustomSession(
  session: Session,
  inventory: EquipmentInventory,
): Promise<SessionLog> {
  const ctx = { ...(await loadProgressContext()), inventory };
  const prepared = prepareSession(session, ctx, 'quick', { ownSessionId: session.id });
  return repo.startSession({
    source: { kind: 'custom', sessionId: session.id },
    plan: prepared.session,
  });
}

/**
 * Opens the cooldown after a finished session: a short stretching routine for what it worked.
 * Stored as its own kind of log, linked to the session; nothing in it moves loads or the rotation.
 */
export function startCooldown(
  after: Pick<SessionLog, 'id' | 'sets'>,
  profile: Profile | undefined,
  inventory: EquipmentInventory,
): Promise<SessionLog> {
  const plan = buildCooldown({ after, profile, inventory, now: new Date() });
  return repo.startSession({ source: { kind: 'cooldown', afterLogId: after.id }, plan });
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
      ...(!isCooldownLog(log) && {
        countsAsDone: isTravelLog(log)
          ? defaultCountsAsDone(log)
          : countsAsDoneByDefault(sessionTotals(log)),
      }),
    },
    new Date(end),
  );
  void requestPersistence();
}

/** Abandons the open session without the player: kept if anything was logged, never counted. */
export async function abandonOpenSession(log: SessionLog, now = Date.now()): Promise<void> {
  await repo.abandonSession(log.id, new Date(idleSince(log, now) ?? now));
}
