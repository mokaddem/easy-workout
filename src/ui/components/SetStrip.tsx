import { cx } from './cx';
import styles from './SetStrip.module.css';

export interface SetStripProps {
  /** One group per exercise (or superset): its planned sets and how many are done. */
  groups: readonly { total: number; done: number }[];
  /** Thinner bars, for the resume banner. */
  small?: boolean;
  className?: string;
}

/**
 * One bar per planned main set, grouped by exercise. Decorative: the text next to it
 * carries the numbers.
 */
export function SetStrip({ groups, small, className }: SetStripProps) {
  return (
    <div className={cx(styles.strip, small && styles.small, className)} aria-hidden="true">
      {groups.map((group, g) => (
        <span key={g} className={styles.group} style={{ flexGrow: group.total }}>
          {Array.from({ length: group.total }, (_, i) => (
            <i key={i} className={i < group.done ? styles.on : undefined} />
          ))}
        </span>
      ))}
    </div>
  );
}
