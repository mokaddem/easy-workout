import { cx } from './cx';
import styles from './ProgressBar.module.css';

interface ProgressBase {
  /** Always visible: the bar is never the only carrier of the value. */
  label: string;
  className?: string;
}

export interface PlainProgressProps extends ProgressBase {
  variant?: 'plain';
  value: number;
  max: number;
}

export interface SegmentedProgressProps extends ProgressBase {
  variant: 'segmented';
  /** Number of segments. */
  total: number;
  /** 1-based index of the current segment; earlier ones are done. */
  current: number;
}

export type ProgressBarProps = PlainProgressProps | SegmentedProgressProps;

export function ProgressBar(props: ProgressBarProps) {
  const { label, className } = props;
  if (props.variant === 'segmented') {
    const { total, current } = props;
    return (
      <div className={cx(styles.wrap, className)}>
        <span className={styles.label}>{label}</span>
        <div
          className={styles.segs}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current}
          aria-valuetext={label}
          aria-label={label}
        >
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              className={cx(i + 1 < current && styles.done, i + 1 === current && styles.cur)}
              data-state={i + 1 < current ? 'done' : i + 1 === current ? 'current' : 'later'}
            />
          ))}
        </div>
      </div>
    );
  }
  const { value, max } = props;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={cx(styles.wrap, className)}>
      <span className={styles.label}>{label}</span>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={label}
        aria-label={label}
      >
        <i style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
