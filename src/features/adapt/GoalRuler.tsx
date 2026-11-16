import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { cx } from '@/ui/components/cx';
import { numberText, rulerLabel, secondsText } from './format';
import styles from './GoalRuler.module.css';

export interface GoalRulerProps {
  goal: number;
  min: number;
  max: number;
  /** Timed hold: bars are 5 s each and the top label carries "s". */
  time?: boolean;
  /** Bars past the top when the goal is beyond it (default 4 values, 2 for bands). */
  reach?: number;
  className?: string;
}

const bars = (from: number, to: number, step: number, goal: number, outside: boolean) => {
  const out: { v: number; on: boolean; outside: boolean }[] = [];
  for (let v = from; v <= to; v += step) out.push({ v, on: v <= goal, outside });
  return out;
};

/**
 * One bar per value of the range, filled up to the goal. Dashed bars sit before the minimum when
 * the goal is under the range, after the maximum when it is past it. Decorative: the label
 * carries the value for screen readers.
 */
export function GoalRuler({ goal, min, max, time = false, reach = 4, className }: GoalRulerProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.startsWith('fr') ? 'fr' : 'en') as Language;
  const step = time ? 5 : 1;
  const before = goal < min ? bars(goal, min - step, step, goal, true) : [];
  const inside = bars(min, max, step, goal, false);
  const after = goal > max ? bars(max + step, max + reach * step, step, goal, true) : [];
  const group = (list: typeof inside) =>
    list.length > 0 ? (
      <span className={styles.bars} aria-hidden="true">
        {list.map((b) => (
          <i key={b.v} className={cx(styles.bar, b.on && styles.on, b.outside && styles.outside)} />
        ))}
      </span>
    ) : null;
  return (
    <span className={cx(styles.ruler, className)}>
      <span className={styles.sr}>{rulerLabel(t, lang, { goal, min, max, time })}</span>
      {group(before)}
      <span aria-hidden="true">{numberText(min, lang)}</span>
      {group(inside)}
      <span aria-hidden="true">{time ? secondsText(max, lang) : numberText(max, lang)}</span>
      {group(after)}
    </span>
  );
}
