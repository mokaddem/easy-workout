import type { Language } from '@/domain';
import { capFirst } from '../adapt/format';

const NBSP = ' ';

export const langOf = (language: string): Language => (language === 'fr' ? 'fr' : 'en');

/** A `YYYY-MM-DD` date as a local midnight. */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** "9–15 nov." */
export function weekRangeText(startDate: string, endDate: string, lang: Language): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).formatRange(
    parseDate(startDate),
    parseDate(endDate),
  );
}

/** Keeps a date together on one line ("15 nov." never leaves "nov." alone). */
const together = (text: string): string => text.replace(/ /g, NBSP);

/** "12 nov." */
export const shortDate = (date: Date | string, lang: Language): string =>
  together(
    new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(
      typeof date === 'string' ? new Date(date) : date,
    ),
  );

/** "12 octobre" */
export const longDate = (date: Date | string, lang: Language): string =>
  together(
    new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(
      typeof date === 'string' ? new Date(date) : date,
    ),
  );

/** "Jeu. 12 nov." */
export const dayShort = (iso: string, lang: Language): string =>
  capFirst(
    together(
      new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(
        new Date(iso),
      ),
    ),
    lang,
  );

/** "Jeudi 12 novembre" */
export const dayLong = (iso: string, lang: Language): string =>
  capFirst(
    new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(iso),
    ),
    lang,
  );

/** "18:05" */
export const clockTime = (iso: string, lang: Language): string =>
  new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days from `then` to `now`. */
export const daysAgo = (then: Date, now: Date): number =>
  Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

/** "hier", "il y a 6 jours", "il y a 3 semaines": the day count up to two weeks, then weeks, then months. */
export function agoText(then: Date, now: Date, lang: Language): string {
  const days = Math.max(0, daysAgo(then, now));
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (days < 14) return rtf.format(-days, 'day');
  if (days < 60) return rtf.format(-Math.floor(days / 7), 'week');
  return rtf.format(-Math.floor(days / 30), 'month');
}

export interface ActiveParts {
  /** Whole hours, from 60 minutes up. */
  hours?: number;
  /** Minutes: the remainder after hours (two digits), or the whole count below an hour. */
  minutes: string;
}

/** Active time as numerals: 160 min → 2 h 40, 45 min → 45. */
export function activeParts(totalSec: number): ActiveParts {
  const minutes = Math.round(totalSec / 60);
  if (minutes < 60) return { minutes: String(minutes) };
  return { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, '0') };
}

/** "16 h 05" or "45 min", as a sentence part. */
export function timeText(totalSec: number): string {
  const { hours, minutes } = activeParts(totalSec);
  return hours === undefined ? `${minutes}${NBSP}min` : `${hours}${NBSP}h${NBSP}${minutes}`;
}

/** "a, b et c" */
export const listText = (items: readonly string[], lang: Language): string =>
  new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(items);
