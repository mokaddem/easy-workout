import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './IssueLine.module.css';

export interface IssueLineProps {
  /** block: stops the save (danger text). warn: a note the user can dismiss. */
  level: 'block' | 'warn';
  /** Point `aria-describedby` of the thing it concerns here. */
  id?: string;
  children: ReactNode;
  /** Compact secondary action (block level), e.g. a "Replace" button. */
  action?: ReactNode;
  /** Shows the Dismiss ghost button; needs `dismissLabel`. */
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

export function IssueLine({
  level,
  id,
  children,
  action,
  onDismiss,
  dismissLabel,
  className,
}: IssueLineProps) {
  return (
    <div className={cx(styles.issue, level === 'block' ? styles.block : styles.warn, className)}>
      <Icon name={level === 'block' ? 'alert' : 'info'} size={20} />
      <div className={styles.body}>
        <span id={id}>{children}</span>
        {action ?? null}
        {onDismiss && dismissLabel ? (
          <Button variant="ghost" className={styles.dismiss} onClick={onDismiss}>
            {dismissLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
