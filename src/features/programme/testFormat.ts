import type { TFunction } from 'i18next';
import type { Language, MaxTest } from '@/domain';

/** "18 reps", or a hold as m:ss. */
export function testResultText(t: TFunction, test: Pick<MaxTest, 'result'>): string {
  if (test.result.kind === 'reps')
    return t('programme.session.testReps', { count: test.result.reps });
  const { seconds } = test.result;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The bare number of a result: reps, or a hold as m:ss. */
export function testNumberText(test: Pick<MaxTest, 'result'>): string {
  if (test.result.kind === 'reps') return String(test.result.reps);
  const { seconds } = test.result;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "8 septembre" / "8 September", from a date or a date-time. */
export function dayMonth(iso: string, lang: Language, style: 'long' | 'short' = 'long'): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: style }).format(d);
}
