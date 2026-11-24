import { useTranslation } from 'react-i18next';
import { handleLinkClick, routeHref } from '@/app/router';
import type { SessionLog } from '@/domain';
import { activeSeconds } from '@/engine';
import { Icon, type IconName } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { Rich } from '../../adapt';
import { exerciseName } from '../../adapt/format';
import { dayShort, langOf } from '../format';
import { afterName, logIdentity } from './identity';
import { painStop, performedSets, rowStatus } from './groups';
import type { ProgrammeRecord } from '@/db';
import styles from './History.module.css';

/** One finished session in the list: what it was, when, and anything that set it apart. */
export function HistoryRow({
  log,
  programmes,
  logs = [],
}: {
  log: SessionLog;
  programmes: readonly ProgrammeRecord[];
  /** Every log, to name the session a cooldown followed. */
  logs?: readonly SessionLog[];
}) {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const identity = logIdentity(log, programmes, lang);
  const status = rowStatus(log);
  const pain = log.status === 'completed' ? painStop(log) : undefined;
  const href = routeHref({ name: 'log', logId: log.id });
  const sets = performedSets(log);
  const cooldown = identity.kind === 'cooldown';
  const after = cooldown ? afterName(t, identity, logs, programmes, lang) : undefined;
  const day = dayShort(log.startedAt, lang);
  const minutes = Math.round(activeSeconds(log) / 60);
  const meta = cooldown
    ? after
      ? t('progress.sessions.cooldownAfter', { day, minutes, name: after })
      : t('progress.sessions.cooldownMeta', { day, minutes })
    : t(sets > 0 ? 'progress.sessions.rowMeta' : 'progress.sessions.rowMetaNoSets', {
        day,
        minutes,
        count: sets,
      });

  let flag: { icon: IconName; text: string; pain?: boolean } | undefined;
  if (cooldown) {
    // Stopping a cooldown is fine: it is only said, never marked as a miss.
    if (status.kind === 'abandoned' || log.endedEarly)
      flag = { icon: 'flag', text: t('progress.sessions.cooldownStopped') };
  } else if (pain)
    flag = {
      icon: 'stop',
      pain: true,
      text: t('progress.sessions.pain', { exercise: exerciseName(pain.exerciseId, lang) }),
    };
  else if (status.kind === 'abandoned')
    flag = { icon: 'close', text: t('progress.sessions.abandoned') };
  else if (status.kind === 'early')
    flag = {
      icon: 'flag',
      text: t(
        status.counts ? 'progress.sessions.endedEarly' : 'progress.sessions.endedEarlyNoCount',
        { count: status.done, done: status.done, total: status.total },
      ),
    };
  else if (status.kind === 'own-alone')
    flag = { icon: 'bookmark', text: t('progress.sessions.ownAlone') };

  const wellIcon: IconName | undefined =
    identity.letter && identity.kind === 'programme'
      ? undefined
      : cooldown
        ? 'hourglass'
        : identity.kind === 'quick'
          ? 'bolt'
          : identity.kind === 'custom'
            ? 'bookmark'
            : identity.cardio
              ? 'heart'
              : 'list';

  return (
    <a
      className={cx(
        styles.row,
        !cooldown && status.kind === 'abandoned' && styles.gone,
        !cooldown && status.kind === 'early' && styles.early,
        cooldown && styles.cool,
      )}
      href={href}
      onClick={(e) => handleLinkClick(e, href)}
    >
      <span className={styles.id} aria-hidden="true">
        {wellIcon ? (
          <Icon name={wellIcon} size={24} />
        ) : (
          <span className={styles.idLetter}>{identity.letter}</span>
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{identity.title}</span>
        <span className={styles.meta}>{meta}</span>
        {flag ? (
          <span className={cx(styles.flag, flag.pain && styles.flagPain)}>
            <Icon name={flag.icon} size={20} />
            <span>
              <Rich text={flag.text} />
            </span>
          </span>
        ) : null}
      </span>
      <Icon name="chevron" size={20} className={styles.chev} />
    </a>
  );
}
