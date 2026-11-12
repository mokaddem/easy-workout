import { useTranslation } from 'react-i18next';
import type { EquipmentInventory, Goal, Level } from '@/domain';
import { splitDescription, useSplit } from './split';
import { ListRowMotion, PresenceList } from '@/motion';
import { Icon } from '@/ui/components';
import styles from './SplitPreview.module.css';

interface Props {
  days: number;
  minutes: number;
  goal: Goal | null;
  level: Level | null;
  equipment: EquipmentInventory;
  /** Show only the one-line description (Profile). */
  compact?: boolean;
}

export function SplitPreview({ days, minutes, goal, level, equipment, compact = false }: Props) {
  const { t } = useTranslation();
  const rows = useSplit({ days, minutes, goal, level, equipment });
  const short = minutes < 30;

  if (compact) {
    return (
      <p className={styles.compact} aria-live="polite">
        <span className={styles.tiles} aria-hidden="true">
          {rows.map((row) => row.letter ?? '').join('')}
        </span>
        <span>{splitDescription(t, days, minutes)}</span>
      </p>
    );
  }
  return (
    <section className={styles.split} aria-live="polite">
      <div className={styles.head}>
        <h2 className={styles.heading}>{t('onboarding.schedule.week')}</h2>
        <p className={styles.desc}>{splitDescription(t, days, minutes)}</p>
      </div>
      {short ? (
        <p className={styles.note}>
          <Icon name="info" size={20} />
          <span>{t('onboarding.schedule.short')}</span>
        </p>
      ) : null}
      <ol className={styles.list}>
        <PresenceList>
          {rows.map((row) => (
            <ListRowMotion key={row.id} className={styles.row} gap={6}>
              {row.letter ? (
                <span className={styles.tile} aria-hidden="true">
                  {row.letter}
                </span>
              ) : (
                <span className={`${styles.tile} ${styles.cardio}`} aria-hidden="true">
                  <Icon name="incline" size={24} />
                </span>
              )}
              <span className={styles.name}>{row.name}</span>
            </ListRowMotion>
          ))}
        </PresenceList>
      </ol>
    </section>
  );
}
