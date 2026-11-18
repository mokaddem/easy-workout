import type { ReactNode } from 'react';
import type { Exercise } from '@/domain';
import { Icon } from '@/ui/components';
import { Tag } from './Tag';
import { Thumb } from './Thumb';
import styles from './picker.module.css';

export interface PickRowProps {
  exercise: Exercise;
  name: string;
  meta: string;
  /** Replace mode: the exercise being replaced. Not pickable. */
  current?: boolean;
  /** "X replaces it in your sessions." */
  away?: string;
  tag?: ReactNode;
  /** Opens the how-to from the picture. */
  onHowTo: () => void;
  howToLabel: string;
  onPick: () => void;
}

/** One exercise in the list: thumbnail, name, meta, optional trailing tag. */
export function PickRow({
  exercise,
  name,
  meta,
  current,
  away,
  tag,
  onHowTo,
  howToLabel,
  onPick,
}: PickRowProps) {
  return (
    <li className={styles.rowWrap}>
      <button
        type="button"
        className={styles.thumbHit}
        aria-label={howToLabel}
        data-howto={exercise.id}
        onClick={onHowTo}
      >
        <Thumb exercise={exercise} />
      </button>
      <button
        type="button"
        className={styles.row}
        data-current={current ? '' : undefined}
        aria-disabled={current || undefined}
        data-exercise={exercise.id}
        onClick={current ? undefined : onPick}
      >
        <span className={styles.rowText}>
          <span className={styles.rowName}>{name}</span>
          <span className={styles.rowMeta}>{meta}</span>
          {away ? (
            <span className={styles.rowAway}>
              <Icon name="swap" size={20} />
              <span>{away}</span>
            </span>
          ) : null}
        </span>
        {tag ? <Tag>{tag}</Tag> : null}
      </button>
    </li>
  );
}
