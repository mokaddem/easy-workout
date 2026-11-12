import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon, type IconName, type IconSize } from './Icon';
import { cx } from './cx';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Accessible name; icon buttons never stand alone without one. */
  label: string;
  icon: IconName;
  iconSize?: IconSize;
  appearance?: 'plain' | 'outline' | 'sunken';
  size?: 'default' | 'player';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    iconSize = 24,
    appearance = 'plain',
    size = 'default',
    type = 'button',
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(
        styles.btn,
        appearance === 'outline' && styles.outline,
        appearance === 'sunken' && styles.sunken,
        size === 'player' && styles.player,
        className,
      )}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
});
