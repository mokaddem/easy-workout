import { WEEKDAYS, type SessionLog, type Weekday } from '@/domain';
import { projectRotation, type CalendarDay } from '@/engine';

/** Days as a sorted, duplicate-free list, Monday first. */
export const sortDays = (days: Iterable<Weekday>): Weekday[] => {
  const set = new Set(days);
  return WEEKDAYS.filter((d) => set.has(d));
};

/** Ticking one more day is allowed while fewer than `limit` are ticked. */
export const canTick = (days: readonly Weekday[], limit: number): boolean => days.length < limit;

export type DaysStatus =
  { kind: 'none' } | { kind: 'left'; count: number } | { kind: 'full'; count: number };

/** What the status line says: how many days are still to pick, or that the week is full. */
export function daysStatus(days: readonly Weekday[], limit: number): DaysStatus {
  if (days.length === 0) return { kind: 'none' };
  return days.length >= limit
    ? { kind: 'full', count: days.length }
    : { kind: 'left', count: limit - days.length };
}

/** Saving needs all the days of the week, or none (no set days). */
export const missingDays = (days: readonly Weekday[], limit: number): number =>
  days.length === 0 ? 0 : Math.max(0, limit - days.length);

export const sameDays = (a: readonly Weekday[], b: readonly Weekday[]): boolean =>
  sortDays(a).join() === sortDays(b).join();

/**
 * The rotation laid on the coming week for the days in the draft: the rotation index of the
 * session that would fall on each ticked weekday, and the first of them (the next session's day).
 * Incomplete drafts are previewed too, one session per ticked day.
 */
export function previewDays(options: {
  days: readonly Weekday[];
  now: Date;
  logs: readonly SessionLog[];
  /** Rotation index of the next session, and the rotation's length. */
  nextIndex: number;
  size: number;
}): { byDay: Map<Weekday, number>; first?: { day: CalendarDay; index: number } } {
  const { days, now, logs, nextIndex, size } = options;
  const projected = projectRotation({ trainingDays: days, now, logs, count: days.length });
  const byDay = new Map<Weekday, number>();
  projected.forEach((day, i) => byDay.set(day.weekday, (nextIndex + i) % size));
  const day = projected[0];
  return { byDay, ...(day && { first: { day, index: nextIndex % size } }) };
}
