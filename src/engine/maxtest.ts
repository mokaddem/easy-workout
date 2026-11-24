import { exerciseById as catalogueById } from '../catalogue';
import type {
  Answer,
  EquipmentInventory,
  Exercise,
  Level,
  MaxTest,
  Programme,
  Session,
  SessionLog,
  SessionTest,
} from '../domain';
import { isConstrained, type Constraints } from './generate/constraints';
import { exposuresOf } from './progress/exposures';
import { activeSwaps, applySwaps } from './progress/swaps';
import { isTestable, testKind } from './testable';
import { isStrengthWork } from './volume';
import { phaseForWeek } from './week';

export { HOLD_TEST_CAP_SEC, isTestable, REP_TEST_CAP, TEST_REST_SEC, testKind } from './testable';

/** What scheduling a test reads. */
export interface TestContext {
  logs: readonly SessionLog[];
  programmes: readonly Programme[];
  answers: readonly Answer[];
  maxTests: readonly MaxTest[];
  inventory: EquipmentInventory;
  level?: Level;
  bodyweightKg?: number;
  /** What the user avoids: a test goes to the limit, so nothing ruled out or spared qualifies. */
  constraints?: Constraints;
  exercises?: ReadonlyMap<string, Exercise>;
  /** The session runs away from home: never a test. */
  travel?: boolean;
  /** The session runs at the re-entry volume after a long break: the scheduled test is skipped. */
  reentry?: boolean;
}

const lookup = (ctx: Pick<TestContext, 'exercises'>) => ctx.exercises ?? catalogueById;

const itemsOf = (session: Session) =>
  [...session.main, ...session.finisher].flatMap((b) =>
    b.type === 'straight' ? [b.item] : b.items,
  );

/** The week's sessions in the order they run, with the user's swaps in place. */
function weekSessions(programme: Programme, week: number, ctx: TestContext): Session[] {
  const size = programme.rotation.length;
  const swaps = activeSwaps(ctx.answers);
  const swapCtx = {
    inventory: ctx.inventory,
    level: ctx.level ?? 'intermediate',
    ...(ctx.bodyweightKg !== undefined && { bodyweightKg: ctx.bodyweightKg }),
    ...(isConstrained(ctx.constraints) && { constraints: ctx.constraints }),
  };
  const out: Session[] = [];
  for (let k = 0; k < programme.sessionsPerWeek; k++) {
    const session = programme.rotation[((week - 1) * programme.sessionsPerWeek + k) % size]!;
    if (!out.some((s) => s.id === session.id))
      out.push(applySwaps(session, swaps, swapCtx, lookup(ctx)).session);
  }
  return out;
}

/** The week's planned test, as the programme was generated. */
export const plannedTest = (programme: Programme, week: number): string | undefined => {
  for (const adjustment of phaseForWeek(programme, week)?.adjustments ?? [])
    if (adjustment.kind === 'max-test') return adjustment.exerciseIds[0];
  return undefined;
};

/** The weeks of a programme that close with a max test. */
export const testWeeks = (programme: Programme): number[] => {
  const weeks: number[] = [];
  for (let w = 1; w <= programme.weeks; w++) if (plannedTest(programme, w)) weeks.push(w);
  return weeks;
};

/**
 * Another exercise that suits a test when the usual one is ruled out by what the user avoids:
 * the easiest that is testable for them, or none.
 */
function otherTest(ctx: TestContext): string | undefined {
  return [...lookup(ctx).values()]
    .filter((e) => isTestable(e, ctx.level, ctx.constraints))
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))[0]?.id;
}

/** The generator's rule: a bodyweight push-up variant in the programme, else push-ups. */
function pushUpTest(sessions: readonly Session[], ctx: TestContext): string | undefined {
  const exercises = lookup(ctx);
  const pushUps = sessions
    .flatMap((s) => s.main.flatMap((b) => (b.type === 'straight' ? [b.item] : b.items)))
    .map((i) => exercises.get(i.exerciseId))
    .filter(
      (e): e is Exercise =>
        e !== undefined &&
        e.pattern === 'push-horizontal' &&
        isTestable(e, ctx.level, ctx.constraints),
    );
  const usual = ctx.level === 'beginner' ? 'knee-push-up' : 'push-up';
  const found = pushUps.find((e) => e.id === 'push-up')?.id ?? pushUps[0]?.id ?? usual;
  if (!isConstrained(ctx.constraints)) return found;
  const e = exercises.get(found);
  return e && isTestable(e, ctx.level, ctx.constraints) ? found : otherTest(ctx);
}

/**
 * The exercise the week's test uses, following the programme as it runs: the planned one while
 * it is still done; what replaced it (a swap or an edit of its slot) when that can be tested;
 * none when it was swapped away for pain; else the generator's push-up rule.
 */
export function testExerciseFor(
  programme: Programme,
  week: number,
  ctx: TestContext,
): string | undefined {
  const planned = plannedTest(programme, week);
  if (!planned) return undefined;
  const exercises = lookup(ctx);
  const sessions = programme.rotation;
  const running = new Set(sessions.flatMap(itemsOf).map((i) => i.exerciseId));
  const swaps = activeSwaps(ctx.answers);
  const testable = (id: string | undefined) => {
    const e = id ? exercises.get(id) : undefined;
    return e && isTestable(e, ctx.level, ctx.constraints) ? e.id : undefined;
  };

  if (swaps.painful.has(planned)) return undefined;
  const swappedTo = swaps.to.get(planned);
  if (running.has(planned) && !swappedTo) return testable(planned) ?? pushUpTest(sessions, ctx);
  if (swappedTo) return testable(swappedTo) ?? pushUpTest(sessions, ctx);

  // Replaced by an edit: whatever now holds the slot it had.
  const generated = programme.generatedRotation ?? [];
  for (const [i, session] of generated.entries()) {
    const slot = itemsOf(session).find((item) => item.exerciseId === planned)?.slot;
    if (!slot) continue;
    const now = itemsOf(programme.rotation[i]!).find((item) => item.slot === slot);
    const replacement = testable(now?.exerciseId);
    if (replacement) return replacement;
  }
  return pushUpTest(sessions, ctx);
}

/**
 * Where the test runs in its week: at the end of the last session whose main work leaves the
 * tested muscles alone (a lower, pull or cardio day); when every session works them, right after
 * the warm-up of the week's first session.
 */
export function testPlacement(
  programme: Programme,
  week: number,
  exerciseId: string,
  ctx: TestContext,
): { sessionId: string; placement: SessionTest['placement'] } | undefined {
  const exercises = lookup(ctx);
  const tested = exercises.get(exerciseId);
  const sessions = weekSessions(programme, week, ctx);
  if (!tested || sessions.length === 0) return undefined;
  const works = (session: Session) =>
    itemsOf(session).some((item) => {
      const e = exercises.get(item.exerciseId);
      return (
        e !== undefined &&
        isStrengthWork(e) &&
        e.primaryMuscles.some((m) => tested.primaryMuscles.includes(m))
      );
    });
  const rested = sessions.filter((s) => !works(s));
  // Jumps, swings or a metabolic finisher before a test tire everything: a calm day first.
  const calm = rested.filter(
    (s) =>
      !itemsOf(s).some((item) => {
        const e = exercises.get(item.exerciseId);
        return (
          e !== undefined &&
          (e.pattern === 'conditioning' ||
            e.tags.includes('plyometric') ||
            e.tags.includes('ballistic'))
        );
      }),
  );
  const last = calm[calm.length - 1] ?? rested[rested.length - 1];
  return last
    ? { sessionId: last.id, placement: 'end' }
    : { sessionId: sessions[0]!.id, placement: 'after-warmup' };
}

/** Pain-free sessions a movement needs after a pain stop before it is tested to the limit. */
export const PAIN_FREE_BEFORE_TEST = 2;

/**
 * Sessions of the movement that still need to go well before it is tested to the limit: after a
 * pain stop on the exercise, or on one of the same pattern sharing a primary muscle (a test
 * stopped for pain included), two sessions without pain. 0 when nothing hurt lately.
 */
export function testPainFreeNeeded(exerciseId: string, ctx: TestContext): number {
  const exercises = lookup(ctx);
  const tested = exercises.get(exerciseId);
  if (!tested) return 0;
  const similar = new Set<string>([exerciseId]);
  for (const log of ctx.logs)
    for (const set of log.sets) {
      const e = exercises.get(set.exerciseId);
      if (
        e &&
        e.pattern === tested.pattern &&
        e.primaryMuscles.some((m) => tested.primaryMuscles.includes(m))
      )
        similar.add(e.id);
    }
  // Sessions of the movement and tests stopped for pain, newest first.
  const events = [
    ...[...similar]
      .flatMap((id) => exposuresOf(id, ctx.logs, ctx.programmes, { anySource: true }))
      .map((e) => ({ at: e.at, pain: e.pain, ok: !e.pain && e.evidence.length > 0, id: e.logId })),
    ...ctx.maxTests
      .filter((t) => t.stopped === 'pain' && similar.has(t.exerciseId))
      .map((t) => ({ at: t.at, pain: true, ok: false, id: t.id })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const pain = events.findIndex((e) => e.pain);
  if (pain < 0) return 0;
  const since = new Set(
    events
      .slice(0, pain)
      .filter((e) => e.ok)
      .map((e) => e.id),
  );
  return Math.max(0, PAIN_FREE_BEFORE_TEST - since.size);
}

/** The movement hurt lately: no test until it has gone well twice (see {@link testPainFreeNeeded}). */
export const testBlockedByPain = (exerciseId: string, ctx: TestContext): boolean =>
  testPainFreeNeeded(exerciseId, ctx) > 0;

/** What a programme session does about the week's test when it starts. */
export type ScheduledTest =
  | { kind: 'run'; test: SessionTest }
  /** The movement hurt lately: no test this time. */
  | { kind: 'pain'; exerciseId: string };

/**
 * The test this session runs, if any: it is the test week's chosen session, the test wasn't done
 * yet in this programme, and the movement hasn't hurt lately.
 */
export function scheduledTest(
  programme: Programme,
  sessionId: string,
  week: number,
  ctx: TestContext,
): ScheduledTest | undefined {
  if (ctx.travel || ctx.reentry) return undefined;
  const exerciseId = testExerciseFor(programme, week, ctx);
  if (!exerciseId) return undefined;
  const at = testPlacement(programme, week, exerciseId, ctx);
  if (at?.sessionId !== sessionId) return undefined;
  if (
    ctx.maxTests.some(
      (t) => t.programmeId === programme.id && t.context === 'session' && !t.stopped,
    )
  )
    return undefined;
  if (testBlockedByPain(exerciseId, ctx)) return { kind: 'pain', exerciseId };
  const exercise = lookup(ctx).get(exerciseId)!;
  return {
    kind: 'run',
    test: { exerciseId, kind: testKind(exercise), placement: at.placement },
  };
}

/**
 * The test this session would have run but doesn't, because it is away from home or at the
 * re-entry volume: the interface says so, and the cycle review offers "Test now" instead.
 */
export function skippedTest(
  programme: Programme,
  sessionId: string,
  week: number,
  ctx: TestContext,
): { kind: 'travel' | 'reentry'; exerciseId: string } | undefined {
  if (!ctx.travel && !ctx.reentry) return undefined;
  const planned = scheduledTest(programme, sessionId, week, {
    ...ctx,
    travel: false,
    reentry: false,
  });
  return planned?.kind === 'run'
    ? { kind: ctx.travel ? 'travel' : 'reentry', exerciseId: planned.test.exerciseId }
    : undefined;
}

/**
 * The exercise "Test now" offers first: the programme's test exercise, else the last one tested,
 * else push-ups (on the knees for a beginner).
 */
export function defaultTestExercise(programme: Programme | undefined, ctx: TestContext): string {
  if (programme) {
    for (const week of testWeeks(programme)) {
      const id = testExerciseFor(programme, week, ctx);
      if (id) return id;
    }
  }
  const last = ctx.maxTests
    .filter((t) => !t.stopped)
    .sort((a, b) => b.at.localeCompare(a.at))
    .find((t) => {
      const e = lookup(ctx).get(t.exerciseId);
      return !isConstrained(ctx.constraints) || (e && isTestable(e, ctx.level, ctx.constraints));
    });
  if (last) return last.exerciseId;
  const usual = ctx.level === 'beginner' ? 'knee-push-up' : 'push-up';
  const e = lookup(ctx).get(usual);
  if (!isConstrained(ctx.constraints) || (e && isTestable(e, ctx.level, ctx.constraints)))
    return usual;
  return otherTest(ctx) ?? usual;
}

/** The latest earlier result of the same exercise and context, to compare a new one with. */
export function previousTest(
  test: Pick<MaxTest, 'exerciseId' | 'context' | 'at'>,
  all: readonly MaxTest[],
): MaxTest | undefined {
  return all
    .filter(
      (t) =>
        t.exerciseId === test.exerciseId &&
        t.context === test.context &&
        t.at < test.at &&
        !t.stopped,
    )
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}
