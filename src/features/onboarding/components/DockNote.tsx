import type { ReactNode } from 'react';
import { Icon } from '@/ui/components';
import styles from './DockNote.module.css';

/** Says what saving will do, above the primary button. */
export function DockNote({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'alert';
  children: ReactNode;
}) {
  return (
    <p className={styles.note} role={tone === 'alert' ? 'status' : undefined}>
      <Icon name={tone === 'alert' ? 'alert' : 'info'} size={20} />
      <span>{children}</span>
    </p>
  );
}
