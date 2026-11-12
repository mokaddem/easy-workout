import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './Chip.module.css';

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'onToggle' | 'aria-pressed'
> {
  selected: boolean;
  onToggle: (selected: boolean) => void;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, onToggle, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cx(styles.chip, className)}
      onClick={() => onToggle(!selected)}
    >
      {selected ? <Icon name="check" size={20} className={styles.check} /> : null}
      {children}
    </button>
  );
});

export interface ChipGroupProps {
  /** Accessible name of the group. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function ChipGroup({ label, children, className }: ChipGroupProps) {
  return (
    <div role="group" aria-label={label} className={cx(styles.group, className)}>
      {children}
    </div>
  );
}
