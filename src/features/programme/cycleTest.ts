import { exerciseById } from '@/catalogue';
import type { MaxTest, SessionLog } from '@/domain';
import { groupsOf, scheduledTest, type MuscleGroup, type TestContext } from '@/engine';
import type { Programme } from '@/domain';

/** What a programme session does about the week's max test, as the detail and the card show it. */
export type SessionTestView =
  | {
      kind: 'run';
      exerciseId: string;
      testKind: 'reps' | 'time';
      placement: 'end' | 'after-warmup';
      /** The tested movement's first muscle group, for "this session doesn't work your …". */
      muscles?: MuscleGroup;
      /** The latest end-of-cycle test of the same exercise, to beat. */
      last?: MaxTest;
    }
  | { kind: 'done'; exerciseId: string; date: string; test?: MaxTest }
  | { kind: 'skipped'; exerciseId: string; date: string }
  | {
      kind: 'pain';
      exerciseId: string;
      /** The move that hurt, which may be a close relative of the tested one. */
      hurtId?: string;
      hurtDate?: string;
      /** Pain-free sessions of that movement since. */
      freeSince: number;
    };

/** The latest end-of-cycle (in a session) result of an exercise, not counting pain stops. */
export function lastSessionTest(
  tests: readonly MaxTest[],
  exerciseId: string,
  before?: string,
): MaxTest | undefined {
  return tests
    .filter(
      (t) =>
        t.exerciseId === exerciseId &&
        t.context === 'session' &&
        !t.stopped &&
        (before === undefined || t.at < before),
    )
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

/** Close relatives of the tested move: same pattern and a shared primary muscle. */
function relatives(exerciseId: string, ctx: TestContext): Set<string> {
  const catalogue = ctx.exercises ?? exerciseById;
  const tested = catalogue.get(exerciseId);
  const out = new Set([exerciseId]);
  if (!tested) return out;
  for (const log of ctx.logs)
    for (const set of log.sets) {
      const e = catalogue.get(set.exerciseId);
      if (
        e &&
        e.pattern === tested.pattern &&
        e.primaryMuscles.some((m) => tested.primaryMuscles.includes(m))
      )
        out.add(e.id);
    }
  return out;
}

/** Which move hurt last, when, and how many pain-free sessions of it have gone well since. */
export function painDetails(
  exerciseId: string,
  ctx: TestContext,
): { hurtId?: string; hurtDate?: string; freeSince: number } {
  const kin = relatives(exerciseId, ctx);
  const events = [
    ...ctx.logs
      .filter((log) => log.status === 'completed')
      .flatMap((log) =>
        [...kin].flatMap((id) => {
          const sets = log.sets.filter((s) => s.exerciseId === id);
          if (sets.length === 0) return [];
          const pain = sets.some((s) => s.flag === 'pain');
          return [
            {
              at: log.endedAt ?? log.startedAt,
              pain,
              ok: !pain && sets.some((s) => s.actual !== undefined),
              id: log.id,
              exerciseId: id,
            },
          ];
        }),
      ),
    ...ctx.maxTests
      .filter((t) => t.stopped === 'pain' && kin.has(t.exerciseId))
      .map((t) => ({ at: t.at, pain: true, ok: false, id: t.id, exerciseId: t.exerciseId })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const pain = events.findIndex((e) => e.pain);
  if (pain < 0) return { freeSince: 0 };
  const since = new Set(
    events
      .slice(0, pain)
      .filter((e) => e.ok)
      .map((e) => e.id),
  );
  const hurt = events[pain]!;
  return { hurtId: hurt.exerciseId, hurtDate: hurt.at, freeSince: since.size };
}

/**
 * The test this programme session carries in `week`, if any: still to run, done, skipped or held
 * back by pain. Only the session the test is placed on has one.
 */
export function sessionTest(
  programme: Programme,
  sessionId: string,
  week: number,
  ctx: TestContext,
): SessionTestView | undefined {
  const ran = ctx.logs.find(
    (log: SessionLog) =>
      log.status === 'completed' &&
      log.source.kind === 'programme' &&
      log.source.programmeId === programme.id &&
      log.source.week === week &&
      log.source.sessionId === sessionId &&
      (log.test?.outcome === 'done' || log.test?.outcome === 'skipped'),
  );
  if (ran?.test) {
    const date = (ran.endedAt ?? ran.startedAt).slice(0, 10);
    if (ran.test.outcome === 'skipped')
      return { kind: 'skipped', exerciseId: ran.test.exerciseId, date };
    const test = ctx.maxTests.find((t) => t.logId === ran.id && !t.stopped);
    return { kind: 'done', exerciseId: ran.test.exerciseId, date, ...(test && { test }) };
  }
  const scheduled = scheduledTest(programme, sessionId, week, ctx);
  if (!scheduled) return undefined;
  if (scheduled.kind === 'pain')
    return {
      kind: 'pain',
      exerciseId: scheduled.exerciseId,
      ...painDetails(scheduled.exerciseId, ctx),
    };
  const { exerciseId, kind, placement } = scheduled.test;
  const exercise = (ctx.exercises ?? exerciseById).get(exerciseId);
  const muscles = exercise ? groupsOf(exercise)[0] : undefined;
  const last = lastSessionTest(ctx.maxTests, exerciseId);
  return {
    kind: 'run',
    exerciseId,
    testKind: kind,
    placement,
    ...(muscles && { muscles }),
    ...(last && { last }),
  };
}
