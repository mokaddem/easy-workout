import { WEEKDAYS, type Language, type Weekday } from '@/domain';

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of a local date. */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A local date from `YYYY-MM-DD` (not UTC, so the day never shifts). */
export function localDay(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** "dim. 30 nov." */
export const shortDate = (d: Date, lang: Language): string =>
  new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

/** "3 octobre" */
export const longDate = (d: Date, lang: Language): string =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(d);

/** A weekday's name, from the browser's own calendar (Monday-first ids). */
export function weekdayName(
  weekday: Weekday,
  lang: Language,
  style: 'long' | 'short' = 'long',
): string {
  // 1 January 2024 was a Monday.
  const day = new Date(2024, 0, 1 + WEEKDAYS.indexOf(weekday));
  return new Intl.DateTimeFormat(lang, { weekday: style }).format(day);
}

/** "64 %" in French (narrow no-break space), "64%" in English. */
export const percentText = (share: number, lang: Language): string => {
  const n = Math.round(Math.max(0, Math.min(1, share)) * 100);
  return lang === 'fr' ? `${n}\u202f%` : `${n}%`;
};
