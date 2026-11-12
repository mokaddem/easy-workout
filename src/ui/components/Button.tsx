import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';
import { cx } from './cx';
import styles from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-outline';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** comfort = 56 px, player = 64 px */
  size?: 'comfort' | 'player';
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'comfort',
    icon,
    loading = false,
    fullWidth = false,
    type = 'button',
    className,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      className={cx(
        styles.btn,
        styles[variant],
        size === 'player' && styles.player,
        fullWidth && styles.block,
        loading && styles.loading,
        className,
      )}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? <Spinner size={20} /> : icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </button>
  );
});
