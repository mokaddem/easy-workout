import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import type { ExerciseRecord } from '@/engine';
import { exerciseName } from '@/features/adapt';
import { recordLine } from '@/features/records/format';
import { Icon } from '@/ui/components';
import styles from './Records.module.css';

/** One chip per exercise that set a record this session: the set, and the best one before it. */
export function Records({ records, lang }: { records: ExerciseRecord[]; lang: Language }) {
  const { t } = useTranslation();
  if (records.length === 0) return null;
  return (
    <section className={styles.sec} aria-labelledby="summary-records">
      <div className={styles.head}>
        <h2 className={styles.title} id="summary-records">
          {t('play.record.title', { count: records.length })}
        </h2>
        <p className={styles.sub}>{t('play.record.sub')}</p>
      </div>
      <ul className={styles.list}>
        {records.map((record, index) => (
          <li
            key={record.exerciseId}
            className={styles.chip}
            style={{ '--i': Math.min(index, 5) } as CSSProperties}
          >
            <span className={styles.medal} aria-hidden="true">
              <Icon name="medal" size={24} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{exerciseName(record.exerciseId, lang)}</span>
              <span className={styles.line}>{recordLine(t, lang, record)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
