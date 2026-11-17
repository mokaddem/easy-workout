import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import type { Language, Load, ProgressionNote } from '@/domain';
import type { BestSet, Highlight } from '@/engine';
import type { IconName } from '@/ui/components';
import { bandWord, loadText, parseToken, repsText, secondsText, tokenOf } from '../adapt/format';
import { shortDate } from './format';

export interface HighlightRow {
  exerciseId: string;
  icon: Extract<IconName, 'arrow-up' | 'medal' | 'target'>;
  /** The sentence, with `<b>` around the figure. */
  line: string;
}

const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

const usesDumbbell = (exerciseId: string): boolean =>
  !!exerciseById
    .get(exerciseId)
    ?.equipment.some((set) => set.some((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell'));

/** "17,5 kg", "12 reps", "30 s": a best set's figure. */
export function bestText(t: TFunction, lang: Language, best: BestSet): string {
  switch (best.unit) {
    case 'seconds':
      return secondsText(best.value, lang);
    case 'minutes':
      return t('progress.log.minutes', { count: best.value });
    case 'rounds':
      return t('progress.log.rounds', { count: best.value });
    case 'reps': {
      const reps = repsText(t, best.value);
      const load = best.load && loadFigure(t, lang, best.load);
      return load ? `${reps}, ${load}` : reps;
    }
  }
}

/** A load as text: "17,5 kg", "+5 kg", the band's name; nothing for bodyweight. */
export function loadFigure(t: TFunction, lang: Language, load: Load): string | undefined {
  if (load.kind === 'bodyweight') return undefined;
  return loadText(t, lang, tokenOf(load));
}

function noteLine(
  t: TFunction,
  lang: Language,
  exerciseId: string,
  note: ProgressionNote,
  date: string,
): string {
  const p = note.params;
  const to = typeof p.to === 'string' ? p.to : typeof p.load === 'string' ? p.load : undefined;
  const parsed = parseToken(to);
  const exercise = exerciseById.get(exerciseId);
  const time = exercise?.metric === 'time';
  const amount = (n: number) => (time ? secondsText(n, lang) : repsText(t, n));
  switch (note.code) {
    case 'load-up':
    case 'load-up-low':
      if (parsed?.kind === 'band')
        return t('progress.highlights.loadUp', {
          load: loadText(t, lang, to),
          perDumbbell: '',
          date,
        });
      return t('progress.highlights.loadUp', {
        load: loadText(t, lang, to),
        perDumbbell: usesDumbbell(exerciseId) ? t('progress.highlights.perDumbbell') : '',
        date,
      });
    case 'added-load-start':
      return t('progress.highlights.addedLoad', { load: loadText(t, lang, to), date });
    case 'band-lighter':
      return t('progress.highlights.lessHelp', {
        band: parsed?.kind === 'band' ? bandWord(t, lang, parsed.level) : '',
        date,
      });
    case 'band-heavier':
      return t('progress.highlights.loadUp', {
        load: loadText(t, lang, to),
        perDumbbell: '',
        date,
      });
    case 'reps-up':
    case 'from-test': {
      const goal = num(p.to);
      return goal === undefined
        ? t('progress.highlights.generic', { date })
        : t('progress.highlights.repsUp', { goal: amount(goal), date });
    }
    case 'beyond-range': {
      const goal = num(p.goal);
      return goal === undefined
        ? t('progress.highlights.generic', { date })
        : t('progress.highlights.beyond', { goal: amount(goal), date });
    }
    case 'work-longer': {
      const value = num(p.to);
      return value === undefined
        ? t('progress.highlights.generic', { date })
        : t('progress.highlights.workLonger', { value: secondsText(value, lang), date });
    }
    default:
      return t('progress.highlights.generic', { date });
  }
}

/** The row a highlight makes on the home screen. */
export function highlightRow(t: TFunction, lang: Language, h: Highlight): HighlightRow {
  const date = shortDate(h.at, lang);
  if (h.kind === 'note')
    return {
      exerciseId: h.exerciseId,
      icon: 'arrow-up',
      line: noteLine(t, lang, h.exerciseId, h.note, date),
    };
  if (h.kind === 'best')
    return {
      exerciseId: h.exerciseId,
      icon: 'arrow-up',
      line: h.point.best
        ? t('progress.highlights.best', { value: bestText(t, lang, h.point.best), date })
        : t('progress.highlights.generic', { date }),
    };
  const value =
    h.test.result.kind === 'reps'
      ? repsText(t, h.test.result.reps)
      : secondsText(h.test.result.seconds, lang);
  return {
    exerciseId: h.exerciseId,
    icon: 'target',
    line: t('progress.highlights.test', { value, date }),
  };
}
