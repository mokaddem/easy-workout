import { useTranslation } from 'react-i18next';
import { IconButton, ProgressBar } from '@/ui/components';
import styles from '../Play.module.css';

interface PlayerBarProps {
  /** The context line: "Exercice 2 sur 7", "Repos". */
  context: string;
  /** Segments under the context line; none on rest screens. */
  segments?: { total: number; current: number };
  clock: string;
  voiceOn: boolean;
  /** The pause button turns into resume while paused. */
  paused?: boolean;
  onPause: () => void;
  /** Toggles the voice announcements. */
  onVoice?: () => void;
  tone?: 'base' | 'rest';
}

/** Pause, where the session stands, the session clock and the voice toggle. */
export function PlayerBar({
  context,
  segments,
  clock,
  voiceOn,
  paused,
  onPause,
  onVoice,
  tone = 'base',
}: PlayerBarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.bar} data-tone={tone}>
      <IconButton
        icon={paused ? 'play' : 'pause'}
        label={paused ? t('play.paused.resume') : t('play.pause')}
        onClick={onPause}
      />
      <div className={styles.barMid}>
        {segments ? (
          <ProgressBar variant="segmented" label={context} {...segments} />
        ) : (
          <span className={styles.barTitle}>{context}</span>
        )}
      </div>
      <span className={styles.barClock} aria-label={t('play.elapsed')}>
        {clock}
      </span>
      <IconButton
        icon="sound"
        label={t('play.voice')}
        aria-pressed={voiceOn}
        {...(onVoice && { onClick: onVoice })}
      />
    </div>
  );
}
