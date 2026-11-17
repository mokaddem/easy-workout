import type { Exercise } from '@/domain';
import { Icon } from '@/ui/components';
import { thumbIcon } from './thumbIcon';
import styles from './picker.module.css';

/** The animation slot at thumbnail size: keeps its 56 px when animations arrive. */
export function Thumb({ exercise }: { exercise: Exercise }) {
  return (
    <span className={styles.thumb} aria-hidden="true">
      <Icon name={thumbIcon(exercise)} size={28} />
    </span>
  );
}
