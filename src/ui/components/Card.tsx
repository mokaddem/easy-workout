import { useId, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'li';
}

export function Card({ as = 'div', className, ...rest }: CardProps) {
  const Tag: ElementType = as;
  return <Tag {...rest} className={cx(styles.card, className)} />;
}

export interface SelectableCardProps {
  selected: boolean;
  onToggle: (selected: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  /** Settings shown while the card is on. */
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** The header row is the toggle; the settings expand beneath it when on. */
export function SelectableCard({
  selected,
  onToggle,
  title,
  subtitle,
  icon,
  children,
  disabled,
  className,
}: SelectableCardProps) {
  const bodyId = useId();
  return (
    <div className={cx(styles.card, styles.selectable, selected && styles.on, className)}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={children ? selected : undefined}
        aria-controls={children ? bodyId : undefined}
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onToggle(!selected)}
      >
        {icon ? (
          <span className={styles.well}>
            <Icon name={icon} size={28} />
          </span>
        ) : null}
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </span>
        <span className={styles.box} aria-hidden="true">
          <Icon name="check" size={20} className={styles.mark} />
        </span>
      </button>
      {children ? (
        <div id={bodyId} className={styles.body} hidden={!selected}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
