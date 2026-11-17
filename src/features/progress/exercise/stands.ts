import type { TFunction } from 'i18next';
import type { Language } from '@/domain';
import type { BestSet } from '@/engine';
import { numberText } from '@/features/adapt/format';

export interface Stands {
  /** A band level in words, above the reps. */
  word?: string;
  value: string;
  unit: string;
}

/** Where an exercise stands now, short: "17,5 kg", "21 reps", "30 s", a band over its reps. */
export function standsOf(t: TFunction, lang: Language, best: BestSet): Stands {
  const load = best.load;
  if (load?.kind === 'band')
    return {
      word: t(`labels.band.${load.level}`),
      value: numberText(best.value, lang),
      unit: t('stats.unit.reps', { count: best.value }),
    };
  if (load?.kind === 'kg') return { value: numberText(load.kg, lang), unit: t('labels.unit.kg') };
  if (load?.kind === 'added-kg')
    return { value: `+${numberText(load.kg, lang)}`, unit: t('labels.unit.kg') };
  const unit =
    best.unit === 'seconds'
      ? t('labels.unit.s')
      : best.unit === 'minutes'
        ? t('labels.unit.min')
        : best.unit === 'rounds'
          ? t('stats.unit.rounds', { count: best.value })
          : t('stats.unit.reps', { count: best.value });
  return { value: numberText(best.value, lang), unit };
}
