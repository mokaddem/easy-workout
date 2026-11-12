import type { TFunction } from 'i18next';

/** "2 reps in the tank", or "To failure" at 0. Never the jargon. */
export const effortText = (t: TFunction, rir: number): string =>
  rir === 0 ? t('labels.effort.failure') : t('labels.effort.rir', { count: rir });
