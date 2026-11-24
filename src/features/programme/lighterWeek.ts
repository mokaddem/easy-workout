import type { TFunction } from 'i18next';
import type { Language, Phase } from '@/domain';
import type { LighterWeekReason, LighterWeekSignal } from '@/engine';

/** One reason as a plain sentence, from the counts the engine read. */
export function reasonText(t: TFunction, reason: LighterWeekReason): string {
  switch (reason.code) {
    case 'hard-sets':
      return t('programme.lighter.hardSets', reason.params);
    case 'stalled-lifts':
      return t('programme.lighter.stalledLifts', reason.params);
    case 'pain-stops':
      return t('programme.lighter.painStops', reason.params);
  }
}

/** What the change does to the weeks: which ones move back, and where the cycle now ends. */
export function lighterWeekPlan(
  signal: Pick<LighterWeekSignal, 'startWeek'>,
  weeks: number,
): { week: number; from: number; to: number; oldEnd: number; newEnd: number } {
  return {
    week: signal.startWeek,
    from: signal.startWeek,
    to: weeks,
    oldEnd: weeks,
    newEnd: weeks + 1,
  };
}

/**
 * A phase's name for the overview. The part of a phase that resumes after an inserted lighter
 * week says so ("Volume (cont.)"), so the split doesn't read as two separate phases.
 */
export function phaseLabel(
  t: TFunction,
  lang: Language,
  phases: readonly Phase[],
  index: number,
): string {
  const phase = phases[index]!;
  const name = phase.name[lang];
  const resumes =
    phases[index - 1]?.origin === 'early' && phases[index - 2]?.name.en === phase.name.en;
  return resumes ? t('programme.rotation.continued', { name }) : name;
}
