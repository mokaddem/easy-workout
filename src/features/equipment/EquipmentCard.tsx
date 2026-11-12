import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from '@/ui/components';
import styles from './EquipmentCard.module.css';

export interface EquipmentCardProps {
  icon: IconName;
  name: string;
  /** Sub-line: what it is for, or the recap of its specs once owned. */
  subtitle: string;
  owned: boolean;
  /** Owned and has specs to show. */
  expandable: boolean;
  open: boolean;
  hasError?: boolean;
  onTick: () => void;
  onToggleOpen: () => void;
  children?: ReactNode;
}

/** The main area ticks (or expands when owned); the 64 px column always toggles ownership. */
export function EquipmentCard({
  icon,
  name,
  subtitle,
  owned,
  expandable,
  open,
  hasError,
  onTick,
  onToggleOpen,
  children,
}: EquipmentCardProps) {
  const bodyId = useId();
  const expanded = owned && expandable && open;
  return (
    <article
      className={[styles.card, owned && styles.on, hasError && styles.error]
        .filter(Boolean)
        .join(' ')}
      data-owned={owned}
    >
      <div className={styles.head}>
        <button
          type="button"
          className={styles.main}
          aria-expanded={owned && expandable ? expanded : undefined}
          aria-controls={owned && expandable ? bodyId : undefined}
          onClick={() => (owned ? (expandable ? onToggleOpen() : onTick()) : onTick())}
        >
          <span className={styles.well}>
            <Icon name={icon} size={28} />
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{name}</span>
            <span className={styles.sub}>{subtitle}</span>
          </span>
          {owned && expandable ? (
            <Icon name="chev-down" size={24} className={expanded ? styles.flip : undefined} />
          ) : null}
        </button>
        <label className={styles.tick}>
          <input
            type="checkbox"
            className={styles.input}
            checked={owned}
            aria-label={name}
            onChange={onTick}
          />
          <span className={styles.box} aria-hidden="true">
            <Icon name="check" size={20} className={styles.mark} />
          </span>
        </label>
      </div>
      {expanded ? (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      ) : null}
    </article>
  );
}
