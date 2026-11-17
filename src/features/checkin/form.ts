import type { CheckIn } from '@/domain';

export const WEIGHT_RANGE = { min: 30, max: 250 } as const;
export const WAIST_RANGE = { min: 40, max: 250 } as const;
export const SLEEP_RANGE = { min: 0, max: 14, step: 0.5 } as const;
export const SLEEP_DEFAULT = 7;

/** "79,7" or "79.7" → 79.7; empty or not a number → undefined. */
export function parseDecimal(raw: string): number | undefined {
  const text = raw.trim().replace(',', '.');
  if (text === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** Empty is fine; anything typed has to be a number inside the range. */
export function fieldError(raw: string, range: { min: number; max: number }): boolean {
  if (raw.trim() === '') return false;
  const n = parseDecimal(raw);
  return n === undefined || n < range.min || n > range.max;
}

export interface CheckInFields {
  weight: string;
  waist: string;
  sleep: number | null;
  notes: string;
}

const text = (n: number | undefined, lang: string): string =>
  n === undefined ? '' : new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(n);

export function fieldsOf(record: CheckIn | undefined, lang: string): CheckInFields {
  return {
    weight: text(record?.weightKg, lang),
    waist: text(record?.waistCm, lang),
    sleep: record?.sleepHours ?? null,
    notes: record?.notes ?? '',
  };
}

export const isEmpty = (f: CheckInFields): boolean =>
  f.weight.trim() === '' && f.waist.trim() === '' && f.sleep === null && f.notes.trim() === '';

/** What would be stored; undefined while a number field is invalid. */
export function toRecord(f: CheckInFields, date: string): Omit<CheckIn, 'id'> | undefined {
  if (fieldError(f.weight, WEIGHT_RANGE) || fieldError(f.waist, WAIST_RANGE)) return undefined;
  const weightKg = parseDecimal(f.weight);
  const waistCm = parseDecimal(f.waist);
  const notes = f.notes.trim();
  return {
    date,
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(waistCm !== undefined ? { waistCm } : {}),
    ...(f.sleep !== null ? { sleepHours: f.sleep } : {}),
    ...(notes !== '' ? { notes } : {}),
  };
}

export const sameFields = (a: CheckInFields, b: CheckInFields): boolean =>
  a.weight.trim() === b.weight.trim() &&
  a.waist.trim() === b.waist.trim() &&
  a.sleep === b.sleep &&
  a.notes.trim() === b.notes.trim();
