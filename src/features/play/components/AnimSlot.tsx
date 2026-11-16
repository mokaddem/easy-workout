import { Icon, type IconName } from '@/ui/components';
import { useTranslation } from 'react-i18next';
import styles from '../Play.module.css';

/** Placeholder for the exercise animation: keeps its size and place, with the movement's key cue. */
export function AnimSlot({
  glyph,
  tag,
  cue,
}: {
  glyph: IconName;
  tag: string;
  cue?: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.slot} role="img" aria-label={t('play.set.demo')}>
      <svg
        className={styles.slotFloor}
        viewBox="0 0 350 80"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 4H350M-60 80L150 4M410 80L200 4M70 80L163 4M280 80L187 4M175 80V4M0 22H350M0 46H350" />
      </svg>
      <Icon className={styles.slotGlyph} name={glyph} />
      {tag ? <span className={styles.slotTag}>{tag}</span> : null}
      {cue ? <p className={styles.slotCue}>{cue}</p> : null}
    </div>
  );
}
