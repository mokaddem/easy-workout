import type {
  Exercise,
  Level,
  Load,
  MaxTest,
  ProgressionNote,
  SessionItem,
  Target,
  Tempo,
} from '../../domain';
import { exerciseById } from '../../catalogue';
import { fitFor, isConstrained, type Constraints } from '../generate/constraints';
import { FIXED_REP_EXERCISES } from '../generate/dose';
import type { Exposure, WeekRole } from './exposures';
import {
  capacity,
  effectiveKg,
  ladderFor,
  loadAt,
  predictReps,
  rungCount,
  rungOf,
  sameLoad,
  type Ladder,
} from './ladder';

/** Reps past the top of the range while the next weight is still out of reach. */
const BEYOND_REPS = 4;
/** Reps past the top before a heavier band. */
const BAND_BEYOND_REPS = 2;
/** Reps past the top before a bodyweight move takes added load. */
const ADDED_START_BEYOND_REPS = 2;
/** Sessions at the top of a fixed-rep move, at one load, before the next load. */
const LOAD_ONLY_SESSIONS = 3;
/** Seconds past the top of a hold before a harder variant is offered. */
const BEYOND_SEC = 10;
/** A heavier weight more than this far up is out of reach: the equipment's max for this move. */
const MAX_JUMP = 1.25;
/** Week-1 calibration never raises the load more than this, nor lowers it below the floor. */
const CALIBRATION_CAP = 1.3;
/** Lightest step down: one a step up can retake (1 / MAX_JUMP). */
const CALIBRATION_FLOOR = 0.8;
/** First-set misses in a row before a band-assisted variant, then an easier one, is offered. */
const ASSISTED_AFTER = 2;
const EASIER_AFTER = 3;
/** Single-value targets climb over this many reps (time: seconds) before the load moves. */
const SPAN_REPS = 2;
const SPAN_SEC = 10;
/** Moves done for as many reps as possible take added load from these reps. */
const MAX_ADDED_FROM = { dip: 15, pullVertical: 12 } as const;
/** Fewer reps than this on a max pull-up: a band would help. */
const MAX_ASSIST_BELOW = 3;
/** Breaks, in days since the last programme session. */
export const BREAK_DAYS = { eased: 14, step: 28, recalibrate: 84 } as const;
/** Ballistic intervals stretch their work up to this; others up to 20 s over the generated work. */
const BALLISTIC_WORK_MAX = 40;
const WORK_STEP = 10;
const WORK_HEADROOM = 20;

export interface ItemInput {
  /** The item as this week prescribes it, swaps applied. */
  base: SessionItem;
  section: 'main' | 'finisher';
  exercise: Exercise;
  /** Same key, newest first. */
  exposures: readonly Exposure[];
  /** Same exercise, any key, newest first. */
  all: readonly Exposure[];
  inventory: Parameters<typeof ladderFor>[2];
  bodyweightKg?: number;
  /** Longest gap, in days, between programme sessions since this exercise was last done. */
  gapDays?: number;
  /** The week being prescribed: a deload repeats the last training week's loads. */
  role?: WeekRole;
  /** Epoch ms of the session being prescribed. */
  now?: number;
  level?: Level;
  /** The exercise spares a limited joint: no weight step right after a set picked hard. */
  doseCap?: boolean;
  /** What the user avoids: a harder variant that is ruled out is no way forward. */
  constraints?: Constraints;
}

export type LadderEnd =
  | { kind: 'harder' | 'easier' | 'assisted'; logId: string }
  | { kind: 'buy-next' }
  /** Nothing harder exists and nothing to buy would help: the goal holds at its top. */
  | {
      kind: 'none';
      /** The harder variants exist but a limitation, quiet or small space rules them out. */ limited?: true;
    };

export interface ItemResult {
  item: SessionItem;
  note?: ProgressionNote;
  ladderEnd?: LadderEnd;
}

export const note = (
  code: string,
  params: ProgressionNote['params'] = {},
  newLoad = false,
): ProgressionNote => ({ code, params, ...(newLoad && { newLoad: true }) });

/** A load as a short token the interface formats: `kg:12`, `added:5`, `band:heavy`, `bw`. */
export const loadToken = (load: Load | undefined): string => {
  if (!load || load.kind === 'bodyweight') return 'bw';
  if (load.kind === 'band') return `band:${load.level}`;
  return `${load.kind === 'kg' ? 'kg' : 'added'}:${load.kg}`;
};

/** The ladder for the load in use (latest exposure first, so an added-load implement sticks). */
const ladderOf = (input: ItemInput): Ladder => {
  const inUse = input.all[0]?.item.load;
  return ladderFor(
    input.exercise,
    inUse && compatible(input.exercise, inUse, input.base.load) ? inUse : input.base.load,
    input.inventory,
    input.bodyweightKg,
  );
};

/** A load from history fits the slot: same kind, or bodyweight vs added load on a loadable move. */
export const compatible = (exercise: Exercise, load: Load, base: Load | undefined): boolean =>
  load.kind === base?.kind ||
  (exercise.loadType === 'bodyweight-loadable' &&
    (load.kind === 'added-kg' || load.kind === 'bodyweight') &&
    (base === undefined || base.kind === 'added-kg' || base.kind === 'bodyweight'));

const isBallistic = (exercise: Exercise) =>
  exercise.tags.includes('ballistic') || exercise.tags.includes('plyometric');

/** The range a goal climbs over: single values get a short span, fixed-rep moves don't. */
const spanOf = (target: Target, loadOnly: boolean): [number, number] => {
  if (target.kind === 'reps')
    return loadOnly || target.min !== target.max
      ? [target.min, target.max]
      : [target.min, target.min + SPAN_REPS];
  if (target.kind === 'time')
    return target.minSec !== target.maxSec
      ? [target.minSec, target.maxSec]
      : [target.minSec, target.minSec + SPAN_SEC];
  return [1, 1];
};

const bottomOf = (target: Target): number =>
  target.kind === 'reps' ? target.min : target.kind === 'time' ? target.minSec : 1;

/** An exposure's goal brought to reserve 2, so weeks with different reserves compare. */
const goalAtTwo = (e: Exposure, fixedReps = false): number =>
  (e.item.goal ?? bottomOf(e.item.target)) + (fixedReps ? 0 : (e.item.rir ?? 2) - 2);

type Outcome = 'hit' | 'hold' | 'miss';

interface Reading {
  outcome: Outcome;
  /** The first set fell short of the range (or of a goal set under it). */
  firstMiss: boolean;
  /** Reps the first set shows at reserve 2. */
  shown: number;
  allEasy: boolean;
}

/**
 * What the evidence of one exposure says (reps). The first set must meet its goal; later sets may
 * fade about a rep and a half each, four at most, as sets do at a steady reserve with short rests
 * (a later set short of its goal and marked hard is that same fade, not counted twice). A miss is read from the fresh
 * sets only, and one rep short is a day's variation: a first set two reps under the range, or a
 * second set more than three under it. The last sets of a long block fade further without the
 * load being wrong.
 */
function readReps(e: Exposure, lo: number, fixedReps = false): Reading {
  const sets = e.evidence;
  const first = sets[0]!;
  const goalOf = (g?: number) => g ?? e.item.goal ?? bottomOf(e.item.target);
  const eff = (x: (typeof sets)[number]) => x.value + x.feel;
  const firstGoal = goalOf(first.goal);
  const floor = Math.min(lo, firstGoal);
  const hit =
    eff(first) >= firstGoal &&
    sets
      .slice(1)
      .every(
        (x, i) =>
          x.value + Math.max(0, x.feel) >= goalOf(x.goal) - Math.min(Math.floor(1.5 * (i + 1)), 4),
      );
  const firstMiss = first.value < floor - 1;
  const second = sets[1];
  const miss = firstMiss || (second !== undefined && second.value < floor - 3);
  return {
    outcome: miss ? 'miss' : hit ? 'hit' : 'hold',
    firstMiss,
    shown: eff(first) + (fixedReps ? 0 : (first.rir ?? e.item.rir ?? 2) - 2),
    allEasy: sets.every((x) => x.easy),
  };
}

/** The load every evidence set was actually done with, when it differs from the plan. */
function ownLoad(e: Exposure): Load | undefined {
  const loads = e.evidence.map((s) => s.load);
  const first = loads[0];
  if (!first || loads.some((l) => !sameLoad(l, first))) return undefined;
  return sameLoad(first, e.item.load) ? undefined : first;
}

const slower = (a: Tempo | undefined, b: Tempo | undefined) =>
  a !== undefined && (b === undefined ? a.down >= 3 : a.down > b.down);

/** The tempo stage: one more second lowering (at least 3) and a one-second pause. */
const slowTempo = (tempo: Tempo | undefined): Tempo => ({
  down: Math.max(3, (tempo?.down ?? 2) + 1),
  pause: Math.max(1, tempo?.pause ?? 0),
  up: tempo?.up ?? 1,
});

const withItem = (
  base: SessionItem,
  load: Load | undefined,
  goal: number | undefined,
  tempo: Tempo | undefined,
): SessionItem => {
  const item: SessionItem = { ...base };
  if (load) item.load = load;
  if (goal === undefined) delete item.goal;
  else item.goal = Math.max(1, Math.round(goal));
  if (tempo) item.tempo = tempo;
  else delete item.tempo;
  return item;
};

/** A range left this long while the exercise ran in another one resumes from the newer one. */
const STALE_KEY_DAYS = 21;
/** How far back a new range looks for the exercise's strongest evidence. */
const SEED_WINDOW_DAYS = 42;

const usable = (exposures: readonly Exposure[]) =>
  exposures.filter((e) => e.evidence.length > 0 && e.role !== 'deload');

/** What an exercise gets next, from its history. */
export function progressItem(input: ItemInput): ItemResult {
  const result = progressByKind(input);
  return input.doseCap ? holdAfterHard(input, result) : result;
}

/**
 * An exercise sparing a limited joint doesn't get a heavier weight (or band step) right after a
 * set the user picked as hard: it stays at its load, with the goal it had.
 */
function holdAfterHard(input: ItemInput, result: ItemResult): ItemResult {
  const last = usable(input.exposures)[0];
  const was = last?.item.load;
  const now = result.item.load;
  if (!last || !was || !now || !last.evidence.some((e) => e.hard)) return result;
  const ladder = ladderOf(input);
  if (rungOf(ladder, now) <= rungOf(ladder, was)) return result;
  const { ladderEnd: _ladderEnd, ...rest } = result;
  return {
    ...rest,
    item: withItem(result.item, was, last.item.goal ?? result.item.goal, result.item.tempo),
    note: note('dose-cap-hold', { load: loadToken(was) }),
  };
}

function progressByKind(input: ItemInput): ItemResult {
  switch (input.base.target.kind) {
    case 'reps':
      return progressReps(input);
    case 'time':
      return progressTime(input);
    case 'max':
      return progressMax(input);
    case 'interval':
      return progressInterval(input);
    case 'cardio':
      return { item: input.base };
  }
}

/**
 * Seeds a key from the exercise's history elsewhere (another range or block, or the same key
 * after a long while on another): the strongest of its recent training-week exposures, an
 * untouched one-tap counting as its planned goal at its planned RIR. Never more than one step
 * heavier than that exposure, never more than one step under `floor` (the key's own last load);
 * only a heavier load gets the new-weight check.
 */
function fromHistory(
  input: ItemInput,
  ladder: Ladder,
  lo: number,
  hi: number,
  floor?: Exposure,
): ItemResult | undefined {
  const pool = usable(input.all);
  const newest = pool[0];
  if (!newest) return undefined;
  const { base } = input;
  const rir = base.rir ?? 2;
  const since = Date.parse(newest.at) - SEED_WINDOW_DAYS * 86_400_000;
  // The strongest recent evidence: a light circuit or a low-rep one-tap undersells the lifter.
  let best: { exposure: Exposure; cap: number } | undefined;
  for (const e of pool) {
    if (Date.parse(e.at) < since || e.role !== 'build' || e.item.target.kind !== 'reps') continue;
    const kg = effectiveKg(ladder, rungOf(ladder, e.item.load));
    const first = e.evidence[0];
    if (kg === undefined || !first) continue;
    const cap = capacity(kg, first.value, (first.rir ?? e.item.rir ?? 2) + first.feel);
    if (!best || cap > best.cap) best = { exposure: e, cap };
  }
  const other = best?.exposure ?? newest;
  const from = rungOf(ladder, other.item.load);
  let rung = from;
  let goal = lo;
  if (best) {
    // The heaviest load that reaches the range, at most one step up.
    let top = 0;
    for (let r = 0; r <= Math.min(from + 1, rungCount(ladder) - 1); r++) {
      const kg = effectiveKg(ladder, r);
      if (kg !== undefined && predictReps(best.cap, kg, rir) >= lo) top = r;
    }
    rung = top;
  }
  if (floor) rung = Math.max(rung, rungOf(ladder, floor.item.load) - 1);
  const kg = effectiveKg(ladder, rung);
  if (best && kg !== undefined) goal = Math.min(hi, Math.max(lo, predictReps(best.cap, kg, rir)));
  const load = ladder.kind === 'none' ? base.load : loadAt(ladder, rung);
  return {
    item: withItem(base, load, goal, base.tempo),
    note: note('from-history', { load: loadToken(load), goal }, rung > from),
  };
}

function progressReps(input: ItemInput): ItemResult {
  const { base, exercise } = input;
  const target = base.target as Extract<Target, { kind: 'reps' }>;
  const loadOnly = FIXED_REP_EXERCISES.has(exercise.id) || target.max <= 3;
  const [lo, hi] = spanOf(target, loadOnly);
  // A fixed-rep move doesn't trade reps for reserve: the count is the movement.
  const rir = loadOnly ? 2 : (base.rir ?? 2);
  const ladder = ladderOf(input);
  // Finisher items without an effort target keep their load; their goal still climbs.
  const movesLoad = !(input.section === 'finisher' && base.rir === undefined);
  const readings = new Map<Exposure, Reading>();
  const read = (e: Exposure) => {
    let r = readings.get(e);
    if (!r) readings.set(e, (r = readReps(e, spanOf(e.item.target, loadOnly)[0], loadOnly)));
    return r;
  };
  // Peak weeks count only when they show progress; deloads never do.
  const evidence = usable(input.exposures).filter(
    (e) => e.role === 'build' || read(e).outcome === 'hit',
  );
  // A range not done for weeks while another one moved on starts again from the newer one.
  const newest = usable(input.all)[0];
  const sameKey = evidence[0];
  if (
    sameKey &&
    newest &&
    input.role !== 'deload' &&
    newest.key !== sameKey.key &&
    Date.parse(newest.at) - Date.parse(sameKey.at) > STALE_KEY_DAYS * 86_400_000
  ) {
    const seeded = fromHistory(input, ladder, lo, hi, sameKey);
    if (seeded) return breakAdjust(input, seeded, ladder, lo);
  }
  const atGoal = (e: Exposure) => goalAtTwo(e, loadOnly) + 2 - rir;
  const allowLow = input.level !== 'beginner' && exercise.pattern !== 'hinge';

  if (evidence.length === 0) {
    const last = input.exposures[0];
    if (last)
      return { item: withItem(base, last.item.load ?? base.load, atGoal(last), last.item.tempo) };
    const seeded = fromHistory(input, ladder, lo, hi);
    if (seeded) return breakAdjust(input, seeded, ladder, lo);
    return { item: withItem(base, base.load, lo, base.tempo) };
  }

  const last = evidence[0]!;
  // A deload repeats the last training week at its own reserve: nothing moves.
  if (input.role === 'deload')
    return { item: withItem(base, last.item.load ?? base.load, atGoal(last), last.item.tempo) };

  const reading = read(last);
  let rung = rungOf(ladder, last.item.load);
  let goal2 = goalAtTwo(last, loadOnly);
  let tempo = last.item.tempo;
  const tempoStage = slower(last.item.tempo, base.tempo);
  let result: { code: string; params: ProgressionNote['params']; newLoad?: boolean } | undefined;
  let stepped = false;
  let ladderEnd: LadderEnd | undefined;
  const params = () => ({
    sets: last.evidence.length,
    reps: last.evidence[0]!.value,
    load: loadToken(last.item.load),
  });

  const step = (to: number, goalAtWeek: number, code: string) => {
    const from = loadAt(ladder, rung);
    rung = to;
    goal2 = goalAtWeek + rir - 2;
    tempo = base.tempo;
    stepped = true;
    result = {
      code,
      params: { ...params(), from: loadToken(from), to: loadToken(loadAt(ladder, to)) },
      newLoad: true,
    };
  };

  const own = ownLoad(last);
  const allEvidence = usable(input.all);
  const firstEver = allEvidence[allEvidence.length - 1];
  const earlierTouched = allEvidence.slice(1).find((e) => e.touched);
  const firstTouch =
    last.touched &&
    (earlierTouched === undefined ||
      Date.parse(last.at) - Date.parse(earlierTouched.at) > BREAK_DAYS.recalibrate * 86_400_000);
  // Calibration reads the first sets the user actually logged, on a weight already in use.
  const calibrating =
    firstTouch &&
    !loadOnly &&
    movesLoad &&
    (ladder.kind === 'kg' || (ladder.kind === 'added' && rung > 0));

  if (own && ladder.kind !== 'none') {
    rung = rungOf(ladder, own);
    goal2 = reading.shown + (last.evidence[0]!.value >= lo ? 1 : 0);
    result = { code: 'your-load', params: { load: loadToken(own) } };
  } else if (calibrating && calibrate()) {
    // The first logged sets moved the load or the goal; nothing else applies.
  } else if (
    firstTouch &&
    !loadOnly &&
    reading.outcome !== 'hit' &&
    last.evidence[0]!.value < lo &&
    !calibrating
  ) {
    // Nothing lighter to move to (bodyweight, the lightest weight or band): the goal starts where
    // the first logged sets were.
    const from = goal2 + 2 - rir;
    goal2 = Math.min(goal2, Math.max(lo - 1 + rir - 2, reading.shown));
    result = { code: 'calibrated', params: { ...params(), from, to: goal2 + 2 - rir } };
  } else if (reading.outcome === 'hit') {
    if (last.note?.newLoad && !last.touched) {
      result = { code: 'confirm-new-load', params: params() };
    } else {
      const next = Math.max(goal2 + (reading.allEasy ? 2 : 1), reading.shown);
      result = {
        code: 'reps-up',
        params: { ...params(), from: goal2 + 2 - rir, to: next + 2 - rir },
      };
      goal2 = next;
    }
  } else if (reading.outcome === 'miss') {
    // Leading misses at this load; the very first week of an exercise never counts against it.
    let misses = 0;
    let firstMisses = 0;
    let atLoad = 0;
    let streak = true;
    let firstStreak = true;
    for (const e of evidence) {
      if (!sameLoad(e.item.load, last.item.load)) break;
      atLoad++;
      const r = read(e);
      const counts = e !== firstEver;
      if (streak && counts && r.outcome === 'miss') misses++;
      else streak = false;
      if (firstStreak && counts && r.firstMiss) firstMisses++;
      else firstStreak = false;
    }
    const downKg = rung > 0 ? effectiveKg(ladder, rung - 1) : undefined;
    const hereKg = effectiveKg(ladder, rung);
    // A lighter weight more than a quarter down is no step: keep it and ease the goal instead.
    const tooFar =
      downKg !== undefined && hereKg !== undefined && downKg < hereKg * CALIBRATION_FLOOR;
    if (movesLoad && misses >= 2 && atLoad >= 3 && rung > 0 && tooFar) {
      goal2 = Math.min(goal2, Math.max(lo - 2 + rir - 2, reading.shown));
      result = {
        code: 'hold-miss',
        params: { ...params(), from: goalAtTwo(last, loadOnly) + 2 - rir, to: goal2 + 2 - rir },
      };
    } else if (movesLoad && misses >= 2 && atLoad >= 3 && rung > 0) {
      const toKg = effectiveKg(ladder, rung - 1);
      const fromKg = effectiveKg(ladder, rung);
      const goal =
        toKg !== undefined && fromKg !== undefined
          ? Math.min(hi, Math.max(lo, predictReps(capacity(fromKg, reading.shown, 2), toKg, rir)))
          : lo;
      step(
        rung - 1,
        goal,
        ladder.kind === 'band' ? (ladder.assisted ? 'band-heavier' : 'band-lighter') : 'load-down',
      );
    } else {
      result = { code: 'hold-miss', params: params() };
      easeIfShort();
      const bodyweight =
        exercise.loadType === 'bodyweight' || exercise.loadType === 'bodyweight-loadable';
      const lightest =
        rung === 0 &&
        (bodyweight || ladder.kind === 'kg' || (ladder.kind === 'band' && !ladder.assisted));
      if (lightest && bodyweight && exercise.pattern === 'pull-vertical') {
        if (firstMisses >= ASSISTED_AFTER) ladderEnd = { kind: 'assisted', logId: last.logId };
      } else if (lightest && firstMisses >= EASIER_AFTER)
        ladderEnd = { kind: 'easier', logId: last.logId };
    }
  } else {
    result = { code: 'hold', params: params() };
    easeIfShort();
  }

  /**
   * A goal the first set keeps missing by two reps or more, twice running at one load, comes down
   * to what was shown (never more than two under the range): when no lighter step exists, or it
   * isn't time to take it, the goal is what gives.
   */
  function easeIfShort() {
    let short = 0;
    for (const e of evidence) {
      if (e === firstEver || !sameLoad(e.item.load, last.item.load)) break;
      const first = e.evidence[0]!;
      const goal = first.goal ?? e.item.goal ?? bottomOf(e.item.target);
      if (first.value > goal - 2) break;
      short++;
    }
    if (short < 2) return;
    const eased = Math.max(lo - 2 + rir - 2, reading.shown);
    if (eased >= goal2) return;
    const from = goal2 + 2 - rir;
    goal2 = eased;
    result = { code: 'hold-miss', params: { ...params(), from, to: goal2 + 2 - rir } };
  }

  /** First logged sets: move a load that is clearly off, or start the goal under the range. */
  function calibrate(): boolean {
    const first = last.evidence[0]!;
    const fromKg = effectiveKg(ladder, rung)!;
    const cap = capacity(fromKg, first.value, (first.rir ?? last.item.rir ?? 2) + first.feel);
    const now = predictReps(cap, fromKg, rir);
    const from = loadToken(last.item.load);
    if (now < lo) {
      const downKg = rung > 0 ? effectiveKg(ladder, rung - 1) : undefined;
      if (now <= lo - 2 && downKg !== undefined && downKg >= fromKg * CALIBRATION_FLOOR) {
        step(rung - 1, Math.min(hi, Math.max(lo, predictReps(cap, downKg, rir))), 'calibrated');
        return true;
      }
      goal2 = Math.max(lo - 1, now) + rir - 2;
      result = { code: 'calibrated', params: { ...params(), from, to: from } };
      return true;
    }
    let best = rung;
    for (let r = rung + 1; r < rungCount(ladder); r++) {
      const kg = effectiveKg(ladder, r);
      if (kg === undefined || kg > fromKg * CALIBRATION_CAP + 1e-9) break;
      if (predictReps(cap, kg, rir) >= lo) best = r;
    }
    if (best === rung) return false;
    step(
      best,
      Math.min(hi, Math.max(lo, predictReps(cap, effectiveKg(ladder, best)!, rir))),
      'calibrated',
    );
    return true;
  }

  let goal = goal2 + 2 - rir;
  if (!stepped && goal > hi) {
    if (!movesLoad) {
      goal = hi;
    } else if (loadOnly) {
      // No reps to climb: the load moves after a few sessions at the top, when the sets said so.
      const next = rung + 1 < rungCount(ladder) ? rung + 1 : undefined;
      const toLoad = next === undefined ? undefined : loadAt(ladder, next);
      const cameDown = evidence.slice(1, 7).some((e) => sameLoad(e.item.load, toLoad));
      const needed = cameDown ? 2 * LOAD_ONLY_SESSIONS : LOAD_ONLY_SESSIONS;
      const fromKg = effectiveKg(ladder, rung);
      const toKg = next === undefined ? undefined : effectiveKg(ladder, next);
      const reachable = fromKg === undefined || toKg === undefined || toKg / fromKg <= MAX_JUMP;
      const atTop = evidence
        .slice(0, needed)
        .filter(
          (e) =>
            sameLoad(e.item.load, last.item.load) &&
            read(e).outcome === 'hit' &&
            (e.item.goal ?? lo) >= hi,
        ).length;
      const first = last.evidence[0]!;
      const said =
        reading.allEasy ||
        (last.touched &&
          fromKg !== undefined &&
          toKg !== undefined &&
          predictReps(capacity(fromKg, first.value, 2 + first.feel), toKg, 2) >= lo);
      if (atTop === needed && next !== undefined && reachable && said) step(next, lo, 'load-up');
      goal = stepped ? lo : hi;
    } else {
      const next = rung + 1 < rungCount(ladder) ? rung + 1 : undefined;
      const fromKg = effectiveKg(ladder, rung);
      const toKg = next === undefined ? undefined : effectiveKg(ladder, next);
      const reachable =
        next !== undefined &&
        (fromKg === undefined || toKg === undefined || toKg / fromKg <= MAX_JUMP);
      const assisted = ladder.kind === 'band' && ladder.assisted;
      const limit = assisted
        ? hi
        : ladder.kind === 'band'
          ? hi + BAND_BEYOND_REPS
          : ladder.kind === 'added' && rung === 0
            ? hi + ADDED_START_BEYOND_REPS
            : hi + BEYOND_REPS;
      if (reachable) {
        const cameDown = evidence
          .slice(1, 7)
          .some((e) => sameLoad(e.item.load, loadAt(ladder, next)));
        const bandCode = assisted ? 'band-lighter' : 'band-heavier';
        if (fromKg !== undefined && toKg !== undefined) {
          const predicted = predictReps(
            capacity(fromKg, Math.max(goal2, reading.shown), 2),
            toKg,
            rir,
          );
          const starting = ladder.kind === 'added' && rung === 0;
          const code = starting ? 'added-load-start' : 'load-up';
          if (predicted >= lo && !starting && (!cameDown || goal >= hi + 2))
            step(next, Math.min(hi, predicted), code);
          // Starting under the range suits neither beginners nor loaded hinges.
          else if (goal >= limit && predicted >= (allowLow ? lo - 2 : lo))
            step(next, Math.min(hi, predicted), predicted >= lo ? code : 'load-up-low');
          else if (goal < maxBeyondFor(ladder, hi))
            result = { code: 'beyond-range', params: { ...params(), goal, max: hi } };
          else equipmentMax();
        } else if (goal >= limit + (cameDown ? 2 : 0)) {
          step(next, lo, bandCode);
        } else {
          result = { code: 'beyond-range', params: { ...params(), goal, max: hi } };
        }
      } else {
        equipmentMax();
      }
    }
  }
  /**
   * The next weight looked out of reach, but the same exercise already works at it in another slot
   * (in its range): take it, with the goal that slot's sets predict here.
   */
  function provenElsewhere(): boolean {
    const next = rung + 1 < rungCount(ladder) ? rung + 1 : undefined;
    if (next === undefined || goal <= hi) return false;
    const target = loadAt(ladder, next);
    const there = input.all.find(
      (e) =>
        e.key !== last.key &&
        e.role !== 'deload' &&
        e.evidence.length > 0 &&
        sameLoad(e.item.load, target) &&
        e.evidence[0]!.value >= bottomOf(e.item.target),
    );
    const kg = effectiveKg(ladder, next);
    if (!there || kg === undefined) return false;
    const first = there.evidence[0]!;
    const predicted = predictReps(
      capacity(kg, first.value, (first.rir ?? there.item.rir ?? 2) + first.feel),
      kg,
      rir,
    );
    if (predicted < (allowLow ? lo - 2 : lo)) return false;
    step(next, Math.min(hi, predicted), predicted >= lo ? 'load-up' : 'load-up-low');
    return true;
  }

  /** Nothing heavier within reach: reps past the range, then a slower tempo, then a variant. */
  function equipmentMax() {
    if (provenElsewhere()) return;
    const assisted = ladder.kind === 'band' && ladder.assisted;
    const maxBeyond = maxBeyondFor(ladder, hi);
    const tempoOk = !assisted && !isBallistic(exercise) && input.section !== 'finisher';
    if (!tempoStage && goal <= maxBeyond) {
      result = { code: 'beyond-range', params: { ...params(), goal, max: hi } };
    } else if (!tempoStage && tempoOk) {
      tempo = slowTempo(base.tempo);
      goal = lo;
      goal2 = goal + rir - 2;
      result = {
        code: 'tempo-slower',
        params: { ...params(), down: tempo.down, pause: tempo.pause },
      };
    } else {
      goal = Math.min(goal, tempoStage ? hi + SPAN_REPS : maxBeyond);
      ladderEnd = endOfLadder(exercise, last.logId, input.constraints);
      result = {
        code:
          ladderEnd.kind === 'buy-next'
            ? 'buy-next'
            : ladderEnd.kind === 'none' && ladderEnd.limited
              ? 'ladder-end-limited'
              : 'ladder-end',
        params: params(),
      };
    }
  }

  if (stepped) goal = goal2 + 2 - rir;

  const load = ladder.kind === 'none' ? (last.item.load ?? base.load) : loadAt(ladder, rung);
  if (!result && !sameLoad(load, last.item.load))
    result = {
      code: 'load-snapped',
      params: { from: loadToken(last.item.load), to: loadToken(load) },
    };
  const floored = Math.max(1, lo - 2, Math.round(goal));
  // A climb that changes nothing this time reads as a hold.
  const unchanged =
    floored === atGoal(last) &&
    sameLoad(load, last.item.load) &&
    JSON.stringify(tempo) === JSON.stringify(last.item.tempo);
  if (unchanged && (result?.code === 'reps-up' || result?.code === 'beyond-range'))
    result = { code: 'hold', params: params() };
  const out: ItemResult = {
    item: withItem(base, load, floored, tempo),
    ...(result && { note: note(result.code, result.params, result.newLoad) }),
    ...(ladderEnd && { ladderEnd }),
  };
  return breakAdjust(input, out, ladder, lo);
}

/** Reps past the top a move may climb before its ladder ends. */
const maxBeyondFor = (ladder: Ladder, hi: number) =>
  ladder.kind === 'band' && ladder.assisted ? hi : hi + BEYOND_REPS;

/** Buying helps only a move that takes more weight or a stronger band. */
const takesLoad = (exercise: Exercise) =>
  exercise.loadType === 'external' ||
  exercise.loadType === 'band' ||
  exercise.loadType === 'band-assisted' ||
  (exercise.addedLoad?.length ?? 0) > 0;

const endOfLadder = (exercise: Exercise, logId: string, constraints?: Constraints): LadderEnd => {
  if (
    exercise.harder.length > 0 &&
    isConstrained(constraints) &&
    exercise.harder.every((id) => {
      const harder = exerciseById.get(id);
      return harder !== undefined && fitFor(harder, constraints) === 'out';
    })
  )
    return { kind: 'none', limited: true };
  return exercise.harder.length > 0
    ? { kind: 'harder', logId }
    : takesLoad(exercise)
      ? { kind: 'buy-next' }
      : { kind: 'none' };
};

/** Time off: ease the goal, or step back a load and start the range again. */
function breakAdjust(input: ItemInput, result: ItemResult, ladder: Ladder, lo: number): ItemResult {
  const days = input.gapDays;
  if (days === undefined || days <= BREAK_DAYS.eased) return result;
  const item = result.item;
  if (days <= BREAK_DAYS.step) {
    if (item.goal === undefined) return result;
    const goal = Math.max(1, lo - 2, item.goal - 2);
    return {
      ...result,
      item: { ...item, goal },
      note: note('goal-eased', { days: Math.round(days) }),
    };
  }
  const rung = rungOf(ladder, item.load);
  const hereKg = effectiveKg(ladder, rung);
  const downKg = rung > 0 ? effectiveKg(ladder, rung - 1) : undefined;
  // Back a step only when the step is a small one; otherwise the range restarts at the same load.
  const coarse =
    hereKg !== undefined && downKg !== undefined && downKg < hereKg * CALIBRATION_FLOOR;
  const load = ladder.kind === 'none' || coarse ? item.load : loadAt(ladder, Math.max(0, rung - 1));
  return {
    item: withItem(item, load, lo, input.base.tempo),
    note: note(
      'welcome-back',
      { days: Math.round(days), load: loadToken(load) },
      !sameLoad(load, item.load),
    ),
  };
}

function progressTime(input: ItemInput): ItemResult {
  const { base, exercise } = input;
  const [lo, hi] = spanOf(base.target, false);
  const evidence = usable(input.exposures);
  if (evidence.length === 0) return { item: withItem(base, base.load, lo, base.tempo) };

  const last = evidence[0]!;
  const sets = last.evidence;
  const first = sets[0]!;
  const goalOf = (e: Exposure, g?: number) => g ?? e.item.goal ?? bottomOf(e.item.target);
  const lastGoal = goalOf(last);
  const hit =
    !sets.some((s) => s.hard) &&
    first.value >= goalOf(last, first.goal) &&
    sets.every((s) => s.value >= goalOf(last, s.goal) - 5);
  const missOf = (e: Exposure) => {
    const v = e.evidence.map((s) => s.value);
    return v[0]! < lo || v.filter((x) => x < lo).length >= 2;
  };
  let goal = lastGoal;
  let result: ProgressionNote | undefined;
  let ladderEnd: LadderEnd | undefined;
  const params = { sets: sets.length, seconds: first.value };

  if (missOf(last)) {
    if (evidence[1] && missOf(evidence[1])) {
      goal = Math.max(5, lastGoal - 5);
      result = note('time-down', { ...params, from: lastGoal, to: goal });
    } else result = note('hold-miss', params);
  } else if (hit) {
    const stepSec = lastGoal >= 30 ? Math.max(5, Math.round((lastGoal * 0.1) / 5) * 5) : 5;
    goal = Math.max(lastGoal + stepSec, Math.floor(first.value / 5) * 5);
    if (goal > hi + BEYOND_SEC) {
      goal = hi + BEYOND_SEC;
      ladderEnd = endOfLadder(exercise, last.logId);
      result = note(ladderEnd.kind === 'buy-next' ? 'hold' : 'ladder-end', params);
    } else
      result = note(goal > hi ? 'beyond-range' : 'time-up', {
        ...params,
        from: lastGoal,
        to: goal,
        max: hi,
      });
  } else result = note('hold', params);

  const out: ItemResult = {
    item: withItem(base, last.item.load ?? base.load, goal, base.tempo),
    note: result,
    ...(ladderEnd && { ladderEnd }),
  };
  const days = input.gapDays;
  if (days !== undefined && days > BREAK_DAYS.eased) {
    const eased = days > BREAK_DAYS.step ? lo : Math.max(lo, goal - 5);
    return {
      item: { ...out.item, goal: eased },
      note: note(days > BREAK_DAYS.step ? 'welcome-back' : 'goal-eased', {
        days: Math.round(days),
      }),
    };
  }
  return out;
}

function progressMax(input: ItemInput): ItemResult {
  const { base, exercise } = input;
  const ladder = ladderOf(input);
  const evidence = usable(input.exposures);
  const last = evidence[0];
  if (!last) return { item: base };
  const first = last.evidence[0]!;
  let rung = rungOf(ladder, last.item.load);
  let result: ProgressionNote | undefined;
  let ladderEnd: LadderEnd | undefined;
  const from = loadAt(ladder, rung);
  const threshold =
    exercise.pattern === 'pull-vertical' ? MAX_ADDED_FROM.pullVertical : MAX_ADDED_FROM.dip;
  if (ladder.kind === 'added' && first.value >= threshold && rung + 1 < ladder.rungs.length) {
    rung++;
    result = note(
      rung === 1 ? 'added-load-start' : 'load-up',
      { reps: first.value, from: loadToken(from), to: loadToken(loadAt(ladder, rung)) },
      true,
    );
  } else if (ladder.kind === 'added' && rung > 0 && first.value < 5) {
    rung--;
    result = note(
      'load-down',
      { reps: first.value, from: loadToken(from), to: loadToken(loadAt(ladder, rung)) },
      true,
    );
  } else if (rung === 0 && exercise.pattern === 'pull-vertical' && first.value < MAX_ASSIST_BELOW) {
    ladderEnd = { kind: 'assisted', logId: last.logId };
  }
  const load = ladder.kind === 'none' ? base.load : loadAt(ladder, rung);
  return {
    item: withItem(base, load, undefined, base.tempo),
    ...(result && { note: result }),
    ...(ladderEnd && { ladderEnd }),
  };
}

function progressInterval(input: ItemInput): ItemResult {
  const { base, exercise } = input;
  const target = base.target as Extract<Target, { kind: 'interval' }>;
  const evidence = usable(input.exposures);
  const last = evidence[0];
  if (!last || last.item.target.kind !== 'interval') return { item: base };
  const done = (e: Exposure) =>
    e.item.target.kind === 'interval' &&
    !e.evidence.some((s) => s.hard) &&
    e.evidence.every((s) => s.value >= (e.item.target as typeof target).rounds);
  const generated = target.workSec;
  const cap = isBallistic(exercise)
    ? Math.max(generated, BALLISTIC_WORK_MAX)
    : generated + WORK_HEADROOM;
  const current = Math.max(generated, last.item.target.workSec);
  let work = current;
  let result: ProgressionNote | undefined;
  // The work grows at most once a week, however often the intervals come round.
  const atCurrent = evidence.filter(
    (e) => e.item.target.kind === 'interval' && e.item.target.workSec === current,
  );
  const since = atCurrent[atCurrent.length - 1];
  const grewThisWeek =
    since !== undefined &&
    evidence.some((e) => e.item.target.kind === 'interval' && e.item.target.workSec < current) &&
    (input.now ?? Date.parse(last.at)) - Date.parse(since.at) < 7 * 86_400_000;
  if (done(last) && grewThisWeek) {
    result = note('hold', { rounds: last.evidence[0]?.value ?? 0 });
  } else if (done(last)) {
    work = Math.min(cap, current + WORK_STEP);
    if (work > current) result = note('work-longer', { from: current, to: work });
  } else if (evidence[1] && !done(evidence[1])) {
    work = Math.max(generated, current - WORK_STEP);
    if (work < current) result = note('work-shorter', { from: current, to: work });
  } else result = note('hold', { rounds: last.evidence[0]?.value ?? 0 });
  // Longer work, same block time: the phases already add the minutes.
  const blockSec = target.rounds * (generated + target.recoverySec);
  const rounds = Math.max(1, Math.floor(blockSec / (work + target.recoverySec)));
  return {
    item: { ...base, target: { ...target, workSec: work, rounds } },
    ...(result && { note: result }),
  };
}

/** Seconds of a hold test a goal may take: most people hold a set well under their limit. */
const TEST_HOLD_SHARE = 0.7;
/** The most a test lifts a goal at once. */
const TEST_LIFT_REPS = 2;
const TEST_LIFT_SEC = 10;

/**
 * A max test done since this range was last trained, at bodyweight, lifts the goal: reps to the
 * test minus the reserve and one, holds to 70 % of the test, by two reps or ten seconds at most and
 * never past the top of the range. It never lowers anything, and it leaves loads, stages and
 * thresholds alone. Only straight sets at the normal tempo compare with a test; never in a deload
 * or right after a break.
 */
export function liftFromTest(
  result: ItemResult,
  input: Pick<ItemInput, 'base' | 'exercise' | 'exposures' | 'role'> & {
    context: 'straight' | 'group';
    tests: readonly MaxTest[];
  },
): ItemResult {
  const { base, exercise } = input;
  const target = base.target;
  if (input.role === 'deload' || input.context !== 'straight') return result;
  if (target.kind !== 'reps' && target.kind !== 'time') return result;
  if (exercise.loadType !== 'bodyweight' && exercise.loadType !== 'bodyweight-loadable')
    return result;
  if (FIXED_REP_EXERCISES.has(exercise.id)) return result;
  const item = result.item;
  if (item.load && item.load.kind !== 'bodyweight') return result;
  if (result.note?.newLoad || slower(item.tempo, base.tempo)) return result;
  if (
    result.note &&
    ['goal-eased', 'welcome-back', 'hold-pain', 'pain-lighter'].includes(result.note.code)
  )
    return result;
  const since = input.exposures[0]?.at ?? '';
  const test = input.tests
    .filter((t) => t.exerciseId === exercise.id && !t.stopped && t.at > since)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!test) return result;
  const [lo, hi] = spanOf(target, false);
  const current = item.goal ?? lo;
  let wanted: number;
  if (target.kind === 'reps' && test.result.kind === 'reps')
    wanted = Math.min(test.result.reps - (base.rir ?? 2) - 1, current + TEST_LIFT_REPS, hi);
  else if (target.kind === 'time' && test.result.kind === 'time')
    wanted = Math.min(
      Math.round((test.result.seconds * TEST_HOLD_SHARE) / 5) * 5,
      current + TEST_LIFT_SEC,
      hi,
    );
  else return result;
  if (wanted <= current) return result;
  const value = test.result.kind === 'reps' ? test.result.reps : test.result.seconds;
  return {
    ...result,
    item: { ...item, goal: wanted },
    note: note('from-test', { from: current, to: wanted, test: value, date: test.date }),
  };
}
