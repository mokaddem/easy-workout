import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import { cx } from './cx';
import styles from './AppBar.module.css';

export interface AppBarProps {
  title: ReactNode;
  meta?: ReactNode;
  onBack?: () => void;
  /** Accessible name of the back button; required with `onBack`. */
  backLabel?: string;
  /** Trailing icon buttons. */
  actions?: ReactNode;
  className?: string;
}

export function AppBar({ title, meta, onBack, backLabel, actions, className }: AppBarProps) {
  return (
    <header className={cx(styles.bar, onBack && styles.hasBack, className)}>
      {onBack ? <IconButton icon="back" label={backLabel ?? ''} onClick={onBack} /> : null}
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
