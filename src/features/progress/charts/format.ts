import type { Language } from '@/domain';
import * as base from '../format';

/** Local calendar date from `YYYY-MM-DD` or an ISO instant. */
export const dateOf = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

/** "12 nov." */
export const shortDate = (value: string, lang: Language): string =>
  base.shortDate(dateOf(value), lang);

/** "jeu. 12 nov." (capitalised the way the history writes it) */
export const dayDate = (value: string, lang: Language): string =>
  base.dayShort(dateOf(value).toISOString(), lang);

/** "12 novembre" */
export const longDate = (value: string, lang: Language): string =>
  base.longDate(dateOf(value), lang);

const intl = (lang: Language) => (lang === 'en' ? 'en-GB' : lang);

/** "dimanche 8 novembre", first letter capitalised. */
export const fullDay = (value: string, lang: Language): string => {
  const text = new Intl.DateTimeFormat(intl(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dateOf(value));
  return text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
};

export const nbsp = ' ';
