import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon: IconName;
  title: ReactNode;
  description: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** Primary by default; use secondary when yellow is not "now" on this screen. */
  actionVariant?: ButtonVariant;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <span className={styles.well}>
        <Icon name={icon} size={28} />
      </span>
      <div className={styles.text}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      {actionLabel ? (
        <Button {...(actionVariant && { variant: actionVariant })} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
