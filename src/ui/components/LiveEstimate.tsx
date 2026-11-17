import { Roll } from '@/motion';
import { cx } from './cx';
import styles from './LiveEstimate.module.css';

export interface LiveEstimateProps {
  /** "Session". */
  label: string;
  /** Rounded minutes; null shows a dash. */
  minutes: number | null;
  /** "min". */
  unit: string;
  /** Text of the delta tag ("+2 min"); omit while unchanged. */
  delta?: string;
  className?: string;
}

/** Dose sheet line: label, numeral, unit and an optional delta tag. Announced politely. */
export function LiveEstimate({ label, minutes, unit, delta, className }: LiveEstimateProps) {
  const text = minutes == null ? '–' : `~${minutes}`;
  return (
    <p className={cx(styles.live, className)} aria-live="polite" aria-atomic="true">
      <span>{label}</span>
      <Roll className={styles.num} value={text}>
        {text}
      </Roll>
      {minutes != null ? <span>{unit}</span> : null}
      {delta ? (
        <span key={delta} className={styles.delta}>
          {delta}
        </span>
      ) : null}
    </p>
  );
}
