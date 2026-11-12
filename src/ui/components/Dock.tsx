import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Dock.module.css';

export interface DockProps {
  children: ReactNode;
  className?: string;
}

/** Bottom action dock: stays in view at the bottom of the screen and clears the home indicator. */
export function Dock({ children, className }: DockProps) {
  return (
    <div className={cx(styles.dock, className)} data-dock="">
      {children}
    </div>
  );
}
