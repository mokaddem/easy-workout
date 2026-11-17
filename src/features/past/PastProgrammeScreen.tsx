import { useTranslation } from 'react-i18next';
import { useProgrammes, useSessionLogs } from '@/app/data';
import { goBack, handleLinkClick, navigate, routeHref, type Route } from '@/app/router';
import type { ProgrammeRecord } from '@/db';
import type { Language, SessionLog } from '@/domain';
import { ReviewBody } from '@/features/cycle/ReviewBody';
import { countedLogs, cycleNumber, isFinished } from '@/features/cycle/review';
import { useCycleData } from '@/features/cycle/useCycleData';
import { RotationGrid } from '@/features/programme/RotationGrid';
import { programmeIdentities } from '@/features/programme/format';
import { AppBar, EmptyState, Icon, SegmentedControl, Skeleton } from '@/ui/components';
import styles from './Past.module.css';

type View = 'review' | 'sessions';

/** A past programme: its review (finished cycles) and its sessions, read-only. */
export function PastProgrammeScreen({
  route,
}: {
  route: Extract<Route, { name: 'past-programme' }>;
}) {
  const { t } = useTranslation();
  const programmes = useProgrammes();
  const logs = useSessionLogs();
  const record = programmes?.find((p) => p.id === route.programmeId);
  if (!programmes || !logs)
    return (
      <>
        <AppBar title="" onBack={goBack} backLabel={t('cycle.past.backList')} />
        <div className={styles.sec}>
          <Skeleton height={144} radius="var(--radius-lg)" />
        </div>
      </>
    );
  if (!record)
    return (
      <>
        <AppBar
          title={t('cycle.past.title')}
          onBack={goBack}
          backLabel={t('cycle.past.backList')}
        />
        <EmptyState icon="file" title={t('cycle.review.missing')} description="" />
      </>
    );
  return <Loaded route={route} record={record} logs={logs} />;
}

function Loaded({
  route,
  record,
  logs,
}: {
  route: Extract<Route, { name: 'past-programme' }>;
  record: ProgrammeRecord;
  logs: SessionLog[];
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const finished = isFinished(record, logs);
  const view: View = finished && route.view !== 'sessions' ? 'review' : 'sessions';
  const ended = record.endedAt
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
        day: 'numeric',
        month: 'long',
      }).format(new Date(record.endedAt))
    : undefined;
  const title = t('cycle.past.viewTitle', {
    programme: t(`labels.goal.${record.goal}`),
    n: cycleNumber(record),
  });
  const meta = ended
    ? t(finished ? 'cycle.past.finishedOn' : 'cycle.past.replacedOn', { date: ended })
    : undefined;
  return (
    <>
      <AppBar
        title={title}
        {...(meta && { meta })}
        onBack={goBack}
        backLabel={t('cycle.past.backList')}
      />
      {finished ? (
        <div className={styles.tabs}>
          <SegmentedControl<View>
            label={t('cycle.past.view')}
            value={view}
            options={[
              { value: 'review', label: t('cycle.past.tabReview') },
              { value: 'sessions', label: t('cycle.past.tabSessions') },
            ]}
            onChange={(next) =>
              navigate(
                {
                  name: 'past-programme',
                  programmeId: record.id,
                  ...(next === 'sessions' && { view: 'sessions' as const }),
                },
                { replace: true },
              )
            }
          />
        </div>
      ) : ended ? (
        <p className={styles.notice}>
          <Icon name="info" size={20} />
          <span>{t('cycle.past.replacedNotice', { date: ended })}</span>
        </p>
      ) : null}
      {view === 'review' ? (
        <ReviewTab programmeId={record.id} />
      ) : (
        <Sessions record={record} logs={logs} finished={finished} lang={lang} />
      )}
    </>
  );
}

function ReviewTab({ programmeId }: { programmeId: string }) {
  const data = useCycleData(programmeId);
  if (!data || !data.record || !data.review)
    return (
      <div className={styles.sec}>
        <Skeleton height={144} radius="var(--radius-lg)" />
        <Skeleton height={96} radius="var(--radius-lg)" />
      </div>
    );
  return (
    <div className={styles.reviewPad}>
      <ReviewBody data={{ ...data, record: data.record, review: data.review }} readOnly />
    </div>
  );
}

function Sessions({
  record,
  logs,
  finished,
  lang,
}: {
  record: ProgrammeRecord;
  logs: SessionLog[];
  finished: boolean;
  lang: Language;
}) {
  const { t } = useTranslation();
  const identities = programmeIdentities(record, lang);
  const counted = countedLogs(record, logs);
  return (
    <>
      {finished ? (
        <section className={styles.sec}>
          <RotationGrid
            programme={record}
            // One week past the last: every cell reads as done, none as next.
            position={{ week: record.weeks + 1, index: 0, sessionId: '', finished: true }}
          />
        </section>
      ) : null}
      <section className={styles.sec}>
        <h2 className={styles.secTitle}>{t('cycle.past.sessionsTitle')}</h2>
        <div className={styles.srows}>
          {record.rotation.map((session, i) => {
            const mine = counted.filter(
              (l) => l.source.kind === 'programme' && l.source.sessionId === session.id,
            );
            const last = mine.at(-1);
            const identity = identities[i]!;
            const href = routeHref({
              name: 'past-session',
              programmeId: record.id,
              sessionId: session.id,
            });
            return (
              <a
                key={session.id}
                className={styles.srow}
                href={href}
                onClick={(event) => handleLinkClick(event, href)}
              >
                <span className={styles.srowId}>
                  {identity.letter ? (
                    <span className={styles.num}>{identity.letter}</span>
                  ) : (
                    <Icon name="heart" />
                  )}
                </span>
                <span className={styles.srowText}>
                  <span className={styles.srowName}>{identity.title}</span>
                  <span className={styles.srowMeta}>
                    {last
                      ? t('cycle.past.sessionMeta', {
                          count: mine.length,
                          date: new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
                            day: 'numeric',
                            month: 'short',
                          }).format(new Date(last.startedAt)),
                        })
                      : t('cycle.past.sessionNever')}
                  </span>
                </span>
                <Icon name="chev-right" size={20} />
              </a>
            );
          })}
        </div>
      </section>
    </>
  );
}
