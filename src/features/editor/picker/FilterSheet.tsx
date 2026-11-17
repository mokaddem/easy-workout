import { useTranslation } from 'react-i18next';
import type { MovementPattern, Muscle } from '@/domain';
import { Button, Chip, ChipGroup, Sheet } from '@/ui/components';
import type { Filters } from './list';
import styles from './picker.module.css';

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  options: { patterns: MovementPattern[]; muscles: Muscle[] };
  value: Filters;
  onChange: (next: Filters) => void;
  /** How many exercises the current filters show. */
  count: number;
}

const toggled = <T,>(set: ReadonlySet<T>, item: T, on: boolean): Set<T> => {
  const next = new Set(set);
  if (on) next.add(item);
  else next.delete(item);
  return next;
};

/** Multi-select chips for movement and muscle; applies live, the footer shows the result. */
export function FilterSheet({ open, onClose, options, value, onChange, count }: FilterSheetProps) {
  const { t } = useTranslation();
  const any = value.patterns.size > 0 || value.muscles.size > 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('picker.filter.title')}
      description={t('picker.filter.line')}
      footer={
        <>
          <Button fullWidth disabled={count === 0} onClick={onClose}>
            {count === 0 ? t('picker.filter.none') : t('picker.filter.show', { count })}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            disabled={!any}
            onClick={() => onChange({ patterns: new Set(), muscles: new Set() })}
          >
            {t('picker.filter.clearAll')}
          </Button>
        </>
      }
    >
      <h3 className={styles.groupTitle}>{t('picker.movement')}</h3>
      <ChipGroup label={t('picker.movement')}>
        {options.patterns.map((p) => (
          <Chip
            key={p}
            selected={value.patterns.has(p)}
            onToggle={(on) => onChange({ ...value, patterns: toggled(value.patterns, p, on) })}
          >
            {t(`labels.pattern.${p}`)}
          </Chip>
        ))}
      </ChipGroup>
      <h3 className={styles.groupTitle}>{t('picker.muscle')}</h3>
      <ChipGroup label={t('picker.muscle')}>
        {options.muscles.map((m) => (
          <Chip
            key={m}
            selected={value.muscles.has(m)}
            onToggle={(on) => onChange({ ...value, muscles: toggled(value.muscles, m, on) })}
          >
            {t(`labels.muscle.${m}`)}
          </Chip>
        ))}
      </ChipGroup>
    </Sheet>
  );
}
