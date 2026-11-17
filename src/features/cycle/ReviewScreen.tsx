import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { goBack, navigate, type Route } from '@/app/router';
import { nextSession } from '@/app/programme-state';
import { repo } from '@/db/repo';
import type { Language } from '@/domain';
import { pendingProposals } from '@/engine';
import { exerciseName } from '@/features/adapt';
import { DecisionsNudge, DecisionsSheet } from '@/features/programme/Decisions';
import { nudgeNames, orderProposals } from '@/features/programme/adaptation';
import { AppBar, Button, Dock, EmptyState, IconButton, Skeleton } from '@/ui/components';
import { NextCycleSheet } from './NextCycleSheet';
import { ProfileSection } from './ProfileSection';
import { ReviewBody } from './ReviewBody';
import { cycleNumber, isFinished } from './review';
import { useCycleData } from './useCycleData';
import styles from './ReviewScreen.module.css';

/** The cycle review: full screen, no tab bar. The primary starts the next cycle. */
export function ReviewScreen({ route }: { route: Extract<Route, { name: 'review' }> }) {
  const { t } = useTranslation();
  const data = useCycleData(route.programmeId);
  if (!data)
    return (
      <div className={styles.root}>
        <div className={styles.ctx}>
          <IconButton icon="close" label={t('cycle.review.close')} onClick={goBack} />
        </div>
        <div className={styles.skeleton}>
          <Skeleton height={144} radius="var(--radius-lg)" />
          <Skeleton height={96} radius="var(--radius-lg)" />
          <Skeleton height={76} radius="var(--radius-lg)" />
        </div>
      </div>
    );
  if (!data.record || !data.review)
    return (
      <>
        <AppBar title={t('cycle.review.missing')} onBack={goBack} backLabel={t('common.back')} />
        <EmptyState
          icon="file"
          title={t('cycle.review.missing')}
          description=""
          actionLabel={t('common.back')}
          onAction={() => navigate({ name: 'programme' }, { replace: true })}
        />
      </>
    );
  return <Review data={{ ...data, record: data.record, review: data.review }} />;
}

function Review({ data }: { data: Parameters<typeof ReviewBody>[0]['data'] }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const { record, logs, progress } = data;
  const cycle = cycleNumber(record);
  const live = record.status === 'active' && nextSession(record, logs).finished;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [decisions, setDecisions] = useState<ReturnType<typeof orderProposals> | null>(null);

  useEffect(() => {
    if (isFinished(record, logs) && !record.reviewSeenAt) void repo.markReviewSeen(record.id);
  }, [record, logs]);

  const ordered = useMemo(
    () =>
      live
        ? orderProposals(
            pendingProposals(record, record.weeks, progress).proposals,
            new Set<string>(),
          )
        : [],
    [live, record, progress],
  );
  const text = nudgeNames(ordered, new Set<string>(), (id) => exerciseName(id, lang));
  const ids = new Set(ordered.map((p) => p.exerciseId)).size;

  return (
    <div className={styles.root}>
      <div className={styles.ctx}>
        <IconButton icon="close" label={t('cycle.review.close')} onClick={goBack} />
        <span>
          {t('cycle.review.context', {
            programme: t(`labels.goal.${record.goal}`),
            n: cycle,
          })}
        </span>
      </div>
      <div className={styles.scroll}>
        <ReviewBody
          data={data}
          readOnly={!live}
          {...(live && { profileSection: <ProfileSection data={data} lang={lang} /> })}
          {...(live &&
            ordered.length > 0 && {
              decisions: (
                <div className={styles.decisions}>
                  <DecisionsNudge
                    count={ordered.length}
                    text={text}
                    onOpen={() => setDecisions(ordered)}
                  />
                  <p className={styles.openNote}>
                    {t('cycle.review.pain.openNote', { count: ids, next: cycle + 1 })}
                  </p>
                </div>
              ),
            })}
        />
      </div>
      {live ? (
        <Dock>
          <Button size="player" fullWidth onClick={() => setSheetOpen(true)}>
            {t('cycle.review.start', { next: cycle + 1 })}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => navigate({ name: 'profile' })}>
            {t('cycle.review.changeFirst')}
          </Button>
        </Dock>
      ) : null}
      <NextCycleSheet open={sheetOpen} onClose={() => setSheetOpen(false)} data={data} />
      <DecisionsSheet
        proposals={decisions ?? []}
        open={decisions !== null}
        logs={logs}
        inNext={new Set<string>()}
        onClose={() => setDecisions(null)}
      />
    </div>
  );
}
