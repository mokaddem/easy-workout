import {
  isCooldownLog,
  type Answer,
  type Exercise,
  type Phase,
  type PhaseAdjustment,
  type Programme,
  type SessionLog,
} from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { isMainLift } from '../generate/safety';
import { itemKey } from '../play';
import { nextSession } from '../position';
import { phaseForWeek } from '../week';
import { AT_MAX, exposuresOf, longestGapDays, weekRole, type Exposure } from './exposures';
import { levelOf } from '../stats/history';
import { sameLoad } from './ladder';
import { painState } from './proposals';

const DAY_MS = 86_400_000;

/** What the offer waits for and how it behaves. */
export const LIGHTER_WEEK = {
  /** Sessions looked at for the hard share, at most. */
  lookBackSessions: 4,
  /** Sessions in the hard-share window, and counted sets each needs. */
  windowSessions: 2,
  minSetsPerSession: 3,
  minSets: 6,
  /** Share of misses over the window, and over each of its sessions. */
  share: 0.5,
  sessionShare: 0.4,
  /** Exposures in a row without a step up, and lifts stalled (and the share of the main lifts). */
  stallExposures: 3,
  stalledLifts: 3,
  stalledShare: 1 / 3,
  /** Pain stops on different exercises within this many days. */
  painDays: 14,
  painExercises: 2,
  /** A break this long inside the evidence cancels it; a dismissal keeps the offer quiet this long. */
  gapDays: 14,
  quietDays: 14,
  /** Training weeks kept between the lighter week and the scheduled deload. */
  weeksBeforeDeload: 3,
} as const;

export type LighterWeekReasonCode = 'hard-sets' | 'stalled-lifts' | 'pain-stops';

export interface LighterWeekReason {
  code: LighterWeekReasonCode;
  /** Counts for the "why" text. */
  params: Record<string, number>;
  /** The exercises the evidence is about. */
  exerciseIds: string[];
  /** The sessions it was read from. */
  logIds: string[];
}

export interface LighterWeekSignal {
  reasons: LighterWeekReason[];
  /** The programme week that becomes the lighter one; the rest of the cycle moves back. */
  startWeek: number;
}

/** Steps up that count as progress. */
const UP_CODES = new Set([
  'load-up',
  'load-up-low',
  'reps-up',
  'band-heavier',
  'band-lighter',
  'added-load-start',
  'beyond-range',
  'tempo-slower',
  'time-up',
  'work-longer',
  'from-test',
]);

const goalOf = (e: Exposure, set?: Exposure['evidence'][number]): number =>
  set?.goal ?? e.item.goal ?? (e.item.target.kind === 'reps' ? e.item.target.min : 0);

export const isEarlyPhase = (phase: Phase): boolean => phase.origin === 'early';

/** The week of the programme's scheduled deload, when it has one. */
const scheduledDeloadWeek = (programme: Programme): number | undefined =>
  programme.phases
    .filter((p) => !isEarlyPhase(p) && weekRole(programme, p.fromWeek) === 'deload')
    .map((p) => p.fromWeek)
    .at(-1);

/** The last week of re-adaptation, 0 when there is none. */
const readaptationEnd = (programme: Programme): number =>
  Math.max(0, ...programme.phases.filter((p) => p.kind === 're-adaptation').map((p) => p.toWeek));

/**
 * Whether the user should be offered a lighter week now, and why. The offer waits for enough
 * training after re-adaptation, stays clear of the scheduled deload, comes once per programme
 * and is quiet for two weeks after a dismissal.
 */
export function lighterWeekSignal(
  programme: Programme & { id: string },
  logs: readonly SessionLog[],
  answers: readonly Answer[],
  now: Date,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): LighterWeekSignal | undefined {
  if (programme.phases.some(isEarlyPhase)) return undefined;
  const dismissed = programme.lighterWeek?.dismissedAt;
  const after = dismissed === undefined ? -Infinity : Date.parse(dismissed);
  if (dismissed !== undefined && now.getTime() - after < LIGHTER_WEEK.quietDays * DAY_MS)
    return undefined;

  const deload = scheduledDeloadWeek(programme);
  if (deload === undefined) return undefined;
  const position = nextSession(programme, logs);
  if (position.finished) return undefined;
  const ownAll = logs.filter(
    (l) => l.source.kind === 'programme' && l.source.programmeId === programme.id,
  );
  const lastWeek = Math.max(
    0,
    ...ownAll.flatMap((l) => (l.source.kind === 'programme' ? [l.source.week] : [])),
  );
  const startWeek =
    lastWeek >= position.week ? Math.max(position.week + 1, lastWeek + 1) : position.week;
  if (startWeek > deload - LIGHTER_WEEK.weeksBeforeDeload || startWeek > programme.weeks)
    return undefined;

  const readapt = readaptationEnd(programme);
  const reasons: LighterWeekReason[] = [];
  const finished = ownAll.filter(
    (l) => l.status !== 'in-progress' && Date.parse(l.startedAt) > after,
  );
  const weekOf = (l: SessionLog) => (l.source.kind === 'programme' ? l.source.week : 0);
  const training = finished.filter(
    (l) =>
      weekRole(programme, weekOf(l)) !== 'deload' &&
      phaseForWeek(programme, weekOf(l))?.kind !== 're-adaptation',
  );
  const times = ownAll
    .filter((l) => l.status !== 'in-progress')
    .map((l) => Date.parse(l.startedAt))
    .sort((a, b) => a - b);
  const ctx: Ctx = { programme, all: logs, ownAll, training, answers, now, exercises, times };

  if (startWeek >= Math.max(3, readapt + 2)) {
    const hard = hardShare(ctx);
    if (hard) reasons.push(hard);
    const stalled = stalledLifts(ctx);
    if (stalled) reasons.push(stalled);
  }
  if (startWeek >= Math.max(3, readapt + 1)) {
    const pain = painStops(ctx, after);
    if (pain) reasons.push(pain);
  }
  return reasons.length > 0 ? { reasons, startWeek } : undefined;
}

interface Ctx {
  programme: Programme & { id: string };
  /** Every log, whatever its source. */
  all: readonly SessionLog[];
  /** Finished or not, every log of the programme. */
  ownAll: SessionLog[];
  /** Finished programme sessions that count as evidence: not deload, not re-adaptation, after a dismissal. */
  training: SessionLog[];
  answers: readonly Answer[];
  now: Date;
  exercises: ReadonlyMap<string, Exercise>;
  /** Start times of the programme's sessions, oldest first. */
  times: number[];
}

/** The first training exposure of an exercise in the programme: its loads were estimates. */
const calibrationLog = (ctx: Ctx, exerciseId: string): string | undefined =>
  exposuresOf(exerciseId, ctx.ownAll, [ctx.programme])
    .filter((e) => e.role === 'build' && e.evidence.length > 0)
    .at(-1)?.logId;

/** Tests whether a gap this long sits in the evidence: a break, not a stall. */
const hasGap = (ctx: Ctx, since: number): boolean =>
  longestGapDays(ctx.times, since, ctx.now.getTime()) >= LIGHTER_WEEK.gapDays;

interface Counted {
  logId: string;
  total: number;
  misses: number;
  exerciseIds: Set<string>;
}

/** Straight main sets of one session as hard-share evidence. */
function countSets(ctx: Ctx, log: SessionLog): Counted {
  const out: Counted = { logId: log.id, total: 0, misses: 0, exerciseIds: new Set() };
  log.plan.main.forEach((block, blockIndex) => {
    if (block.type !== 'straight' || block.item.target.kind !== 'reps') return;
    const item = block.item;
    const minReps = block.item.target.min;
    if (calibrationLog(ctx, item.exerciseId) === log.id) return;
    const logged = log.sets.filter(
      (s) => s.section === 'main' && s.blockIndex === blockIndex && s.itemIndex === 0,
    );
    if (logged.some((s) => s.flag)) return;
    const ik = itemKey('main', blockIndex, 0);
    const backOff = log.adjustments?.backOffLoads?.[ik];
    const before = exposuresOf(item.exerciseId, ctx.ownAll, [ctx.programme]).find(
      (e) => e.at < log.startedAt && e.itemKey.startsWith('main/') && e.evidence.length > 0,
    );
    for (let n = 1; n <= block.sets; n++) {
      const sides = logged.filter((s) => s.set === n);
      if (sides.length === 0) {
        if (log.endedEarly) {
          out.total++;
          out.misses++;
          out.exerciseIds.add(item.exerciseId);
        }
        continue;
      }
      const reps = sides.map((s) => s.actual?.reps);
      if (reps.some((r) => r === undefined)) continue;
      const first = sides[0]!;
      if (n > 1 && backOff !== undefined && sameLoad(first.planned.load, backOff)) continue;
      const value = Math.min(...(reps as number[]));
      const goal = first.planned.goal ?? minReps;
      const rir = first.planned.rir ?? item.rir;
      const hard = sides.some((s) => s.feel === 'hard' && s.feelChosen === true);
      const load = first.actual?.load ?? first.planned.load;
      const previous = before?.evidence.find((e) => e.set === n);
      const dropped =
        previous !== undefined && sameLoad(previous.load, load) && value < previous.value;
      out.total++;
      if ((hard && rir !== undefined && rir >= 2) || value <= goal - 2 || dropped) {
        out.misses++;
        out.exerciseIds.add(item.exerciseId);
      }
    }
  });
  return out;
}

/** Reason 1: most of the recent main sets were hard or missed. */
function hardShare(ctx: Ctx): LighterWeekReason | undefined {
  const recent = ctx.training
    .filter((l) => l.status === 'completed')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, LIGHTER_WEEK.lookBackSessions);
  const window = recent
    .map((l) => countSets(ctx, l))
    .filter((c) => c.total >= LIGHTER_WEEK.minSetsPerSession)
    .slice(0, LIGHTER_WEEK.windowSessions);
  if (window.length < LIGHTER_WEEK.windowSessions) return undefined;
  const total = window.reduce((n, c) => n + c.total, 0);
  const misses = window.reduce((n, c) => n + c.misses, 0);
  if (total < LIGHTER_WEEK.minSets || misses < LIGHTER_WEEK.share * total) return undefined;
  if (window.some((c) => c.misses < LIGHTER_WEEK.sessionShare * c.total)) return undefined;
  const oldest = Math.min(
    ...window.map((c) => Date.parse(ctx.training.find((l) => l.id === c.logId)!.startedAt)),
  );
  if (hasGap(ctx, oldest)) return undefined;
  return {
    code: 'hard-sets',
    params: { sets: total, misses, sessions: window.length },
    exerciseIds: [...new Set(window.flatMap((c) => [...c.exerciseIds]))],
    logIds: window.map((c) => c.logId),
  };
}

/** A step up between two exposures of one lift, newer last. */
const stepsUp = (older: Exposure, newer: Exposure, exercise: Exercise | undefined): boolean =>
  (newer.note !== undefined && UP_CODES.has(newer.note.code)) ||
  levelOf(newer.item.load, exercise) > levelOf(older.item.load, exercise) + 1e-9 ||
  goalOf(newer) > goalOf(older) ||
  JSON.stringify(newer.item.tempo) !== JSON.stringify(older.item.tempo);

/** Reason 2: several main lifts have not moved up for three sessions. */
function stalledLifts(ctx: Ctx): LighterWeekReason | undefined {
  const ids = new Set<string>();
  for (const log of ctx.training)
    for (const block of log.plan.main) {
      const items = block.type === 'straight' ? [block.item] : block.items;
      for (const item of items) {
        const exercise = ctx.exercises.get(item.exerciseId);
        if (exercise && isMainLift(exercise) && item.target.kind === 'reps')
          ids.add(item.exerciseId);
      }
    }
  const trainingIds = new Set(ctx.training.map((l) => l.id));
  let candidates = 0;
  const stalled: { id: string; since: number; logIds: string[] }[] = [];
  for (const id of ids) {
    const calibration = calibrationLog(ctx, id);
    const eligible = exposuresOf(id, ctx.ownAll, [ctx.programme]).filter(
      (e) =>
        trainingIds.has(e.logId) &&
        e.logId !== calibration &&
        e.itemKey.startsWith('main/') &&
        e.item.target.kind === 'reps' &&
        e.evidence.length > 0,
    );
    if (eligible.length < LIGHTER_WEEK.stallExposures) continue;
    candidates++;
    const last = eligible.slice(0, LIGHTER_WEEK.stallExposures);
    const exercise = ctx.exercises.get(id);
    if (last[0]!.note && AT_MAX.has(last[0]!.note.code)) continue;
    if (painState(exposuresOf(id, ctx.all, [ctx.programme], { anySource: true }), ctx.answers))
      continue;
    const moved =
      last.some((e) => e.note && UP_CODES.has(e.note.code)) ||
      last.slice(0, -1).some((e, i) => stepsUp(last[i + 1]!, e, exercise));
    if (moved) continue;
    const missed = last.some((e) => e.evidence.some((s) => s.touched && s.value < goalOf(e, s)));
    if (!missed) continue;
    stalled.push({
      id,
      since: Math.min(...last.map((e) => Date.parse(e.at))),
      logIds: last.map((e) => e.logId),
    });
  }
  if (stalled.length < LIGHTER_WEEK.stalledLifts) return undefined;
  if (stalled.length < LIGHTER_WEEK.stalledShare * candidates) return undefined;
  if (hasGap(ctx, Math.min(...stalled.map((s) => s.since)))) return undefined;
  return {
    code: 'stalled-lifts',
    params: { lifts: stalled.length, of: candidates, sessions: LIGHTER_WEEK.stallExposures },
    exerciseIds: stalled.map((s) => s.id),
    logIds: [...new Set(stalled.flatMap((s) => s.logIds))],
  };
}

/** Reason 3: pain stopped different exercises lately (any kind of session, abandoned included). */
function painStops(ctx: Ctx, after: number): LighterWeekReason | undefined {
  const since = ctx.now.getTime() - LIGHTER_WEEK.painDays * DAY_MS;
  const exerciseIds = new Set<string>();
  const logIds = new Set<string>();
  let oldest = Infinity;
  for (const log of ctx.all) {
    const at = Date.parse(log.startedAt);
    if (
      log.status === 'in-progress' ||
      isCooldownLog(log) ||
      at < since ||
      at > ctx.now.getTime() ||
      at <= after
    )
      continue;
    for (const set of log.sets) {
      if (set.flag !== 'pain') continue;
      const swapped = ctx.answers.some(
        (a) =>
          a.kind === 'pain' &&
          a.answer === 'swap' &&
          a.exerciseId === set.exerciseId &&
          a.logId === log.id,
      );
      if (swapped) continue;
      exerciseIds.add(set.exerciseId);
      logIds.add(log.id);
      oldest = Math.min(oldest, at);
    }
  }
  if (exerciseIds.size < LIGHTER_WEEK.painExercises) return undefined;
  if (hasGap(ctx, oldest)) return undefined;
  return {
    code: 'pain-stops',
    params: { exercises: exerciseIds.size, days: LIGHTER_WEEK.painDays },
    exerciseIds: [...exerciseIds],
    logIds: [...logIds],
  };
}

const LIGHTER_NAME = { fr: 'Semaine allégée', en: 'Lighter week' };

/** What the lighter week adjusts: the scheduled deload without its max test, else 60 % volume at RIR 3. */
const lighterAdjustments = (programme: Programme): PhaseAdjustment[] => {
  const scheduled = programme.phases.find(
    (p) => !isEarlyPhase(p) && weekRole(programme, p.fromWeek) === 'deload',
  );
  const base: PhaseAdjustment[] = scheduled
    ? scheduled.adjustments.filter((a) => a.kind !== 'max-test')
    : [
        { kind: 'volume', factor: 0.6 },
        { kind: 'rir', value: 3, scope: 'all-sets' },
      ];
  const scaled = base.map((a): PhaseAdjustment =>
    a.kind === 'volume' ? { ...a, intervals: true } : a,
  );
  return scaled.some((a) => a.kind === 'volume')
    ? scaled
    : [{ kind: 'volume', factor: 0.6, intervals: true }, ...scaled];
};

/**
 * The programme with a lighter week inserted as `startWeek`: one more week, the phases from
 * there on moved back a week, a phase running across it split in two. Loads are untouched.
 * `now` is reserved for stamping the change.
 */
export function insertLighterWeek<P extends Programme>(
  programme: P,
  startWeek: number,
  _now: Date,
): P {
  if (startWeek < 1 || startWeek > programme.weeks)
    throw new Error(`week ${startWeek} outside the programme`);
  const phases: Phase[] = [];
  for (const phase of programme.phases) {
    if (phase.toWeek < startWeek) phases.push(phase);
    else if (phase.fromWeek >= startWeek)
      phases.push({ ...phase, fromWeek: phase.fromWeek + 1, toWeek: phase.toWeek + 1 });
    else {
      phases.push({ ...phase, toWeek: startWeek - 1 });
      phases.push({ ...phase, fromWeek: startWeek + 1, toWeek: phase.toWeek + 1 });
    }
  }
  phases.push({
    name: LIGHTER_NAME,
    kind: 'deload',
    origin: 'early',
    fromWeek: startWeek,
    toWeek: startWeek,
    adjustments: lighterAdjustments(programme),
  });
  phases.sort((a, b) => a.fromWeek - b.fromWeek);
  return { ...programme, weeks: programme.weeks + 1, phases };
}
