import type { Language, Load, SessionLog, Target } from '../domain';

const COLUMNS = [
  'date',
  'session',
  'status',
  'source',
  'week',
  'section',
  'exercise_id',
  'exercise',
  'set',
  'side',
  'target',
  'planned_load',
  'planned_rir',
  'reps',
  'duration_sec',
  'rounds',
  'speed_kmh',
  'incline_pct',
  'load',
  'feel',
  'flag',
  'edited',
] as const;

export function targetText(target: Target): string {
  switch (target.kind) {
    case 'reps':
      return target.min === target.max ? `${target.min}` : `${target.min}-${target.max}`;
    case 'max':
      return 'max';
    case 'time':
      return target.minSec === target.maxSec
        ? `${target.maxSec}s`
        : `${target.minSec}-${target.maxSec}s`;
    case 'cardio':
      return target.minMinutes === target.maxMinutes
        ? `${target.maxMinutes}min`
        : `${target.minMinutes}-${target.maxMinutes}min`;
    case 'interval':
      return `${target.rounds}x${target.workSec}/${target.recoverySec}s`;
  }
}

export function loadText(load: Load | undefined): string {
  if (!load) return '';
  switch (load.kind) {
    case 'kg':
      return `${load.kg} kg`;
    case 'added-kg':
      return `+${load.kg} kg`;
    case 'band':
      return `band ${load.level}`;
    case 'bodyweight':
      return 'bodyweight';
  }
}

/** Byte-order mark: tells spreadsheet apps the file is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

const cell = (value: string | number | boolean | undefined): string => {
  if (value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Every logged set, one row each, for a spreadsheet. Export only: a backup is the JSON file.
 * Starts with a byte-order mark so spreadsheet apps read it as UTF-8.
 */
export function setsCsv(
  logs: readonly SessionLog[],
  lang: Language,
  exerciseName: (id: string) => string | undefined,
): string {
  const rows = [COLUMNS.join(',')];
  for (const log of [...logs].sort((a, b) => a.startedAt.localeCompare(b.startedAt)))
    for (const set of log.sets) {
      const values: Record<(typeof COLUMNS)[number], string | number | boolean | undefined> = {
        date: set.at,
        session: log.plan.name[lang],
        status: log.status,
        source: log.source.kind,
        week: log.source.kind === 'programme' ? log.source.week : undefined,
        section: set.section,
        exercise_id: set.exerciseId,
        exercise: exerciseName(set.exerciseId) ?? set.exerciseId,
        set: set.set,
        side: set.side,
        target: targetText(set.planned.target),
        planned_load: loadText(set.planned.load),
        planned_rir: set.planned.rir,
        reps: set.actual?.reps,
        duration_sec: set.actual?.durationSec,
        rounds: set.actual?.rounds,
        speed_kmh: set.actual?.speedKmh,
        incline_pct: set.actual?.inclinePct,
        load: loadText(set.actual?.load),
        feel: set.feel,
        flag: set.flag,
        edited: set.edited,
      };
      rows.push(COLUMNS.map((column) => cell(values[column])).join(','));
    }
  return `${BOM}${rows.join('\r\n')}\r\n`;
}

/** File name for the sets export made at `now`. */
export const setsCsvFileName = (now = new Date()): string =>
  `easy-workout-sets-${now.toISOString().slice(0, 10)}.csv`;
