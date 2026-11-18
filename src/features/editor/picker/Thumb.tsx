import type { Exercise } from '@/domain';
import { equipmentInUse, FigureTile } from '@/features/figure';
import { Icon } from '@/ui/components';
import { thumbIcon } from './thumbIcon';
import styles from './picker.module.css';

/** The exercise as a 56 px still figure; the equipment glyph while loading or without one. */
export function Thumb({ exercise }: { exercise: Exercise }) {
  return (
    <span className={styles.thumb} aria-hidden="true">
      <FigureTile
        exerciseId={exercise.id}
        size={56}
        equipment={equipmentInUse(exercise)}
        fallback={<Icon name={thumbIcon(exercise)} size={28} />}
      />
    </span>
  );
}
