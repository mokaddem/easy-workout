import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './EmptyCard.module.css';

export interface EmptyCardProps {
  icon: IconName;
  title: ReactNode;
  description: ReactNode;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/** Empty state inside a section: dashed card with a full-width secondary action. */
export function EmptyCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyCardProps) {
  return (
    <div className={cx(styles.card, className)}>
      <div className={styles.head}>
        <span className={styles.well}>
          <Icon name={icon} size={28} />
        </span>
        <div className={styles.text}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
      <Button variant="secondary" fullWidth onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
