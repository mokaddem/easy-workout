import { useEffect, useState, type ReactNode } from 'react';
import { Roll } from '@/motion';
import { cx } from './cx';
import styles from './DurationMeter.module.css';

export interface DurationMeterProps {
  /** Estimated minutes; null shows a dash. */
  minutes: number | null;
  /** "min". */
  unit: string;
  /** Session length to fit; omit for the plain variant (no bar). */
  budget?: number;
  /** Line under the bar (or beside the numeral when plain). Wrap figures in <b>. */
  line: ReactNode;
  /** Plain-text sentence announced after the value settles. */
  announcement: string;
  className?: string;
}

const QUIET_MS = 600;

/** Pinned duration meter: numeral, budget tick, fill and a hatched overrun. */
export function DurationMeter({
  minutes,
  unit,
  budget,
  line,
  announcement,
  className,
}: DurationMeterProps) {
  const [announced, setAnnounced] = useState(announcement);
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(announcement), QUIET_MS);
    return () => clearTimeout(timer);
  }, [announcement]);

  const empty = minutes == null;
  const text = empty ? '–' : `~${minutes}`;
  const hasBar = budget != null && budget > 0;
  const scale = hasBar ? Math.max(minutes ?? 0, budget) * 1.15 : 1;
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const fill = hasBar ? Math.min(minutes ?? 0, budget) : 0;
  const over = hasBar && minutes != null && minutes > budget;

  return (
    <div className={cx(styles.meter, !hasBar && styles.plain, className)}>
      <div className={styles.number}>
        <Roll className={cx(styles.num, empty && styles.empty)} value={text}>
          {text}
        </Roll>
        <small>{unit}</small>
      </div>
      <div className={styles.right}>
        {hasBar ? (
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: pct(fill) }} />
            {over ? (
              <div
                className={styles.over}
                style={{ left: pct(budget), width: pct((minutes ?? 0) - budget) }}
              />
            ) : null}
            <div className={styles.tick} style={{ left: pct(budget) }} />
          </div>
        ) : null}
        <p className={styles.line}>{line}</p>
      </div>
      <span className={styles.hidden} role="status" aria-live="polite">
        {announced}
      </span>
    </div>
  );
}
