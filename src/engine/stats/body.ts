import type { CheckIn } from '../../domain';
import { DAY_MS } from './dates';

export type BodyField = 'weightKg' | 'waistCm' | 'sleepHours';

export interface BodyPoint {
  /** `YYYY-MM-DD`. */
  date: string;
  value: number;
}

export interface BodyTrend {
  field: BodyField;
  /** Check-ins with a value, oldest first. */
  points: BodyPoint[];
  /** Mean of all values, for sleep's average. */
  mean?: number;
  /** Change from the first two to the last two; only with 3+ check-ins over 4+ weeks. */
  delta?: { value: number; weeks: number };
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** One field of the check-ins as points, oldest first (a missing value leaves no point). */
export function bodyPoints(checkIns: readonly CheckIn[], field: BodyField): BodyPoint[] {
  return checkIns
    .filter((c) => c[field] !== undefined)
    .map((c) => ({ date: c.date, value: c[field] as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Trend of one field: its points, and a change when there is enough to say one (rounded to 0.5). */
export function bodyTrend(checkIns: readonly CheckIn[], field: BodyField): BodyTrend {
  const points = bodyPoints(checkIns, field);
  const out: BodyTrend = { field, points };
  if (points.length === 0) return out;
  out.mean = mean(points.map((p) => p.value));
  const spanDays = (dayMs(points.at(-1)!.date) - dayMs(points[0]!.date)) / DAY_MS;
  if (points.length >= 3 && spanDays >= 28) {
    const first = mean(points.slice(0, 2).map((p) => p.value));
    const last = mean(points.slice(-2).map((p) => p.value));
    out.delta = { value: round(last - first, 0.5), weeks: Math.round(spanDays / 7) };
  }
  return out;
}

/** Mean of the latest two values of a field (the one value when there is only one). */
export function meanOfLastTwo(checkIns: readonly CheckIn[], field: BodyField): number | undefined {
  const last = bodyPoints(checkIns, field).slice(-2);
  return last.length === 0 ? undefined : mean(last.map((p) => p.value));
}

/**
 * Offer to take the latest weight into the profile: the mean of the last two check-ins, rounded
 * to 0.5 kg, when it differs from the profile's by at least `thresholdKg`.
 */
export function bodyweightOffer(
  checkIns: readonly CheckIn[],
  profileKg: number | undefined,
  thresholdKg = 2,
): { kg: number; differenceKg: number } | undefined {
  // One weigh-in is noise: the offer waits for two.
  if (checkIns.filter((c) => c.weightKg !== undefined).length < 2) return undefined;
  const latest = meanOfLastTwo(checkIns, 'weightKg');
  if (latest === undefined || profileKg === undefined) return undefined;
  const kg = round(latest, 0.5);
  const differenceKg = round(kg - profileKg, 0.5);
  return Math.abs(kg - profileKg) >= thresholdKg ? { kg, differenceKg } : undefined;
}

/** The weekly check-in card waits a week after a check-in or a dismissal. */
export const CHECK_IN_EVERY_DAYS = 7;

/**
 * The weekly check-in card is due: it is switched on, nothing was noted or dismissed in the last
 * 7 days, and at least one session was done (not on day one of the app).
 */
export function checkInDue(
  checkIns: readonly CheckIn[],
  settings: { checkInPrompt: boolean; checkInDismissedAt?: string },
  logs: readonly { status: string }[],
  now: Date,
): boolean {
  if (!settings.checkInPrompt) return false;
  if (!logs.some((l) => l.status === 'completed')) return false;
  const since = now.getTime() - CHECK_IN_EVERY_DAYS * DAY_MS;
  if (settings.checkInDismissedAt && Date.parse(settings.checkInDismissedAt) > since) return false;
  const today = new Date(now.getTime());
  const recent = checkIns.some(
    (c) => dayMs(c.date) > since - DAY_MS && dayMs(c.date) <= today.getTime(),
  );
  return !recent;
}
