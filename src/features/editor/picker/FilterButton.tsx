import { Icon } from '@/ui/components';
import styles from './picker.module.css';

export interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/** Chip-shaped button that opens the filter sheet; inverse while a filter is on. */
export function FilterButton({ label, active, onClick }: FilterButtonProps) {
  return (
    <button
      type="button"
      className={styles.filterButton}
      data-on={active ? '' : undefined}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {label}
      <Icon name="chev-down" size={20} />
    </button>
  );
}
