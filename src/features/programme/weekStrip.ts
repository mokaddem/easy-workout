import { WEEKDAYS, type SessionLog, type Weekday } from '@/domain';
import { projectRotation, type CalendarDay } from '@/engine';

export interface StripCell {
  date: string;
  weekday: Weekday;
  /** Day of the month. */
  day: number;
  /** A local noon of that day, for formatting names. */
  at: Date;
  today: boolean;
  /** A session is planned (or was started today): its place in the rotation. */
  session?: { index: number; kind: 'next' | 'later' | 'done' };
}

const parse = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
};
const pad = (n: number) => String(n).padStart(2, '0');
const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The rotation laid on the calendar: the day of each rotation index, from the next session on. */
export function sessionDays(options: {
  trainingDays: readonly Weekday[];
  now: Date;
  logs: readonly SessionLog[];
  /** Rotation index of the next session. */
  next: number;
  size: number;
}): (CalendarDay | undefined)[] {
  const { next, size } = options;
  const days = projectRotation({ ...options, count: size });
  const out: (CalendarDay | undefined)[] = Array.from({ length: size }, () => undefined);
  days.forEach((day, k) => {
    out[(next + k) % size] = day;
  });
  return out;
}

/**
 * The next 7 days, today first: each planned session on its day, today marked. A programme
 * session started today shows as done on today's cell.
 */
export function weekStrip(options: {
  trainingDays: readonly Weekday[];
  now: Date;
  logs: readonly SessionLog[];
  next: number;
  size: number;
}): StripCell[] {
  const { now, logs, next, size } = options;
  const todayKey = dateOf(now);
  const planned = projectRotation({ ...options, count: 7 });
  const startedToday = logs.some(
    (l) => l.source.kind === 'programme' && dateOf(new Date(l.startedAt)) === todayKey,
  );
  return Array.from({ length: 7 }, (_, n): StripCell => {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, 12);
    const date = dateOf(at);
    const k = planned.findIndex((p) => p.date === date);
    const base = {
      date,
      weekday: planned[k]?.weekday ?? weekdayOf(at),
      day: at.getDate(),
      at,
      today: n === 0,
    };
    if (n === 0 && startedToday) return { ...base, session: { index: -1, kind: 'done' } };
    if (k < 0 || size === 0) return base;
    return { ...base, session: { index: (next + k) % size, kind: k === 0 ? 'next' : 'later' } };
  });
}

const weekdayOf = (d: Date): Weekday => WEEKDAYS[(d.getDay() + 6) % 7]!;

/** The date of a calendar day as a local date, for names. */
export const calendarDate = (day: CalendarDay): Date => parse(day.date);
