import type { ReactNode } from 'react';
import styles from './picker.module.css';

/** Small outlined tag at the end of a pick row. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className={styles.tag}>{children}</span>;
}
