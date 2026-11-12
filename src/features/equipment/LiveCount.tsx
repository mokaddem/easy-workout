import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Roll } from '@/motion';
import { catalogue } from '@/catalogue';
import type { EquipmentInventory } from '@/domain';
import { availableExercises } from '@/engine';
import styles from './LiveCount.module.css';

export interface LiveCountProps {
  inventory: EquipmentInventory;
}

/** "N exercises available" for an inventory, updated as it changes. Sits left of a dock button. */
export function LiveCount({ inventory }: LiveCountProps) {
  const { t } = useTranslation();
  const count = useMemo(() => availableExercises(catalogue, inventory).length, [inventory]);
  return (
    <p className={styles.counter} aria-live="polite" aria-atomic="true" data-testid="live-count">
      <Roll className={styles.num} value={count}>
        {count}
      </Roll>
      <span className={styles.label}>{t('equipment.live.label')}</span>
    </p>
  );
}
