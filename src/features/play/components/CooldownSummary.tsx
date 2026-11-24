import { useTranslation } from 'react-i18next';
import { Tick } from '@/motion';
import { useSessionLog } from '@/app/data';
import { navigate } from '@/app/router';
import type { Language, SessionLog } from '@/domain';
import { activeSeconds } from '@/engine';
import { Button, Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { durationParts } from '../format';
import { clearSummary } from '../lifecycle';
import styles from './Summary.module.css';

/** The end of a cooldown: how long, and nothing to decide. Back goes where the training summary would. */
export function CooldownSummary({ log }: { log: SessionLog }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const afterId = log.source.kind === 'cooldown' ? log.source.afterLogId : undefined;
  const after = useSessionLog(afterId);
  const quick = after?.source.kind === 'quick';
  const duration = durationParts(activeSeconds(log));
  const stretches = new Set(log.sets.filter((s) => s.actual).map((s) => s.exerciseId)).size;

  const back = () => {
    clearSummary();
    navigate({ name: quick ? 'quick' : 'programme' }, { replace: true });
  };

  return (
    <div className={styles.root}>
      <div className={styles.context}>
        <span>{log.plan.name[lang]}</span>
      </div>
      <div className={styles.scroll}>
        <div className={styles.sum}>
          <div className={styles.head}>
            <h1 className={styles.title}>{t('play.cooldown.title')}</h1>
            <div
              className={styles.dur}
              role="img"
              aria-label={t('play.summary.duration', {
                minutes: Math.round(activeSeconds(log) / 60),
              })}
            >
              <span className={styles.durRow}>
                <span className={styles.durN}>
                  <Tick>{duration.value}</Tick>
                </span>
                {duration.unit ? <span className={styles.durU}>{t('labels.unit.min')}</span> : null}
              </span>
              <span className={styles.durLabel}>
                {stretches > 0 ? t('play.cooldown.stretches', { count: stretches }) : null}
              </span>
            </div>
          </div>
          <p className={cx(styles.notice, styles.calm)}>
            <Icon name="check" size={20} />
            <span>{t('play.cooldown.calm')}</span>
          </p>
        </div>
      </div>
      <div className={styles.dock}>
        <Button variant="secondary" size="player" fullWidth onClick={back}>
          {t(quick ? 'play.summary.backQuick' : 'play.summary.backProgramme')}
        </Button>
      </div>
    </div>
  );
}
