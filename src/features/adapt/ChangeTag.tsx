import { Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import type { ChangeTagData } from './format';
import styles from './ChangeTag.module.css';

export interface ChangeTagProps {
  tag: ChangeTagData;
  className?: string;
}

/** Outline pill with an arrow: what moved since the last time. */
export function ChangeTag({ tag, className }: ChangeTagProps) {
  return (
    <span className={cx(styles.tag, className)}>
      <Icon name={tag.icon} size={20} className={styles.icon} />
      {tag.srPrefix ? <span className={styles.sr}>{tag.srPrefix} </span> : null}
      {tag.text}
    </span>
  );
}
