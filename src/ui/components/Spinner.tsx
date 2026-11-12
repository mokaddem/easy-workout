import styles from './Spinner.module.css';
import { cx } from './cx';

export interface SpinnerProps {
  size?: number;
  className?: string;
}

/** Decorative by default: put the accessible text on the control that owns it. */
export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx(styles.spinner, className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" className={styles.track} />
      <path d="M12 3a9 9 0 0 1 9 9" className={styles.arc} />
    </svg>
  );
}
