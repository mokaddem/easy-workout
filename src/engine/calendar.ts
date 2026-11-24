import { WEEKDAYS, type SessionLog, type Weekday } from '../domain';

/** A day of the user's calendar, local time: `YYYY-MM-DD` and its weekday. */
export interface CalendarDay {
  date: string;
  weekday: Weekday;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Monday-first weekday of a local date. */
const weekdayOf = (d: Date): Weekday => WEEKDAYS[(d.getDay() + 6) % 7]!;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayOf = (d: Date): CalendarDay => ({ date: dateOf(d), weekday: weekdayOf(d) });

const programmeStarts = (logs: readonly SessionLog[]): string[] =>
  logs.filter((l) => l.source.kind === 'programme').map((l) => dateOf(new Date(l.startedAt)));

/**
 * The rotation laid on the calendar from today: the next session takes today when it is a
 * training day with no programme session started yet today, else the next training day; the
 * following sessions take the following training days. `count` days, the first one the next
 * session's. Empty without training days.
 */
export function projectRotation(options: {
  trainingDays: readonly Weekday[];
  now: Date;
  logs: readonly SessionLog[];
  count: number;
}): CalendarDay[] {
  const { trainingDays, now, logs, count } = options;
  if (trainingDays.length === 0 || count <= 0) return [];
  const today = dateOf(now);
  const startedToday = programmeStarts(logs).includes(today);
  const out: CalendarDay[] = [];
  for (let n = startedToday ? 1 : 0; out.length < count; n++) {
    const day = addDays(now, n);
    if (trainingDays.includes(weekdayOf(day))) out.push(dayOf(day));
  }
  return out;
}

/**
 * A training day went by without its session: the first training day after the latest of the
 * programme's start, the end of a pause and the last dismissal, with no programme session
 * started on or after it. Today never counts. "That day's session is still next": nothing is
 * skipped, the rotation just waits. Undefined while paused or with nothing missed.
 */
export function missedTrainingDay(options: {
  trainingDays: readonly Weekday[];
  now: Date;
  logs: readonly SessionLog[];
  /** When the programme started. */
  programmeStart: string;
  paused?: boolean;
  /** When the last pause ended. */
  pauseEnd?: string;
  dismissedAt?: string;
}): CalendarDay | undefined {
  const { trainingDays, now, logs } = options;
  if (options.paused || trainingDays.length === 0) return undefined;
  const since = [options.programmeStart, options.pauseEnd, options.dismissedAt]
    .filter((x): x is string => x !== undefined)
    .map((x) => dateOf(new Date(x)))
    .sort()
    .at(-1)!;
  const starts = programmeStarts(logs).sort();
  const today = dateOf(now);
  const [y, m, d] = since.split('-').map(Number) as [number, number, number];
  for (let day = new Date(y, m - 1, d + 1); dateOf(day) < today; day = addDays(day, 1)) {
    if (!trainingDays.includes(weekdayOf(day))) continue;
    const date = dateOf(day);
    if (!starts.some((s) => s >= date)) return dayOf(day);
  }
  return undefined;
}
