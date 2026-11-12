import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './ListRow.module.css';

export interface ListRowProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Icon shown in the 48 px leading well. */
  icon?: IconName;
  /** Custom leading content (thumbnail); replaces the icon well content. */
  leading?: ReactNode;
  /** Value or control at the end of the row. */
  trailing?: ReactNode;
  /** Chevron after the trailing content; implied by `href` / `onClick`. */
  chevron?: boolean;
  /** Renders as a link. */
  href?: string;
  /** Renders as a button. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ListRow({
  title,
  meta,
  icon,
  leading,
  trailing,
  chevron,
  href,
  onClick,
  disabled,
  className,
}: ListRowProps) {
  const interactive = !disabled && (href !== undefined || onClick !== undefined);
  const showChevron = !disabled && (chevron ?? interactive);
  const content = (
    <>
      {icon || leading ? (
        <span className={styles.well}>
          {leading ?? (icon ? <Icon name={icon} size={24} /> : null)}
        </span>
      ) : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      {showChevron ? <Icon name="chevron" size={20} className={styles.chevron} /> : null}
    </>
  );
  const classes = cx(
    styles.row,
    interactive && styles.interactive,
    disabled && styles.disabled,
    className,
  );

  if (interactive && href !== undefined) {
    return (
      <a className={classes} href={href} onClick={onClick}>
        {content}
      </a>
    );
  }
  if (interactive) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} aria-disabled={disabled || undefined}>
      {content}
    </div>
  );
}
