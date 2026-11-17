import { Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import type { ChangeTagData } from './format';
import styles from './ChangeTag.module.css';

export interface ChangeTagProps {
  tag: ChangeTagData;
  /** `large` is the live comparison on a result entry: 32 px high, 16 px label. */
  size?: 'default' | 'large';
  className?: string;
}

/** Outline pill with an arrow: what moved since the last time. */
export function ChangeTag({ tag, size = 'default', className }: ChangeTagProps) {
  return (
    <span className={cx(styles.tag, size === 'large' && styles.large, className)}>
      <Icon name={tag.icon} size={20} className={styles.icon} />
      {tag.srPrefix ? <span className={styles.sr}>{tag.srPrefix} </span> : null}
      {tag.text}
    </span>
  );
}
