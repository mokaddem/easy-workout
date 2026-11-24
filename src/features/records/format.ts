import type { TFunction } from 'i18next';
import type { Language } from '@/domain';
import type { ExerciseRecord, RecordSet } from '@/engine';
import { loadText, numberText, secondsText, tokenOf } from '@/features/adapt/format';

const NBSP = ' ';

/**
 * A record set the way the rest of the app writes a set: "22 kg × 9", "+10 kg × 8", "Heavy band × 12",
 * "12 reps" (bodyweight), "45 s" (a hold), "10 kg · 45 s" (a loaded hold).
 */
export function recordSetText(t: TFunction, lang: Language, set: RecordSet): string {
  const loaded = set.load && set.load.kind !== 'bodyweight' ? set.load : undefined;
  const load = loaded ? loadText(t, lang, tokenOf(loaded)) : undefined;
  if (set.unit === 'seconds') {
    const time = secondsText(set.value, lang);
    return load ? t('play.record.loadedHold', { load, time }) : time;
  }
  if (!load) return t('play.repsCount', { count: set.value });
  return t('play.record.loadTimes', { load, reps: numberText(set.value, lang) }).replace(
    ' × ',
    `${NBSP}×${NBSP}`,
  );
}

/** "22 kg × 9 · best was 20 kg × 12". */
export function recordLine(t: TFunction, lang: Language, record: ExerciseRecord): string {
  return t('play.record.line', {
    set: recordSetText(t, lang, record.set),
    previous: recordSetText(t, lang, record.previous),
  });
}
