import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleLinkClick, navigate, routeHref } from '@/app/router';
import { repo } from '@/db/repo';
import type { ProgrammeRecord } from '@/db';
import type { Language, SessionLog } from '@/domain';
import { activeSeconds } from '@/engine';
import { Button, Dialog, Icon, useToast } from '@/ui/components';
import { exerciseName } from '../../adapt/format';
import { activeParts, clockTime, dayLong, langOf } from '../format';
import { afterName, logIdentity } from './identity';
import styles from './History.module.css';

/** A finished cooldown, read-only: the stretches it ran and the session it followed. */
export function CooldownLog({
  log,
  logs,
  programmes,
}: {
  log: SessionLog;
  logs: readonly SessionLog[];
  programmes: readonly ProgrammeRecord[];
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = langOf(i18n.language);
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const identity = logIdentity(log, programmes, lang);
  const after = afterName(t, identity, logs, programmes, lang);
  const afterHref = identity.afterLogId
    ? routeHref({ name: 'log', logId: identity.afterLogId })
    : undefined;
  const minutes = activeParts(activeSeconds(log)).minutes;
  const stretches = useMemo(() => {
    const seen = new Set<string>();
    for (const s of log.sets) if (s.actual && s.flag !== 'skipped') seen.add(s.exerciseId);
    return [...seen];
  }, [log.sets]);

  const when = log.endedAt
    ? t('progress.log.when', {
        day: dayLong(log.startedAt, lang),
        start: clockTime(log.startedAt, lang),
        end: clockTime(log.endedAt, lang),
      })
    : t('progress.log.whenStart', {
        day: dayLong(log.startedAt, lang),
        start: clockTime(log.startedAt, lang),
      });

  const remove = async () => {
    setConfirm(false);
    try {
      const removed = await repo.deleteSessionLog(log.id);
      navigate({ name: 'history' }, { replace: true });
      toast.show({
        message: t('progress.log.deleted'),
        action: { label: t('common.undo'), onAction: () => void repo.restoreSessionLog(removed) },
      });
    } catch {
      // Closed or removed in the meantime: nothing to delete.
    }
  };

  return (
    <div className={styles.ld}>
      <div className={styles.ldId}>
        <span className={styles.ldTile} aria-hidden="true">
          <Icon name="hourglass" size={28} />
        </span>
        <div className={styles.ldText}>
          <h1 className={styles.ldName}>{identity.title}</h1>
        </div>
      </div>
      <p className={styles.ldWhen}>{when}</p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statN}>
            {minutes}
            <small>{t('progress.unit.min')}</small>
          </span>
          <span className={styles.statLabel}>{t('progress.log.statActive')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statN}>{stretches.length}</span>
          <span className={styles.statLabel}>
            {t('progress.log.cooldownStretches', { count: stretches.length })}
          </span>
        </div>
      </div>

      <section className={styles.sec} aria-labelledby="cooldown-stretches">
        {afterHref && after ? (
          <a
            className={styles.lxHead}
            href={afterHref}
            onClick={(e) => handleLinkClick(e, afterHref)}
          >
            <span className={styles.lxName}>
              {t('progress.log.cooldownAfterLink', { name: after })}
            </span>
            <Icon name="chevron" size={20} className={styles.chev} />
          </a>
        ) : null}
        <h2 className={styles.srOnly} id="cooldown-stretches">
          {t('progress.log.byExercise')}
        </h2>
        <ul className={styles.warm}>
          {stretches.map((id) => (
            <li key={id}>
              <span>{exerciseName(id, lang)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.del}>
        <Button
          variant="destructive-outline"
          fullWidth
          icon="trash"
          onClick={() => setConfirm(true)}
        >
          {t('progress.log.delete')}
        </Button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('progress.log.deleteDialog.title')}
        description={t('progress.log.cooldownDeleteBody')}
        confirmLabel={t('progress.log.deleteDialog.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}
