import type { TFunction } from 'i18next';
import type { Exercise, Language, SessionItem } from '@/domain';
import { effortText } from '../programme/effort';

export const range = (min: number, max: number): string =>
  min === max ? `${min}` : `${min}–${max}`;

export const isCardioTarget = (item: SessionItem): boolean =>
  item.target.kind === 'cardio' || item.target.kind === 'interval';

export const repBased = (item: SessionItem): boolean =>
  item.target.kind === 'reps' || item.target.kind === 'max';

/** Effort targets don't apply to jumps, nor to timed work. */
export const usesEffort = (item: SessionItem, exercise: Exercise | undefined): boolean =>
  repBased(item) &&
  !(exercise?.tags.includes('plyometric') || exercise?.tags.includes('ballistic'));

/** The big figure of a straight block: "4×6–10", "3×30–45" + `s`, "15–20" + `min`. */
export function doseNumber(item: SessionItem, sets: number): { value: string; unit?: 's' | 'min' } {
  const t = item.target;
  switch (t.kind) {
    case 'reps':
      return { value: `${sets}×${range(t.min, t.max)}` };
    case 'max':
      return { value: `${sets}×max` };
    case 'time':
      return {
        value: `${sets > 1 ? `${sets}×` : ''}${range(t.minSec, t.maxSec)}`,
        unit: 's',
      };
    case 'cardio':
      return { value: range(t.minMinutes, t.maxMinutes), unit: 'min' };
    case 'interval':
      return { value: `${t.rounds}×${t.workSec}`, unit: 's' };
  }
}

/** The figure of an exercise inside a group: "10–12", "30–45" + `s`. */
export function itemNumber(item: SessionItem): { value: string; unit?: 's' | 'min' } {
  const t = item.target;
  switch (t.kind) {
    case 'reps':
      return { value: range(t.min, t.max) };
    case 'max':
      return { value: 'max' };
    case 'time':
      return { value: range(t.minSec, t.maxSec), unit: 's' };
    default:
      return doseNumber(item, 1);
  }
}

export function groupItemWord(t: TFunction, item: SessionItem, exercise?: Exercise): string {
  const target = item.target.kind;
  if (target === 'time') return t('editor.dose.groupItemTime');
  if (target === 'cardio' || target === 'interval') return '';
  if (!usesEffort(item, exercise) || item.rir === undefined) return t('editor.dose.groupItemReps');
  return item.rir === 0
    ? t('editor.dose.groupItemFailure')
    : t('editor.dose.groupItemRir', { count: item.rir });
}

/** "2 reps in the tank, rest 90 s, per side": the small print under a straight block's figure. */
export function doseFacts(
  t: TFunction,
  item: SessionItem,
  restSec: number | undefined,
  exercise: Exercise | undefined,
  lang: Language,
): string {
  const parts: string[] = [];
  const effort =
    usesEffort(item, exercise) && item.rir !== undefined ? effortText(t, item.rir) : undefined;
  if (restSec !== undefined && restSec > 0 && !isCardioTarget(item))
    parts.push(
      effort
        ? t('editor.dose.restSet', { effort, sec: restSec })
        : t('editor.dose.restOnly', { sec: restSec }),
    );
  else if (effort) parts.push(effort);
  const target = item.target;
  if (item.perSide) parts.push(t('editor.dose.perSide'));
  if (target.kind === 'cardio') {
    const fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
    if (target.speedKmh !== undefined)
      parts.push(t('editor.dose.speed', { value: fmt.format(target.speedKmh) }));
    if (target.inclinePct !== undefined)
      parts.push(t('editor.dose.incline', { value: fmt.format(target.inclinePct) }));
  }
  if (target.kind === 'interval')
    parts.push(
      t('editor.dose.interval', {
        rounds: target.rounds,
        work: target.workSec,
        recovery: target.recoverySec,
      }),
    );
  return parts.join(', ');
}

/** One line with the whole dose, for menu hints: "3 × 10–12, 2 reps in the tank, rest 75 s". */
export function doseLine(
  t: TFunction,
  item: SessionItem,
  sets: number,
  restSec: number | undefined,
  exercise: Exercise | undefined,
  lang: Language,
): string {
  const { value, unit } = doseNumber(item, sets);
  const head = `${value.replace('×', ' × ')}${unit ? ` ${unit}` : ''}`;
  const facts = doseFacts(t, item, restSec, exercise, lang);
  return facts ? `${head}, ${facts.charAt(0).toLocaleLowerCase(lang)}${facts.slice(1)}` : head;
}

export const nameOf = (
  exercises: ReadonlyMap<string, Exercise>,
  id: string,
  lang: Language,
): string => exercises.get(id)?.name[lang] ?? id;
