import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './CheckRow.module.css';

export interface CheckRowProps {
  title: ReactNode;
  meta?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Differs from what is saved: a bar on the left edge. */
  changed?: boolean;
  /** Not available right now: still focusable, does nothing. */
  disabled?: boolean;
  /** Preview slot before the box (a session letter). */
  leading?: ReactNode;
  /** Sheets use the shorter row. */
  compact?: boolean;
  className?: string;
}

/** A list row that toggles as a whole; the box at the end shows the state. */
export function CheckRow({
  title,
  meta,
  checked,
  onChange,
  changed,
  disabled,
  leading,
  compact,
  className,
}: CheckRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className={cx(
        styles.row,
        compact && styles.compact,
        changed && styles.changed,
        disabled && styles.disabled,
        className,
      )}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={20} className={styles.mark} />
      </span>
    </button>
  );
}
