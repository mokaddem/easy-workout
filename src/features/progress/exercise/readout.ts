import type { TFunction } from 'i18next';
import type { Exercise, Language } from '@/domain';
import type { ExercisePoint } from '@/engine';
import { numberText } from '@/features/adapt/format';
import { dayDate } from '../charts/format';
import { columnValue } from '../charts/ladder';
import { feelOf } from './logic';

export interface Readout {
  title: string;
  /** The big number (numeral 36); absent for a stop. */
  big?: string;
  /** The words after it. */
  words: string;
  /** The line under it, with `<b>` around the values. */
  sub?: string;
  /** Stopped by pain: the words are drawn as a warning. */
  pain?: boolean;
}

export interface ReadoutInput {
  point: ExercisePoint;
  exercise?: Exercise;
  /** Latest session (no inspection): "Dernière séance". */
  latest: boolean;
  /** Rotation letter of a programme session. */
  letter?: string;
  source: ExercisePoint['source'];
}

const unitWord = (t: TFunction, unit: string) => t(`stats.readout.unit.${unit}`);

/** The headline and the sets of one session of an exercise, as the chart's readout says them. */
export function readoutOf(t: TFunction, lang: Language, input: ReadoutInput): Readout {
  const { point, exercise, latest, letter, source } = input;
  const day = dayDate(point.date, lang);
  const title = latest
    ? t('stats.readout.last', { day })
    : source === 'quick'
      ? t('stats.readout.quick', { day })
      : source === 'custom'
        ? t('stats.readout.own', { day })
        : letter
          ? t('stats.readout.session', { letter, day })
          : t('stats.readout.sessionPlain', { day });

  const best = point.best;
  const perSide = !!exercise?.unilateral || point.sets.some((s) => s.weakerSide !== undefined);
  let big: string | undefined;
  let words = '';
  if (!best) {
    words = point.stopped === 'pain' ? t('stats.readout.pain') : t('stats.readout.noEquipment');
    return { title, words, ...(point.stopped === 'pain' && { pain: true }) };
  }
  const value = columnValue(best)!;
  big = numberText(value, lang);
  const load = best.load;
  const kg =
    load && (load.kind === 'kg' || load.kind === 'added-kg') ? numberText(load.kg, lang) : '';
  switch (best.unit) {
    case 'reps': {
      words = t('stats.readout.reps', { count: best.value });
      if (load?.kind === 'kg') words += t('stats.readout.atKg', { kg });
      else if (load?.kind === 'added-kg') words += t('stats.readout.added', { kg });
      else if (load?.kind === 'band')
        words += t('stats.readout.band', {
          band: t(`labels.band.${load.level}`).toLocaleLowerCase(lang),
        });
      else if (exercise?.loadType === 'band-assisted') words += t('stats.readout.noBand');
      break;
    }
    case 'seconds':
      words = t(perSide ? 'stats.readout.secondsPerSide' : 'stats.readout.seconds');
      break;
    case 'minutes':
      words = t('stats.readout.minutes');
      if (best.speedKmh !== undefined)
        words += t('stats.readout.atSpeed', { speed: numberText(best.speedKmh, lang) });
      break;
    case 'rounds':
      big = String(best.value);
      words = t('stats.readout.rounds', { work: best.workSec ?? 0 });
      break;
  }
  if (point.partial) {
    return {
      title,
      big,
      words: t('stats.readout.painAfter', { count: best.value }),
      pain: true,
    };
  }

  const values = point.sets
    .filter((s) => s.value !== undefined)
    .map((s) => numberText(s.value!, lang));
  const feel = feelOf(point.sets);
  const parts: string[] = [];
  if (values.length > 0) {
    parts.push(
      t('stats.readout.sub', {
        count: values.length,
        values: values.join(', '),
        unit: unitWord(t, best.unit),
      }),
    );
  }
  if (feel)
    parts.push(t('stats.readout.feel', { feel: t(`play.feel.${feel}`).toLocaleLowerCase(lang) }));
  if (point.stopped === 'pain') parts.push(t('stats.readout.painStop'));
  if (point.role === 'deload') parts.push(t('stats.readout.deload'));
  return {
    title,
    big,
    words,
    ...(parts.length > 0 && { sub: parts.join(' ') }),
    ...(point.stopped === 'pain' && { pain: true }),
  };
}
