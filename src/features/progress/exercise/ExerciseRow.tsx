import { useTranslation } from 'react-i18next';
import type { Exercise, Language } from '@/domain';
import type { ExerciseListItem } from '@/engine';
import { ChangeTag } from '@/features/adapt/ChangeTag';
import type { ChangeTagData } from '@/features/adapt/format';
import { Thumb } from '@/features/editor/picker/Thumb';
import { Icon } from '@/ui/components';
import { dayDate } from '../charts/format';
import { standsOf } from './stands';
import styles from './exercise.module.css';

export interface ExerciseRowProps {
  item: ExerciseListItem;
  exercise: Exercise | undefined;
  /** Last 14 days: a step up or a new best. */
  tag?: ChangeTagData | { record: true };
  onOpen: () => void;
}

/** One exercise done: thumbnail, name, last time, and where it stands now. */
export function ExerciseRow({ item, exercise, tag, onOpen }: ExerciseRowProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const name = exercise?.name[lang] ?? item.exerciseId;
  const stands = item.latest ? standsOf(t, lang, item.latest) : undefined;
  return (
    <li>
      <button type="button" className={styles.row} data-exercise={item.exerciseId} onClick={onOpen}>
        {exercise ? <Thumb exercise={exercise} /> : <span />}
        <span className={styles.rowText}>
          <span className={styles.rowName}>{name}</span>
          <span className={styles.rowMeta}>
            {t('stats.exercises.rowMeta', {
              count: item.sessions,
              day: dayDate(item.lastAt, lang),
            })}
            {item.pain ? (
              <>
                {' · '}
                <span className={styles.pain}>{t('stats.exercises.pain')}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className={styles.stands}>
          {stands?.word ? <span className={styles.standsWord}>{stands.word}</span> : null}
          {stands ? (
            <span className={styles.standsFigure}>
              {stands.value}
              <span className={styles.standsUnit}>{stands.unit}</span>
            </span>
          ) : null}
          {tag && 'record' in tag ? (
            <span className={styles.recordTag}>
              <Icon name="medal" size={20} />
              {t('stats.exercises.best')}
            </span>
          ) : tag ? (
            <ChangeTag tag={tag} />
          ) : null}
        </span>
      </button>
    </li>
  );
}
