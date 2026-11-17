import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { cx } from './cx';
import styles from './ActionSheet.module.css';

export interface ActionItem {
  id: string;
  label: string;
  /** Muted second line. */
  hint?: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  /** Small line above the title (position, context). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Groups of items; a hairline separates the groups. Empty groups are skipped. */
  groups: readonly (readonly ActionItem[])[];
  /** Label of the footer button ("Close"). */
  closeLabel: string;
}

/** Sheet whose body is a list of menu items. Picking an item only calls its handler. */
export function ActionSheet({
  open,
  onClose,
  eyebrow,
  title,
  groups,
  closeLabel,
}: ActionSheetProps) {
  const shown = groups.filter((g) => g.length > 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        eyebrow ? (
          <>
            <span className={styles.eyebrow}>{eyebrow}</span>
            {title}
          </>
        ) : (
          title
        )
      }
      footer={
        <Button variant="secondary" fullWidth onClick={onClose}>
          {closeLabel}
        </Button>
      }
    >
      <div className={styles.list}>
        {shown.map((group, index) => (
          <div key={index} className={styles.group} role="group">
            {group.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(styles.item, item.danger && styles.danger)}
                disabled={item.disabled}
                onClick={item.onSelect}
              >
                <Icon name={item.icon} />
                <span className={styles.label}>{item.label}</span>
                {item.hint ? <span className={styles.hint}>{item.hint}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
