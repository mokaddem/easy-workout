import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { Button } from '@/ui/components';
import { exerciseLabel } from '../format';
import styles from '../Play.module.css';
import type { PlayContext } from './types';

/** Session paused: every clock stopped until Resume, with the way out under it. */
export function PausedScreen({
  lang,
  log,
  player,
  step,
  clock,
  onLeave,
}: PlayContext & { clock: string; onLeave: () => void }) {
  const { t } = useTranslation();
  const exercise = exerciseById.get(step.item.exerciseId);
  return (
    <>
      <div className={styles.set}>
        <div className={styles.pausedHead}>
          <h1 className={styles.name}>{t('play.paused.title')}</h1>
          <p className={styles.pausedSession}>{log.plan.name[lang]}</p>
        </div>
        <p className={styles.pausedClock}>
          <span className={`${styles.num} ${styles.pausedN}`}>{clock}</span>
          <span>{t('play.paused.clock')}</span>
        </p>
        <p className={styles.pausedAt}>
          <span>{t('play.paused.pickUp')}</span>
          <b>
            {exerciseLabel(exercise, lang, step.item.exerciseId)}
            {', '}
            {t('play.set.stepLabel', { set: step.set, sets: step.sets }).toLowerCase()}
          </b>
        </p>
      </div>
      <div className={styles.dock}>
        <Button size="player" fullWidth icon="play" onClick={player.resume}>
          {t('play.paused.resume')}
        </Button>
        <Button size="player" variant="secondary" fullWidth onClick={onLeave}>
          {t('play.paused.leave')}
        </Button>
      </div>
    </>
  );
}
