import type { ReactNode } from 'react';
import { Tick } from '@/motion';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './CompareFigure.module.css';

export interface CompareFigureProps {
  /** The earlier value, formatted ("18"). Omit for a first result: only the new numeral shows. */
  from?: string;
  /** The new value, formatted ("24"). */
  to: string;
  /** Unit after the new value ("reps", "s"). */
  unit?: string;
  /** Small captions under each numeral ("8 Sep", "Today"). */
  fromCaption?: string;
  toCaption?: string;
  /** `large` is 48 → 96 px, `medium` 24 → 48 px. */
  size?: 'large' | 'medium';
  /** A change tag (or anything) shown beside the figure. */
  tag?: ReactNode;
  /** The whole figure as one sentence for screen readers; the visual parts are hidden from them. */
  srText: string;
  className?: string;
}

/** Old numeral (muted) → arrow → new numeral. */
export function CompareFigure({
  from,
  to,
  unit,
  fromCaption,
  toCaption,
  size = 'large',
  tag,
  srText,
  className,
}: CompareFigureProps) {
  return (
    <div className={cx(styles.cmp, size === 'medium' && styles.medium, className)}>
      <span className={styles.sr}>{srText}</span>
      <div className={styles.visual} aria-hidden="true">
        {from !== undefined ? (
          <>
            <span className={styles.cell}>
              <span className={cx(styles.num, styles.old)}>{from}</span>
              {fromCaption ? <span className={styles.cap}>{fromCaption}</span> : null}
            </span>
            <Icon name="arrow-right" className={styles.arrow} />
          </>
        ) : null}
        <span className={styles.cell}>
          <span className={cx(styles.num, styles.new)}>
            <Tick value={to}>{to}</Tick>
            {unit ? <small>{unit}</small> : null}
          </span>
          {toCaption ? <span className={styles.cap}>{toCaption}</span> : null}
        </span>
        {tag ? <span className={styles.tag}>{tag}</span> : null}
      </div>
    </div>
  );
}
