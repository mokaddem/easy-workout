import type { MaxTest } from '@/domain';
import { resultValue, type TestKind, type TestVerdict } from './testFlow';

/** A hold as m:ss ("1:12"), reps as a plain number. */
export function valueText(kind: TestKind, value: number): string {
  if (kind === 'reps') return String(value);
  const sec = Math.max(0, Math.round(value));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** The same, spoken: "18 reps", "1 minute 12". Plain enough for a screen reader to read as it is. */
export const valueTextOf = (test: Pick<MaxTest, 'result'>): string =>
  valueText(test.result.kind === 'reps' ? 'reps' : 'time', resultValue(test));

/** Day and month of a stored date ("8 septembre"). */
export const shortDate = (date: string, lang: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'long' });

/** The shorter form for a caption ("8 sept."). */
export const captionDate = (date: string, lang: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' });

export const verdictKey = (
  verdict: TestVerdict,
  context: MaxTest['context'],
): 'firstSession' | 'firstFresh' | 'more' | 'less' | 'same' => {
  if (verdict === 'first') return context === 'session' ? 'firstSession' : 'firstFresh';
  if (verdict === 'better') return 'more';
  return verdict === 'lower' ? 'less' : 'same';
};
