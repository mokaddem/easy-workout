import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgrammes, useSessionLogs } from '@/app/data';
import { goBack, navigate } from '@/app/router';
import { isCooldownLog } from '@/domain';
import { AppBar, EmptyState, Skeleton } from '@/ui/components';
import { langOf, longDate, timeText } from '../format';
import { historyGroups, weekDistance } from './groups';
import { HistoryRow } from './HistoryRow';
import { PresenceList, RowMotion } from '@/motion';
import styles from './History.module.css';

/** Weeks drawn at first, and added each time the end of the list scrolls into view. */
const PAGE = 30;

/** Every finished session, by calendar week, newest first. */
export function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const logs = useSessionLogs();
  const programmes = useProgrammes();
  const groups = useMemo(() => (logs ? historyGroups(logs) : []), [logs]);
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [groups.length, shown]);

  const bar = (meta?: string) => (
    <AppBar
      title={t('progress.sessions.title')}
      {...(meta ? { meta } : {})}
      onBack={goBack}
      backLabel={t('progress.sessions.back')}
    />
  );

  if (!logs || !programmes)
    return (
      <>
        {bar()}
        <div className={styles.skeletonPage} aria-busy="true">
          <Skeleton height={24} width="40%" />
          <Skeleton height={76} />
          <Skeleton height={76} />
          <Skeleton height={76} />
        </div>
      </>
    );

  const completed = logs.filter((l) => l.status === 'completed' && !isCooldownLog(l));
  if (groups.length === 0)
    return (
      <>
        {bar()}
        <EmptyState
          icon="list"
          title={t('progress.sessions.emptyTitle')}
          description={t('progress.sessions.emptyBody')}
          actionLabel={t('progress.sessions.seeProgramme')}
          onAction={() => navigate({ name: 'programme' })}
        />
      </>
    );

  const now = new Date();
  const first = completed.map((l) => l.startedAt).sort()[0];
  const meta = first
    ? t('progress.sessions.meta', { count: completed.length, date: longDate(first, lang) })
    : undefined;

  const title = (weekStart: string): string => {
    const distance = weekDistance(weekStart, now);
    if (distance <= 0) return t('progress.sessions.thisWeek');
    if (distance === 1) return t('progress.sessions.lastWeek');
    const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number];
    return t('progress.sessions.weekOf', { date: longDate(new Date(y, m - 1, d), lang) });
  };

  const visible = groups.slice(0, shown);
  return (
    <>
      {bar(meta)}
      <div className={styles.hist}>
        {visible.map((group) => (
          <section key={group.weekStart} className={styles.grp}>
            <div className={styles.grpHead}>
              <h2 className={styles.grpTitle}>{title(group.weekStart)}</h2>
              <span className={styles.grpMeta}>
                {group.sessions > 0
                  ? t('progress.sessions.groupMeta', {
                      count: group.sessions,
                      time: timeText(group.activeSec),
                    })
                  : t('progress.sessions.groupMetaNone')}
              </span>
            </div>
            <PresenceList>
              {group.logs.map((log) => (
                <RowMotion key={log.id}>
                  <HistoryRow log={log} programmes={programmes} logs={logs} />
                </RowMotion>
              ))}
            </PresenceList>
          </section>
        ))}
        {visible.length < groups.length ? <div ref={sentinel} className={styles.sentinel} /> : null}
      </div>
    </>
  );
}
