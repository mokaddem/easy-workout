import {
  isCooldownLog,
  type Block,
  type Exercise,
  type Load,
  type PhaseKind,
  type Programme,
  type ProgressionNote,
  type SessionItem,
  type SessionLog,
  type SetLog,
  type Target,
} from '../../domain';
import { itemKey } from '../play';
import { phaseForWeek } from '../week';
import { droppedIds, isTravelLog } from './stamps';

/** Same exercise, same rep or time range, same kind of block: one progression. */
export const progressKey = (exerciseId: string, target: Target, context: Context): string =>
  `${exerciseId}|${targetSignature(target)}|${context}`;

export type Context = 'straight' | 'group';

const targetSignature = (t: Target): string => {
  switch (t.kind) {
    case 'reps':
      return `r${t.min}-${t.max}`;
    case 'time':
      return `t${t.minSec}-${t.maxSec}`;
    case 'max':
      return 'm';
    case 'interval':
      return 'i';
    case 'cardio':
      return 'c';
  }
};

/**
 * Notes that say the exercise sits at what the equipment (or a spared joint) allows: holding there
 * isn't a stall.
 */
export const AT_MAX = new Set([
  'buy-next',
  'ladder-end',
  'ladder-end-limited',
  'tempo-slower',
  'dose-cap-hold',
]);

/** How much a week's sets say about where the user stands. */
export type WeekRole = 'build' | 'peak' | 'deload';

/** What a programme week is for, as far as progression cares. */
export const weekRole = (programme: Programme | undefined, week: number | undefined): WeekRole => {
  if (!programme || week === undefined) return 'build';
  const phase = phaseForWeek(programme, week);
  if (!phase) return 'build';
  const kind: PhaseKind | undefined =
    phase.kind ??
    (phase.adjustments.some((a) => a.kind === 'volume' && a.factor < 1)
      ? 'deload'
      : phase.adjustments.some((a) => a.kind === 'rir' && a.scope === 'last-set')
        ? 'peak'
        : undefined);
  return kind === 'deload' ? 'deload' : kind === 'peak' ? 'peak' : 'build';
};

/** One set as evidence: reps (or seconds, or rounds) with what the feel adds to them. */
export interface EvidenceSet {
  set: number;
  /** Reps, seconds held, or interval rounds, per side the worse one. */
  value: number;
  /** Planned goal of the set, when the log has one. */
  goal?: number;
  rir?: number;
  /** Reps the feel adds to the planned reserve: easy +2, right 0, hard −1. */
  feel: number;
  easy: boolean;
  hard: boolean;
  /** The user changed the values or picked the feel. */
  touched: boolean;
  /** The load actually used. */
  load?: Load;
}

/** One time an exercise was done in a programme session. */
export interface Exposure {
  logId: string;
  at: string;
  role: WeekRole;
  exerciseId: string;
  key: string;
  itemKey: string;
  /** As prescribed that day. */
  item: SessionItem;
  context: Context;
  evidence: EvidenceSet[];
  /** Sets stopped by pain (or a pain stop on any side). */
  pain: boolean;
  noEquipment: boolean;
  /** Any evidence set touched. */
  touched: boolean;
  note?: ProgressionNote;
}

const FEEL_REPS = { easy: 2, right: 0, hard: -1 } as const;

const valueOf = (set: SetLog): number | undefined => {
  const t = set.planned.target;
  if (!set.actual) return undefined;
  if (t.kind === 'reps' || t.kind === 'max') return set.actual.reps;
  if (t.kind === 'time') return set.actual.durationSec;
  if (t.kind === 'interval') return set.actual.rounds;
  return undefined;
};

const itemsOf = (block: Block) => (block.type === 'straight' ? [block.item] : block.items);

/**
 * Logs that are over, newest first: programme ones only, or every kind. A session run with a
 * travel kit reads like a quick one: its stops count, its sets are no evidence.
 */
const finishedLogs = (logs: readonly SessionLog[], anySource: boolean): SessionLog[] =>
  logs
    .filter(
      (l) =>
        l.status !== 'in-progress' &&
        !isCooldownLog(l) &&
        (anySource || (l.source.kind === 'programme' && !isTravelLog(l))),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

/** Programme logs that are over, newest first. */
export const finishedProgrammeLogs = (logs: readonly SessionLog[]): SessionLog[] =>
  finishedLogs(logs, false);

/**
 * Every exposure of an exercise in finished programme sessions, newest first. When the same key
 * appears twice in one session, the heavier one counts. With `anySource`, sessions of the user's
 * own and quick sessions count too: pain and no-equipment stops are read from every session,
 * progression evidence only from programme ones.
 */
export function exposuresOf(
  exerciseId: string,
  logs: readonly SessionLog[],
  programmes: readonly Programme[],
  options: { anySource?: boolean } = {},
): Exposure[] {
  const byId = new Map(programmes.map((p) => [p.id, p]));
  const out: Exposure[] = [];
  for (const log of finishedLogs(logs, options.anySource ?? false)) {
    const source = log.source.kind === 'programme' ? log.source : undefined;
    const role = weekRole(source && byId.get(source.programmeId), source?.week);
    const seen = new Map<string, Exposure>();
    for (const section of ['main', 'finisher'] as const)
      log.plan[section].forEach((block, blockIndex) =>
        itemsOf(block).forEach((item, itemIndex) => {
          if (item.exerciseId !== exerciseId) return;
          const context: Context = block.type === 'straight' ? 'straight' : 'group';
          const key = progressKey(exerciseId, item.target, context);
          const ik = itemKey(section, blockIndex, itemIndex);
          const sets = log.sets.filter(
            (s) =>
              s.section === section && s.blockIndex === blockIndex && s.itemIndex === itemIndex,
          );
          if (sets.length === 0) return;
          const exposure = toExposure(log, role, section, item, ik, key, context, sets);
          const previous = seen.get(key);
          if (!previous || heavier(exposure.item.load, previous.item.load)) seen.set(key, exposure);
        }),
      );
    out.push(...seen.values());
  }
  return out;
}

const heavier = (a: Load | undefined, b: Load | undefined) =>
  a !== undefined && 'kg' in a && (b === undefined || !('kg' in b) || a.kg > b.kg);

function toExposure(
  log: SessionLog,
  role: WeekRole,
  section: 'main' | 'finisher',
  item: SessionItem,
  ik: string,
  key: string,
  context: Context,
  sets: SetLog[],
): Exposure {
  const bySet = new Map<number, SetLog[]>();
  for (const s of sets) bySet.set(s.set, [...(bySet.get(s.set) ?? []), s]);
  // A week's first-set reserve only changes main sets.
  const firstSetOnly =
    section === 'main' &&
    log.adjustments?.firstSetRir !== undefined &&
    (item.target.kind === 'reps' || item.target.kind === 'max');

  const evidence: EvidenceSet[] = [];
  for (const [set, sides] of [...bySet.entries()].sort((a, b) => a[0] - b[0])) {
    if (sides.some((s) => s.flag)) continue;
    const values = sides.map(valueOf);
    if (values.some((v) => v === undefined)) continue;
    const worst = sides[values.indexOf(Math.min(...(values as number[])))]!;
    const feel = worst.feel ? FEEL_REPS[worst.feel] : 0;
    evidence.push({
      set,
      value: Math.min(...(values as number[])),
      ...(worst.planned.goal !== undefined && { goal: worst.planned.goal }),
      ...(worst.planned.rir !== undefined && { rir: worst.planned.rir }),
      feel,
      easy: sides.every((s) => s.feel === 'easy' && s.feelChosen === true),
      hard: sides.some((s) => s.feel === 'hard' && s.feelChosen === true),
      touched: sides.some((s) => s.edited === true || s.feelChosen === true),
      ...(worst.actual?.load && { load: worst.actual.load }),
    });
  }
  const kept = firstSetOnly ? evidence.filter((e) => e.set === 1) : evidence;
  const note = log.progression?.[ik];
  return {
    logId: log.id,
    at: log.startedAt,
    role,
    exerciseId: item.exerciseId,
    key,
    itemKey: ik,
    item,
    context,
    evidence: kept,
    pain: sets.some((s) => s.flag === 'pain'),
    noEquipment: sets.some((s) => s.flag === 'no-equipment'),
    touched: kept.some((e) => e.touched),
    ...(note && { note }),
  };
}

const DAY_MS = 86_400_000;

const isCardioTarget = (t: Target) => t.kind === 'cardio' || t.kind === 'interval';

const workingCache = new WeakMap<SessionLog, string[]>();

/**
 * The exercises of a session's working sets, one entry per set done: main and finisher parts,
 * no warm-up, no cardio, nothing stopped or skipped.
 */
export function workingSetExercises(log: SessionLog): string[] {
  let cached = workingCache.get(log);
  if (cached) return cached;
  const seen = new Set<string>();
  cached = [];
  if (isCooldownLog(log)) {
    workingCache.set(log, cached);
    return cached;
  }
  for (const s of log.sets) {
    if (s.section === 'warmup' || s.flag || !s.actual || isCardioTarget(s.planned.target)) continue;
    const key = `${s.section}/${s.blockIndex}/${s.itemIndex}/${s.set}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cached.push(s.exerciseId);
  }
  workingCache.set(log, cached);
  return cached;
}

/** Working sets that make a session of any kind count as training for the programme as a whole. */
export const PROGRAMME_SESSION_SETS = 6;
/** Working sets on an exercise's primary muscles that make a quick or custom session count for it. */
export const MUSCLE_SESSION_SETS = 3;

/**
 * Starts of the sessions that kept the programme going, oldest first, in epoch ms: completed
 * programme sessions, and any other session (an abandoned one too) with enough working sets.
 */
export function programmeTimes(logs: readonly SessionLog[]): number[] {
  return logs
    .filter(
      (l) =>
        l.status !== 'in-progress' &&
        ((l.status === 'completed' && l.source.kind === 'programme') ||
          workingSetExercises(l).length >= PROGRAMME_SESSION_SETS),
    )
    .map((l) => Date.parse(l.startedAt))
    .sort((a, b) => a - b);
}

/**
 * Starts of the sessions that kept one exercise's muscles going, oldest first: programme and
 * travel sessions (one that left the exercise out doesn't count), plus quick and custom ones
 * with enough working sets on its primary muscles.
 */
export function exerciseTimes(
  exercise: Exercise,
  logs: readonly SessionLog[],
  exercises: ReadonlyMap<string, Exercise>,
): number[] {
  const muscles = new Set(exercise.primaryMuscles);
  return logs
    .filter((l) => {
      if (l.status === 'in-progress' || isCooldownLog(l)) return false;
      if (l.source.kind === 'programme' || isTravelLog(l)) return !droppedIds(l).has(exercise.id);
      let n = 0;
      for (const id of workingSetExercises(l))
        if (exercises.get(id)?.primaryMuscles.some((m) => muscles.has(m))) n++;
      return n >= MUSCLE_SESSION_SETS;
    })
    .map((l) => Date.parse(l.startedAt))
    .sort((a, b) => a - b);
}

/**
 * Longest gap, in days, between sessions from `since` up to `now`: a break the exercise hasn't
 * been back from yet. An exercise left out of a few sessions is not on a break. Days paused
 * are part of the gap.
 */
export function longestGapDays(times: readonly number[], since: number, now: number): number {
  let previous = since;
  let longest = 0;
  for (const t of times) {
    if (t <= since || t > now) continue;
    longest = Math.max(longest, t - previous);
    previous = t;
  }
  return Math.max(longest, now - previous) / DAY_MS;
}

/**
 * When the last gap longer than `days` ended, in epoch ms: the session that came back, or `now`
 * when the gap is still open (the session being prepared ends it).
 */
export function lastGapEnd(times: readonly number[], now: number, days = 28): number | undefined {
  const sorted = times.filter((t) => t <= now);
  let end: number | undefined;
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i]! - sorted[i - 1]! > days * DAY_MS) end = sorted[i]!;
  const last = sorted[sorted.length - 1];
  if (last !== undefined && now - last > days * DAY_MS) end = now;
  return end;
}

/** Days since the last session that kept the programme going; undefined with none. */
export function daysSinceTraining(logs: readonly SessionLog[], now: Date): number | undefined {
  const last = programmeTimes(logs).at(-1);
  return last === undefined ? undefined : (now.getTime() - last) / DAY_MS;
}
