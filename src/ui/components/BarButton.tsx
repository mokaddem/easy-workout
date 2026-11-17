import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './BarButton.module.css';

export interface BarButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> {
  icon: IconName;
  label: string;
  /** Done and inert: muted, aria-disabled, no click. Use with the check glyph. */
  settled?: boolean;
}

/** Text + glyph action for an app bar or context bar. At most one per bar. */
export function BarButton({
  icon,
  label,
  settled = false,
  className,
  onClick,
  ...rest
}: BarButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-disabled={settled || undefined}
      className={cx(styles.bar, settled && styles.settled, className)}
      onClick={(event) => {
        if (settled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
}
