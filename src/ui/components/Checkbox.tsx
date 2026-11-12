import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'checked' | 'size'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label; omit and pass `aria-label` for a bare box. */
  children?: ReactNode;
}

/** 28 px box inside a ≥ 48 px target; a native input keeps keyboard and form behaviour. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked, onChange, children, className, disabled, ...rest },
  ref,
) {
  return (
    <label className={cx(styles.root, disabled && styles.disabled, className)}>
      <input
        {...rest}
        ref={ref}
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={20} className={styles.mark} />
      </span>
      {children ? <span className={styles.text}>{children}</span> : null}
    </label>
  );
});

export interface IncludedListProps {
  items: readonly string[];
  className?: string;
}

/** Static list of items that are always included: a check glyph, never a control. */
export function IncludedList({ items, className }: IncludedListProps) {
  return (
    <ul className={cx(styles.included, className)}>
      {items.map((item) => (
        <li key={item}>
          <Icon name="check" size={20} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
