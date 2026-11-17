import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/ui/components';
import styles from '../ProgressScreen.module.css';

/** One way into a part of the history. */
export function NavRow({
  icon,
  title,
  meta,
  onClick,
}: {
  icon: IconName;
  title: string;
  meta: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.navRow} onClick={onClick}>
      <span className={styles.navWell}>
        <Icon name={icon} size={24} />
      </span>
      <span className={styles.navText}>
        <span className={styles.navTitle}>{title}</span>
        <span className={styles.navMeta}>{meta}</span>
      </span>
      <Icon name="chevron" size={20} className={styles.chev} />
    </button>
  );
}
