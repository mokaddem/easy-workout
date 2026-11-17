import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './Tag.module.css';

export interface TagProps {
  label: string;
  /** 14 px glyph before the label: `pencil` for edited, `plus` for added. */
  icon?: IconName;
  className?: string;
}

/** Outline pill: marks what the user did. No fill, no accent. */
export function Tag({ label, icon, className }: TagProps) {
  return (
    <span className={cx(styles.tag, className)}>
      {icon ? <Icon name={icon} size={20} className={styles.icon} /> : null}
      {label}
    </span>
  );
}
