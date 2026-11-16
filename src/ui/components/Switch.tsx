import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Switch.module.css';

export interface SwitchRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  /** One line under the title; it can state the consequence and change with the state. */
  meta?: ReactNode;
  disabled?: boolean;
  /** Taller row with a bolder title, for a decision that owns a card. */
  large?: boolean;
  className?: string;
}

/** A full-width toggle: title and meta on the left, the switch on the right. */
export function SwitchRow({
  checked,
  onChange,
  title,
  meta,
  disabled,
  large,
  className,
}: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className={cx(styles.row, large && styles.large, className)}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
      <span className={styles.switch} aria-hidden="true" />
    </button>
  );
}
