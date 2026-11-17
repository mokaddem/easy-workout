import type { CSSProperties } from 'react';
import { cx } from './cx';
import styles from './CycleStrip.module.css';

/**
 * done: finished; early: finished but ended early; remaining: still to do this week;
 * later: a future week.
 */
export type CycleCellState = 'done' | 'early' | 'remaining' | 'later';

export interface CycleStripWeek {
  /** Short caption under the column ("1", "S1"). */
  label: string;
  /** One entry per planned session, filled bottom-up in the order given. */
  cells: readonly CycleCellState[];
  /** Highlights the column (the current week). */
  current?: boolean;
}

export interface CycleStripProps {
  weeks: readonly CycleStripWeek[];
  /** Ghost: empty-state outlines only; cell states are ignored. */
  ghost?: boolean;
  /** `tall` draws 28 px cells (the review); the default is 12 px. */
  size?: 'default' | 'tall';
  /** Reveal the columns left to right once on mount (the review). Off for plain re-renders. */
  sweep?: boolean;
  className?: string;
}

const STATE_CLASS: Record<CycleCellState, string> = {
  done: styles.done!,
  early: styles.early!,
  remaining: styles.remaining!,
  later: styles.later!,
};

/**
 * One column per week, one cell per planned session. Decorative: the sentence next to it
 * carries the values.
 */
export function CycleStrip({ weeks, ghost, size = 'default', sweep, className }: CycleStripProps) {
  return (
    <div
      className={cx(
        styles.strip,
        size === 'tall' && styles.tall,
        ghost && styles.ghost,
        sweep && !ghost && styles.sweep,
        className,
      )}
      aria-hidden="true"
      style={{
        gridTemplateColumns: `repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))`,
        ...(sweep && { ['--weeks' as string]: Math.max(weeks.length, 1) }),
      }}
    >
      {weeks.map((week, w) => (
        <div
          key={w}
          className={cx(
            styles.week,
            week.current && !ghost && styles.current,
            !ghost && week.cells.length > 0 && week.cells.every((c) => c === 'later') && styles.far,
          )}
          style={sweep ? ({ ['--w' as string]: w } as CSSProperties) : undefined}
        >
          <span className={styles.cells}>
            {week.cells.map((cell, i) => (
              <i key={i} className={ghost ? undefined : STATE_CLASS[cell]} />
            ))}
          </span>
          <span className={styles.label}>{week.label}</span>
        </div>
      ))}
    </div>
  );
}
