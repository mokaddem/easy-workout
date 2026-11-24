import { exerciseById as catalogueById } from '../catalogue';
import type {
  Answer,
  CheckIn,
  Exercise,
  Level,
  Load,
  MaxTest,
  Programme,
  SessionLog,
} from '../domain';
import { DEFAULT_BODYWEIGHT_KG } from './generate/loads';
import { isMainLift } from './generate/safety';
import { activeSeconds } from './play';
import { AT_MAX, exposuresOf, type Exposure } from './progress/exposures';
import { bodyShare, capacity } from './progress/ladder';
import { painState } from './progress/proposals';
import { previousTest, testBlockedByPain } from './maxtest';
import { bodyTrend, bodyweightOffer, type BodyTrend } from './stats/body';
import { sessionForWeek } from './week';

/** Lifts shown on a review: the ones that carry the sessions. */
export const REVIEW_LIFTS = 6;
/** A rep gain this large at the same load, reserve counted, is progress (smaller is noise). */
export const PROGRESS_REPS = 3;
/** Past this many reps the reps-to-strength estimate means little: no percentage. */
const PERCENT_MAX_REPS = 12;
/** Level-up thresholds: sessions done in full, weeks taken, lifts progressed. */
export const LEVEL_UP_DONE = 0.75;
export const LEVEL_UP_MAX_WEEKS = 10;
/** A programme with a lighter week inserted runs a week longer: the allowance grows with it. */
const isEarlyPhase = (phase: Programme['phases'][number]) => phase.origin === 'early';
export const LEVEL_UP_LIFTS = 2 / 3;

/** What a lift's best set said: reps (or seconds) at a load, with the reserve left. */
export interface LiftReading {
  at: string;
  exerciseId: string;
  load?: Load;
  value: number;
  unit: 'reps' | 'seconds';
  /** Reps left in the tank, the feel counted (easy +2, hard −1). */
  rir?: number;
}

export type LiftStatus = 'progressed' | 'held' | 'equipment-max';

export interface LiftChange {
  /** The slot it holds in its session. */
  sessionId: string;
  slot?: string;
  start?: LiftReading;
  end?: LiftReading;
  status: LiftStatus;
  /** Strength change in %, for weighted lifts up to 12 reps at both ends on the same exercise. */
  percent?: number;
  /** A harder variant took over during the cycle. */
  variantChanged: boolean;
  /** The last sessions were logged by hand (values or a feel), not only tapped through. */
  logged: boolean;
}

export interface CycleSessions {
  planned: number;
  /** Completed and counted, as the rotation moves. */
  counted: number;
  /** Counted and not ended early. */
  inFull: number;
  endedEarly: number;
  abandoned: number;
  /** Calendar weeks from the first session to the last. */
  weeksTaken: number;
  activeSec: number;
  mainSets: number;
  first?: string;
  last?: string;
}

export interface CycleReview {
  programmeId: string;
  sessions: CycleSessions;
  cardio: { plannedMin: number; doneMin: number };
  lifts: LiftChange[];
  counts: { progressed: number; held: number; atMax: number };
  /** Exercises with nothing heavier owned and nothing harder offered: buying would help. */
  buyNext: string[];
  test?: { current: MaxTest; previous?: MaxTest };
  body: { weight: BodyTrend; waist: BodyTrend; sleep: BodyTrend };
  /** Exercises that stopped for pain in this cycle, with how many times. */
  pain: { exerciseId: string; count: number }[];
  /** Beginner or returning, and the cycle shows it's time: intermediate is offered. */
  levelUp: boolean;
  /** The latest check-ins put the bodyweight this far from the profile's. */
  bodyweight?: { kg: number; differenceKg: number };
}

export interface CycleContext {
  logs: readonly SessionLog[];
  programmes: readonly Programme[];
  answers: readonly Answer[];
  maxTests: readonly MaxTest[];
  checkIns: readonly CheckIn[];
  level: Level;
  bodyweightKg?: number;
  /** Until when the cycle counts (its end, or now while it's still open). */
  until: string;
  exercises?: ReadonlyMap<string, Exercise>;
}

const DAY_MS = 86_400_000;

const itemsOf = (block: Programme['rotation'][number]['main'][number]) =>
  block.type === 'straight' ? [block.item] : block.items;

/** The programme's own sessions that are over. */
const cycleLogs = (programme: Programme, logs: readonly SessionLog[]) =>
  logs
    .filter(
      (l) =>
        l.status !== 'in-progress' &&
        l.source.kind === 'programme' &&
        l.source.programmeId === programme.id,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

function sessionsOf(programme: Programme, logs: readonly SessionLog[]): CycleSessions {
  const own = cycleLogs(programme, logs);
  const completed = own.filter((l) => l.status === 'completed');
  const counted = completed.filter((l) => l.countsAsDone !== false);
  const first = own[0]?.startedAt;
  const lastLog = own[own.length - 1];
  const last = lastLog ? (lastLog.endedAt ?? lastLog.startedAt) : undefined;
  const span = first && last ? Date.parse(last) - Date.parse(first) : 0;
  return {
    planned: programme.sessionsPerWeek * programme.weeks,
    counted: counted.length,
    inFull: counted.filter((l) => !l.endedEarly).length,
    endedEarly: completed.filter((l) => l.endedEarly).length,
    abandoned: own.filter((l) => l.status === 'abandoned').length,
    weeksTaken: own.length === 0 ? 0 : Math.max(1, Math.ceil((span + DAY_MS) / (7 * DAY_MS))),
    activeSec: completed.reduce((sum, l) => sum + activeSeconds(l), 0),
    // A per-side set is logged once per side but is one set.
    mainSets: completed.reduce(
      (sum, l) =>
        sum +
        new Set(
          l.sets
            .filter((s) => s.section === 'main' && s.actual && !s.flag)
            .map((s) => `${s.blockIndex}/${s.itemIndex}/${s.set}`),
        ).size,
      0,
    ),
    ...(first && { first }),
    ...(last && { last }),
  };
}

/** Cardio minutes the cycle planned (every week, phases applied) and the minutes logged. */
function cardioOf(programme: Programme, logs: readonly SessionLog[]) {
  let planned = 0;
  const size = programme.rotation.length;
  for (let week = 1; week <= programme.weeks; week++)
    for (let k = 0; k < programme.sessionsPerWeek; k++) {
      const session = programme.rotation[((week - 1) * programme.sessionsPerWeek + k) % size]!;
      const plan = sessionForWeek(programme, session.id, week).session;
      for (const block of [...plan.main, ...plan.finisher])
        for (const item of itemsOf(block)) {
          const sets = block.type === 'straight' ? block.sets : block.rounds;
          if (item.target.kind === 'cardio') planned += item.target.minMinutes * sets;
          if (item.target.kind === 'interval')
            planned +=
              (item.target.rounds * (item.target.workSec + item.target.recoverySec) * sets) / 60;
        }
    }
  let done = 0;
  for (const log of cycleLogs(programme, logs))
    for (const set of log.sets)
      if (
        (set.planned.target.kind === 'cardio' || set.planned.target.kind === 'interval') &&
        set.actual?.durationSec
      )
        done += set.actual.durationSec / 60;
  return { plannedMin: Math.round(planned), doneMin: Math.round(done) };
}

/** The lifts that carry the sessions: the first two compound straight blocks of each, A1 B1 … A2 B2. */
function leadLifts(programme: Programme, exercises: ReadonlyMap<string, Exercise>) {
  const perSession = programme.rotation.map((session) =>
    session.main
      .filter((b) => b.type === 'straight')
      .map((b) => b.item)
      .filter((item) => {
        const e = exercises.get(item.exerciseId);
        return e !== undefined && isMainLift(e) && item.target.kind === 'reps';
      })
      .slice(0, 2)
      .map((item) => ({ sessionId: session.id, item })),
  );
  const out: { sessionId: string; item: (typeof perSession)[number][number]['item'] }[] = [];
  const seen = new Set<string>();
  for (let rank = 0; rank < 2; rank++)
    for (const lifts of perSession) {
      const lift = lifts[rank];
      if (!lift || seen.has(lift.item.exerciseId)) continue;
      seen.add(lift.item.exerciseId);
      out.push(lift);
    }
  return out.slice(0, REVIEW_LIFTS);
}

const readingOf = (e: Exposure): LiftReading | undefined => {
  const first = e.evidence[0];
  if (!first) return undefined;
  const rir = first.rir ?? e.item.rir;
  return {
    at: e.at,
    exerciseId: e.exerciseId,
    ...((first.load ?? e.item.load) && { load: first.load ?? e.item.load }),
    value: first.value,
    unit: e.item.target.kind === 'time' ? 'seconds' : 'reps',
    ...(rir !== undefined && { rir: rir + first.feel }),
  };
};

const kgOf = (r: LiftReading, exercise: Exercise, bodyweightKg: number): number | undefined => {
  const load = r.load;
  const added = load?.kind === 'added-kg';
  const share = bodyShare(exercise, added);
  if (load && 'kg' in load) return load.kg + share * bodyweightKg;
  return share > 0 ? share * bodyweightKg : undefined;
};

const strength = (r: LiftReading, exercise: Exercise, bodyweightKg: number) => {
  const kg = kgOf(r, exercise, bodyweightKg);
  return kg === undefined ? undefined : capacity(kg, r.value, r.rir ?? 2);
};

/** Reps at reserve 2, so readings at different efforts compare. */
const repsAtTwo = (r: LiftReading) => r.value + (r.rir ?? 2) - 2;

/**
 * One lift across the cycle. Start: the first logged (touched) training session after the
 * first-week calibration; end: the better of the last two training sessions. Deloads never
 * count, and a week-1 estimate never stands for where the user started.
 */
function liftChange(
  sessionId: string,
  slot: string | undefined,
  exerciseIds: readonly string[],
  programme: Programme,
  ctx: CycleContext,
  exercises: ReadonlyMap<string, Exercise>,
): LiftChange {
  const within = (e: Exposure) =>
    e.at <= ctx.until &&
    ctx.logs.some(
      (l) =>
        l.id === e.logId &&
        l.source.kind === 'programme' &&
        l.source.programmeId === programme.id &&
        l.source.sessionId === sessionId,
    );
  // An exercise's very first training session runs on an estimate: never where the user started.
  const calibration = new Set(
    exerciseIds.map(
      (id) =>
        exposuresOf(id, ctx.logs, ctx.programmes)
          .filter((e) => e.role === 'build' && e.evidence.length > 0)
          .at(-1)?.logId,
    ),
  );
  const exposures = exerciseIds
    .flatMap((id) => exposuresOf(id, ctx.logs, ctx.programmes))
    .filter(
      (e) => within(e) && e.role !== 'deload' && e.evidence.length > 0 && !calibration.has(e.logId),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const bodyweightKg = ctx.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
  const startExposure = exposures.find((e) => e.touched) ?? exposures[0];
  const lastTwo = exposures.slice(-2);
  const score = (e: Exposure) => {
    const r = readingOf(e)!;
    const ex = exercises.get(e.exerciseId)!;
    return strength(r, ex, bodyweightKg) ?? repsAtTwo(r);
  };
  const endExposure = lastTwo.reduce<Exposure | undefined>(
    (best, e) => (!best || score(e) >= score(best) ? e : best),
    undefined,
  );
  const start = startExposure && readingOf(startExposure);
  const end = endExposure && readingOf(endExposure);
  const variantChanged = !!start && !!end && start.exerciseId !== end.exerciseId;

  let status: LiftStatus = 'held';
  let percent: number | undefined;
  if (start && end && endExposure !== startExposure) {
    const ex = exercises.get(end.exerciseId)!;
    // Kilograms in hand or on the belt; bodyweight alone is 0, bands don't compare this way.
    const kgIn = (l: Load | undefined) => (l && 'kg' in l ? l.kg : 0);
    const banded = start.load?.kind === 'band' || end.load?.kind === 'band';
    const heavier = !banded && kgIn(end.load) > kgIn(start.load) + 1e-6;
    if (variantChanged || heavier || repsAtTwo(end) - repsAtTwo(start) >= PROGRESS_REPS)
      status = 'progressed';
    const weighted = !!end.load && 'kg' in end.load && !!start.load && 'kg' in start.load;
    if (
      !variantChanged &&
      weighted &&
      start.value <= PERCENT_MAX_REPS &&
      end.value <= PERCENT_MAX_REPS
    ) {
      const a = strength(start, ex, bodyweightKg);
      const b = strength(end, ex, bodyweightKg);
      if (a && b) percent = Math.round((b / a - 1) * 100);
    }
  }
  const latest = exposures[exposures.length - 1];
  if (status !== 'progressed' && latest?.note && AT_MAX.has(latest.note.code))
    status = 'equipment-max';
  return {
    sessionId,
    ...(slot !== undefined && { slot }),
    ...(start && { start }),
    ...(end && { end }),
    status,
    ...(percent !== undefined && { percent }),
    variantChanged,
    logged: lastTwo.some((e) => e.touched),
  };
}

/**
 * Every exercise that ran in a lift's place during the cycle: the one planned, what a swap, an
 * upgrade or an edit put there instead (read from the sessions as they ran).
 */
function exercisesAt(
  programme: Programme,
  sessionId: string,
  slot: string | undefined,
  planned: string,
  logs: readonly SessionLog[],
): string[] {
  const out = new Set([planned]);
  if (slot === undefined) return [...out];
  for (const log of logs) {
    if (
      log.source.kind !== 'programme' ||
      log.source.programmeId !== programme.id ||
      log.source.sessionId !== sessionId
    )
      continue;
    for (const block of log.plan.main)
      for (const item of itemsOf(block)) if (item.slot === slot) out.add(item.exerciseId);
  }
  return [...out];
}

/**
 * What a finished (or finishing) cycle comes to: sessions, cardio, main lifts start → end, the
 * max test, body trends, pain stops, and whether moving up a level or updating the bodyweight
 * is worth offering.
 */
export function cycleReview(programme: Programme, ctx: CycleContext): CycleReview {
  const exercises = ctx.exercises ?? catalogueById;
  const logs = ctx.logs.filter((l) => l.startedAt <= ctx.until);
  const sessions = sessionsOf(programme, logs);
  const scoped = { ...ctx, logs };

  const lifts = leadLifts(programme, exercises).map(({ sessionId, item }) =>
    liftChange(
      sessionId,
      item.slot,
      exercisesAt(programme, sessionId, item.slot, item.exerciseId, logs),
      programme,
      scoped,
      exercises,
    ),
  );
  const counts = {
    progressed: lifts.filter((l) => l.status === 'progressed').length,
    held: lifts.filter((l) => l.status === 'held').length,
    atMax: lifts.filter((l) => l.status === 'equipment-max').length,
  };

  const own = cycleLogs(programme, logs);
  const buyNext = [
    ...new Set(
      own.flatMap((l) =>
        Object.entries(l.progression ?? {})
          .filter(([, n]) => n.code === 'buy-next')
          .map(([key]) => {
            const [section, block, item] = key.split('/');
            const b = l.plan[section as 'main' | 'finisher']?.[Number(block)];
            return b ? itemsOf(b)[Number(item)]?.exerciseId : undefined;
          })
          .filter((id): id is string => id !== undefined),
      ),
    ),
  ];

  const painCounts = new Map<string, number>();
  for (const log of own) {
    const hurt = new Set(log.sets.filter((s) => s.flag === 'pain').map((s) => s.exerciseId));
    for (const id of hurt) painCounts.set(id, (painCounts.get(id) ?? 0) + 1);
  }
  // A test stopped because it hurt is a pain stop of the cycle too.
  const first = sessions.first ?? ctx.until;
  const stoppedTests = ctx.maxTests.filter(
    (t) => t.stopped === 'pain' && t.at >= first && t.at <= ctx.until,
  );
  for (const t of stoppedTests)
    painCounts.set(t.exerciseId, (painCounts.get(t.exerciseId) ?? 0) + 1);
  const pain = [...painCounts].map(([exerciseId, count]) => ({ exerciseId, count }));

  const current = ctx.maxTests
    .filter((t) => t.programmeId === programme.id && t.context === 'session' && !t.stopped)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const previous = current && previousTest(current, ctx.maxTests);

  const started = sessions.first?.slice(0, 10) ?? '';
  const window = ctx.checkIns.filter((c) => c.date >= started && c.date <= ctx.until.slice(0, 10));
  const body = {
    weight: bodyTrend(window, 'weightKg'),
    waist: bodyTrend(window, 'waistCm'),
    sleep: bodyTrend(window, 'sleepHours'),
  };

  // Pain still being worked through on any exercise: never the time to ask for more.
  const unresolvedPain =
    [...painCounts.keys()].some(
      (id) =>
        painState(exposuresOf(id, ctx.logs, ctx.programmes, { anySource: true }), ctx.answers) !==
        undefined,
    ) ||
    stoppedTests.some((t) =>
      testBlockedByPain(t.exerciseId, {
        logs: ctx.logs,
        programmes: ctx.programmes,
        answers: ctx.answers,
        maxTests: ctx.maxTests,
        inventory: [],
      }),
    );
  // Tapping through proves attendance, not capacity: some lifts logged by hand late in the
  // cycle, or a better test, back the offer.
  const testGain =
    !!current &&
    !!previous &&
    (current.result.kind === 'reps' && previous.result.kind === 'reps'
      ? current.result.reps > previous.result.reps
      : current.result.kind === 'time' &&
        previous.result.kind === 'time' &&
        current.result.seconds > previous.result.seconds);
  const evidence = testGain || lifts.filter((l) => l.logged).length * 2 >= lifts.length;
  const levelUp =
    evidence &&
    (ctx.level === 'beginner' || ctx.level === 'returning') &&
    sessions.planned > 0 &&
    sessions.inFull >= LEVEL_UP_DONE * sessions.planned &&
    sessions.weeksTaken <= LEVEL_UP_MAX_WEEKS + (programme.phases.some(isEarlyPhase) ? 1 : 0) &&
    lifts.length > 0 &&
    counts.progressed >= LEVEL_UP_LIFTS * lifts.length &&
    !unresolvedPain;

  const offer = bodyweightOffer(ctx.checkIns, ctx.bodyweightKg);
  return {
    programmeId: programme.id,
    sessions,
    cardio: cardioOf(programme, logs),
    lifts,
    counts,
    buyNext,
    ...(current && { test: { current, ...(previous && { previous }) } }),
    body,
    pain,
    levelUp,
    ...(offer && { bodyweight: offer }),
  };
}
