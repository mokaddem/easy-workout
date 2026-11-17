import type {
  Block,
  Load,
  PhaseKind,
  Programme,
  ProgressionNote,
  SessionItem,
  SessionLog,
  SetLog,
  Target,
} from '../../domain';
import { itemKey } from '../play';
import { phaseForWeek } from '../week';

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

/** Logs that are over, newest first: programme ones only, or every kind. */
const finishedLogs = (logs: readonly SessionLog[], anySource: boolean): SessionLog[] =>
  logs
    .filter((l) => l.status !== 'in-progress' && (anySource || l.source.kind === 'programme'))
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

/** Starts of finished programme sessions, oldest first, in epoch ms. */
export const sessionTimes = (logs: readonly SessionLog[]): number[] =>
  finishedProgrammeLogs(logs)
    .map((l) => Date.parse(l.startedAt))
    .reverse();

/**
 * Longest gap, in days, between programme sessions from `since` up to `now`: a break the
 * exercise hasn't been back from yet. An exercise left out of a few sessions is not on a break.
 */
export function longestGapDays(times: readonly number[], since: number, now: number): number {
  let previous = since;
  let longest = 0;
  for (const t of times) {
    if (t <= since || t > now) continue;
    longest = Math.max(longest, t - previous);
    previous = t;
  }
  return Math.max(longest, now - previous) / 86_400_000;
}
