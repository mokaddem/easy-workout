import { AnimatePresence, m } from 'motion/react';
import {
  EXIT_RATIO,
  PresenceList,
  Reposition,
  RowMotion,
  Swap,
  useMotionTokens,
  type RepositionAnchor,
} from '@/motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useActiveProgramme,
  useAnswers,
  useCheckIns,
  useCustomSessions,
  useEquipment,
  useMaxTests,
  useOpenSession,
  useProfile,
  useSessionLogs,
  useSettings,
} from '@/app/data';
import { nextSession, onlyConstraintsDiffer, programmeFreshness } from '@/app/programme-state';
import { usePendingProposals, usePreparedSession, useProgressContext } from '@/app/progress';
import { handleLinkClick, navigate, routeHref, type Route } from '@/app/router';
import type { Language, Phase } from '@/domain';
import {
  activeSwaps,
  activeTravelKit,
  checkInDue,
  cycleReview,
  daysSinceTraining,
  isPaused,
  lighterWeekSignal,
  missedTrainingDay,
  pausedDays,
  phaseForWeek,
  restartOffer,
  sessionForWeek,
  type LighterWeekSignal,
  type Proposal,
} from '@/engine';
import { constraintsRepo } from '@/db/constraints';
import { repo } from '@/db/repo';
import { AppBar, Button, Card, Icon, Skeleton, useToast } from '@/ui/components';
import { CheckInSheet } from '../checkin';
import { useBegin } from '../play/begin';
import { ResumeBanner } from '../play/components/ResumeBanner';
import { clearSummary } from '../play/lifecycle';
import { startProgrammeSession } from '../play/start';
import { exerciseName as adaptName, LimitationReviewCard, useLimitationReview } from '../adapt';
import { exerciseIds, nudgeNames, orderProposals } from './adaptation';
import { DecisionsNudge, DecisionsSheet } from './Decisions';
import { LimitsRow } from './LimitsRow';
import { hasConstraints } from './limits';
import { RestartCard } from './RestartCard';
import { WeekStrip } from './WeekStrip';
import { kitSummary } from './kitSummary';
import { reentryPosition } from './reentry';
import { restartDeclined, restartedProgramme } from './restart';
import { calendarDate, sessionDays, weekStrip } from './weekStrip';
import { cardZones } from './zones';
import { ChangePreviewSheet } from './ChangePreviewSheet';
import type { PreviewMode } from './preview';
import {
  exerciseCount,
  exerciseName,
  finisherCardio,
  phaseSlug,
  programmeIdentities,
} from './format';
import { OptionsMenu } from './OptionsMenu';
import { BackupBanner } from '../settings/BackupBanner';
import { useBackupReminder } from '../settings/useBackupReminder';
import { PhaseSheet } from './PhaseSheet';
import { ProgrammeWhySheet } from './ProgrammeWhySheet';
import { RotationGrid } from './RotationGrid';
import { placeState } from './edits';
import { CheckInSlot, CycleEndCard } from './CycleCards';
import { LighterWeekSheet, LighterWeekSlot } from './LighterWeek';
import { sessionTest } from './cycleTest';
import { dayMonth } from './testFormat';
import { equipmentGapCount, hasEquipmentGaps } from './why';
import styles from './Overview.module.css';

/** The programme tab: where the programme stands, what comes next, how the weeks are laid out. */
export function ProgrammeScreen({ route }: { route: Extract<Route, { name: 'programme' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const record = useActiveProgramme();
  const profile = useProfile();
  const equipment = useEquipment();
  const logs = useSessionLogs();
  const openSession = useOpenSession();
  const { begin, dialog: beginDialog } = useBegin();
  const settings = useSettings();
  const checkIns = useCheckIns();
  const maxTests = useMaxTests();
  const answers = useAnswers();
  const progressCtx = useProgressContext();
  const toast = useToast();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [now] = useState(() => new Date());

  const [preview, setPreview] = useState<PreviewMode | null>(
    route.preview === 'new' ? 'new' : null,
  );
  const [phase, setPhase] = useState<Phase | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const tokens = useMotionTokens();
  const nudgeAnchorRef = useRef<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const backup = useBackupReminder();
  const [decisions, setDecisions] = useState<Proposal[] | null>(null);

  const [lighterOpen, setLighterOpen] = useState<{
    signal: LighterWeekSignal;
    weeks: number;
  } | null>(null);
  const lighter = useMemo(
    () => (record && logs && answers ? lighterWeekSignal(record, logs, answers, now) : undefined),
    [record, logs, answers, now],
  );

  const customSessions = useCustomSessions();
  const reviewRegion = useLimitationReview();
  const paused = settings ? isPaused(settings) : false;
  const kit = settings ? activeTravelKit(settings, now) : undefined;
  const [restartHidden, setRestartHidden] = useState(false);
  const offer = useMemo(() => (logs ? restartOffer(logs, now) : undefined), [logs, now]);

  const current = record ? nextSession(record, logs) : null;
  const pending = usePendingProposals(record, current?.week);
  const prepared = usePreparedSession(record, current?.sessionId, current?.week, true);

  // A kit that ended says so once, and the home equipment is back.
  const expiredKit = settings?.travelKit && !kit ? settings.travelKit.until : undefined;
  useEffect(() => {
    if (!expiredKit) return;
    toast.show({ message: t('settings.travel.expired', { date: dayMonth(expiredKit, lang) }) });
    void constraintsRepo.endTravelKit(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiredKit]);

  const testCtx = useMemo(
    () =>
      progressCtx
        ? {
            ...progressCtx,
            ...(progressCtx.profile?.level && { level: progressCtx.profile.level }),
            ...(progressCtx.profile?.bodyweightKg !== undefined && {
              bodyweightKg: progressCtx.profile.bodyweightKg,
            }),
            maxTests: progressCtx.maxTests ?? [],
            // Away or easing back in after a long break: no test this session.
            ...(kit && { travel: true }),
            ...(prepared?.reentry !== undefined && { reentry: true }),
          }
        : undefined,
    [progressCtx, kit, prepared?.reentry],
  );
  const finished = record && current ? current.finished : false;
  const review = useMemo(() => {
    if (
      !record ||
      !profile ||
      !finished ||
      !logs ||
      !progressCtx ||
      !checkIns ||
      !maxTests ||
      !answers
    )
      return undefined;
    const done = logs.filter(
      (l) => l.source.kind === 'programme' && l.source.programmeId === record.id,
    );
    const until =
      record.endedAt ??
      done
        .map((l) => l.endedAt ?? l.startedAt)
        .sort()
        .pop() ??
      now.toISOString();
    return cycleReview(record, {
      logs,
      programmes: progressCtx.programmes,
      answers,
      maxTests,
      checkIns,
      level: profile.level,
      ...(profile.bodyweightKg !== undefined && { bodyweightKg: profile.bodyweightKg }),
      until,
    });
  }, [record, profile, finished, logs, progressCtx, checkIns, maxTests, answers, now]);

  // The preview URL only opens the sheet once.
  const [opened, setOpened] = useState(route.preview === 'new');
  if (route.preview === 'new' && !opened) {
    setOpened(true);
    setPreview('new');
  } else if (route.preview !== 'new' && opened) {
    setOpened(false);
  }
  useEffect(() => {
    if (route.preview === 'new') navigate({ name: 'programme' }, { replace: true });
  }, [route.preview]);

  if (!record || !profile || !equipment)
    return (
      <>
        <AppBar title={t('nav.programme')} />
        <div className={styles.hero} aria-busy="true">
          <Skeleton height={140} radius="var(--radius-lg)" />
          <Skeleton height={48} />
        </div>
      </>
    );

  const position = nextSession(record, logs);
  const plan = sessionForWeek(record, position.sessionId, position.week);
  const identities = programmeIdentities(record, lang);
  const identity = identities[position.index]!;
  const currentPhase = phaseForWeek(record, position.week);
  const slug = currentPhase ? phaseSlug(currentPhase.name.en) : null;
  const freshness = programmeFreshness(record, profile, equipment);
  const constraintsOnly = onlyConstraintsDiffer(record, profile, equipment);
  const notes = record.generation?.notes ?? [];
  const cardioDays = record.rotation.filter((_, i) => identities[i]!.cardio).length;
  const sessions = record.rotation.length - cardioDays;
  const shown = prepared?.session ?? plan.session;
  const cardio = finisherCardio(shown);
  const testView =
    record && testCtx && !position.finished
      ? sessionTest(record, position.sessionId, position.week, testCtx)
      : undefined;
  const runsTest = testView?.kind === 'run' ? testView : undefined;
  const cycle = record.generation?.cycle ?? 1;
  const due =
    settings && checkIns && logs
      ? checkInDue(checkIns, settings, logs, now) && !openSession
      : false;
  const lastCheckIn =
    checkIns && checkIns.length > 0
      ? [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0]
      : undefined;
  const daysSince = lastCheckIn
    ? Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(`${lastCheckIn.date}T12:00:00`)) / 86_400_000),
      )
    : undefined;
  const hideCheckIn = async () => {
    const previous = settings?.checkInDismissedAt;
    await repo.dismissCheckIn();
    const until = new Date(Date.now() + 7 * 86_400_000);
    toast.show({
      message: t('programme.checkin.hidden', { date: dayMonth(until.toISOString(), lang) }),
      action: {
        label: t('programme.checkin.undo'),
        onAction: () => {
          void (async () => {
            const { checkInDismissedAt: _drop, ...rest } = await repo.getSettings(lang);
            await repo.saveSettings({ ...rest, ...(previous && { checkInDismissedAt: previous }) });
          })();
        },
      },
    });
  };
  const buyNext = pending?.buyNext ?? [];
  const gapCount = (hasEquipmentGaps(notes) ? equipmentGapCount(notes) : 0) + buyNext.length;
  const gaps = gapCount > 0;
  const inNext = prepared ? exerciseIds(prepared.session) : new Set<string>();
  const ordered = orderProposals(pending?.proposals ?? [], inNext);
  const nudgeText = nudgeNames(ordered, inNext, (id) => adaptName(id, lang));
  const nudgeAnchor: RepositionAnchor = nudgeAnchorRef;
  // Its slot depends on the pending proposals: nothing shows until they have loaded.
  const equipmentNudge =
    gaps && pending ? (
      <Reposition anchorRef={nudgeAnchor}>
        <a
          className={styles.nudge}
          href={routeHref({ name: 'equipment' })}
          onClick={(event) => handleLinkClick(event, routeHref({ name: 'equipment' }))}
        >
          <span className={styles.well}>
            <Icon name="bag" size={24} />
          </span>
          <span className={styles.nudgeText}>
            <span className={styles.nudgeTitle}>
              {buyNext.length > 0
                ? t('adapt.programme.equipmentNudge', { count: gapCount })
                : t('programme.nudge.title', { count: gapCount })}
            </span>
            <span className={styles.nudgeSub}>{t('programme.nudge.sub')}</span>
          </span>
          <Icon name="chev-right" size={20} />
        </a>
      </Reposition>
    ) : null;
  const trainingDays = settings?.trainingDays;
  const calendar = trainingDays && trainingDays.length > 0 ? trainingDays : undefined;
  const dayOf = calendar
    ? sessionDays({
        trainingDays: calendar,
        now,
        logs: logs ?? [],
        next: position.index,
        size: record.rotation.length,
      })
    : undefined;
  const nextDay = dayOf?.[position.index];
  const missed =
    calendar && !paused && !position.finished && settings && logs
      ? missedTrainingDay({
          trainingDays: calendar,
          now,
          logs,
          programmeStart: record.startedAt ?? record.createdAt ?? now.toISOString(),
          ...(settings.missedDayDismissedAt && { dismissedAt: settings.missedDayDismissedAt }),
        })
      : undefined;
  const dayName = (iso: string, weekday: 'long' | 'short') =>
    new Intl.DateTimeFormat(lang, { weekday }).format(calendarDate({ date: iso, weekday: 'mon' }));
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nextLabel =
    nextDay && !paused
      ? nextDay.date === todayKey
        ? t('programme.next.today')
        : t('programme.next.on', {
            weekday: dayName(nextDay.date, 'long'),
            day: Number(nextDay.date.slice(8)),
          })
      : t('programme.next.label');
  const strip =
    calendar && !paused && !position.finished && logs
      ? weekStrip({
          trainingDays: calendar,
          now,
          logs,
          next: position.index,
          size: record.rotation.length,
        })
      : null;
  const staleBanner = freshness !== 'current' && !bannerDismissed;
  const zones = cardZones({
    paused,
    finished: position.finished,
    restart:
      offer !== undefined &&
      !restartHidden &&
      !restartDeclined(offer.lastAt, settings?.restartDeclinedAt),
    outOfDate: staleBanner,
    backup: backup.reminder !== 'none',
    lighterWeek: lighter !== undefined,
    limitationReview: reviewRegion !== undefined,
    checkIn: Boolean(due),
  });
  const rowDate = (iso: string) =>
    new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(
      calendarDate({ date: iso, weekday: 'mon' }),
    );
  const reentry = prepared?.reentry;
  const travel = kit ? prepared?.travel : undefined;
  const sessionLabel = (letter: string | undefined) =>
    letter ? t('settings.days.session', { letter }) : t('settings.days.cardio');
  const resume = () => {
    void constraintsRepo.resumeProgramme(lang).then(() => {
      toast.show({
        message: t(
          nextDay?.date === todayKey ? 'programme.paused.resumedToday' : 'programme.paused.resumed',
          {
            session: sessionLabel(identity.letter),
            ...(nextDay && { when: dayName(nextDay.date, 'long') }),
          },
        ),
      });
    });
  };
  const pauseNow = () => {
    void constraintsRepo.pauseProgramme(new Date(), lang).then(() => {
      toast.show({
        message: t('programme.paused.toast'),
        action: {
          label: t('programme.checkin.undo'),
          onAction: () => void constraintsRepo.resumeProgramme(lang),
        },
      });
    });
  };
  const restart = async () => {
    if (!profile || !equipment) return;
    const next = restartedProgramme(record, profile, equipment, {
      customIds: new Set((customSessions ?? []).map((c) => c.id)),
      painful: activeSwaps(answers ?? []).painful,
      logs: logs ?? [],
    });
    await repo.activateProgramme(next);
    setRestartHidden(true);
    toast.show({ message: t('programme.restart.done') });
  };
  const carryOn = () => {
    if (!offer) return;
    void repo.updateSettings({ restartDeclinedAt: new Date().toISOString() }, lang);
    setRestartHidden(true);
    toast.show({ message: t('programme.restart.carried') });
  };
  const pausedSince = settings?.pause ? dayMonth(settings.pause.since, lang) : '';
  const gap = logs ? daysSinceTraining(logs, now) : undefined;
  const whyOnce = !record.whySeen;
  const openIsNext =
    openSession?.source.kind === 'programme' &&
    openSession.source.programmeId === record.id &&
    openSession.source.sessionId === position.sessionId;

  const dismissWhy = () => void repo.markWhySeen(record.id);
  const openWhy = () => {
    setWhyOpen(true);
    if (whyOnce) dismissWhy();
  };

  const baseMeta =
    cardioDays > 0
      ? t('programme.meta.withCardio', {
          weeks: record.weeks,
          count: sessions,
          cardio: cardioDays,
        })
      : t('programme.meta.plain', { weeks: record.weeks, count: sessions });

  const reasons = [
    { icon: 'calendar', text: t('programme.whyCard.schedule', { count: sessions, sessions }) },
    {
      icon: 'gauge',
      text: t('programme.whyCard.goal', {
        goal: t(`labels.goal.${record.goal}`).toLocaleLowerCase(lang),
      }),
    },
    {
      icon: 'user',
      text:
        equipment.length === 0
          ? t('programme.whyCard.bodyweight')
          : t('programme.whyCard.equipment'),
    },
  ] as const;

  return (
    <>
      <AppBar
        title={record.name[lang]}
        meta={cycle > 1 ? t('programme.meta.cycle', { cycle, meta: baseMeta }) : baseMeta}
        actions={
          <OptionsMenu
            actions={[
              {
                id: 'variant',
                icon: 'shuffle',
                label: t('programme.menu.variant'),
                hint: t('programme.menu.variantHint'),
                onSelect: () => setPreview('variant'),
              },
              paused
                ? {
                    id: 'resume',
                    icon: 'play',
                    label: t('programme.menu.resume'),
                    onSelect: resume,
                  }
                : {
                    id: 'pause',
                    icon: 'pause',
                    label: t('programme.menu.pause'),
                    hint: t('programme.menu.pauseHint'),
                    onSelect: pauseNow,
                  },
              {
                id: 'travel',
                icon: 'suitcase',
                label: t('programme.menu.travel'),
                hint: t('settings.travel.menuHint'),
                onSelect: () => navigate({ name: 'travel' }),
              },
              {
                id: 'profile',
                icon: 'user',
                label: t('programme.menu.profile'),
                onSelect: () => navigate({ name: 'profile' }),
              },
              {
                id: 'equipment',
                icon: 'dumbbell',
                label: t('programme.menu.equipment'),
                onSelect: () => navigate({ name: 'equipment' }),
              },
            ]}
          />
        }
      />
      <div className={styles.scroll}>
        {openSession ? <ResumeBanner log={openSession} /> : null}
        <AnimatePresence initial={false}>
          {whyOnce ? (
            <m.div
              key="why"
              exit={{
                height: 0,
                opacity: 0,
                overflow: 'hidden',
                transition: tokens.reduced
                  ? {
                      opacity: { duration: tokens.duration.fast, ease: tokens.ease.move },
                      height: { duration: 0, delay: tokens.duration.fast },
                    }
                  : { duration: tokens.duration.base * EXIT_RATIO, ease: tokens.ease.exit },
              }}
            >
              <Card as="section" className={styles.card} aria-labelledby="why-card-title">
                <h2 className={styles.cardTitle} id="why-card-title">
                  {t('programme.whyCard.title')}
                </h2>
                <ul className={styles.whyList}>
                  {reasons.map((reason) => (
                    <li key={reason.icon}>
                      <Icon name={reason.icon} />
                      <span>{reason.text}</span>
                    </li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  <Button variant="secondary" onClick={openWhy}>
                    {t('programme.whyCard.all')}
                  </Button>
                  <Button variant="ghost" onClick={dismissWhy}>
                    {t('programme.whyCard.gotIt')}
                  </Button>
                </div>
              </Card>
            </m.div>
          ) : null}
        </AnimatePresence>

        <PresenceList>
          {zones.banner === 'restart' && offer ? (
            <RowMotion key="restart" leave="dismiss">
              <div className={styles.invite}>
                <RestartCard
                  days={offer.days}
                  lastAt={offer.lastAt}
                  week={position.week}
                  sessions={record.sessionsPerWeek}
                  onRestart={restart}
                  onCarry={carryOn}
                />
              </div>
            </RowMotion>
          ) : null}

          {zones.banner === 'out-of-date' ? (
            <RowMotion key="out-of-date" leave="dismiss">
              <section className={styles.banner} aria-labelledby="stale-title">
                <div className={styles.bannerHead}>
                  <span className={styles.well}>
                    <Icon name="refresh" size={24} />
                  </span>
                  <div className={styles.bannerText}>
                    <h2 className={styles.bannerTitle} id="stale-title">
                      {t('programme.banner.title')}
                    </h2>
                    <p className={styles.muted}>
                      {t(
                        freshness === 'needs-new'
                          ? 'programme.banner.needsNew'
                          : constraintsOnly
                            ? 'programme.banner.constraints'
                            : 'programme.banner.outOfDate',
                      )}
                    </p>
                  </div>
                </div>
                <div className={styles.bannerActions}>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setPreview(constraintsOnly ? 'constraints' : 'new')}
                  >
                    {t(constraintsOnly ? 'programme.banner.apply' : 'programme.banner.generate')}
                  </Button>
                  <Button variant="ghost" onClick={() => setBannerDismissed(true)}>
                    {t('programme.banner.keep')}
                  </Button>
                </div>
              </section>
            </RowMotion>
          ) : null}

          {/* Banner priority: resume, then restart, out of date and backup: one of those at most. */}
          {zones.banner === 'backup' ? (
            <RowMotion key="backup" leave="dismiss">
              <BackupBanner state={backup} />
            </RowMotion>
          ) : null}
        </PresenceList>

        <section
          className={`${styles.hero} ${paused && !position.finished ? styles.heroPaused : ''}`}
        >
          <div
            className={styles.heroWeek}
            role="img"
            aria-label={t(position.finished ? 'programme.hero.weekDone' : 'programme.hero.weekOf', {
              week: position.week,
              total: record.weeks,
            })}
          >
            <span className={styles.heroLabel}>{t('programme.hero.week')}</span>
            <span className={styles.heroRow}>
              <span className={`${styles.num} ${styles.heroN}`}>{position.week}</span>
              <span className={`${styles.num} ${styles.heroOf}`}>
                {t('programme.hero.of', { total: record.weeks })}
              </span>
            </span>
          </div>
          <div className={styles.segs} aria-hidden="true">
            {Array.from({ length: record.weeks }, (_, i) => (
              <i
                key={i}
                className={
                  i + 1 < position.week || position.finished
                    ? styles.done
                    : i + 1 === position.week
                      ? styles.cur
                      : ''
                }
              />
            ))}
          </div>
          <Swap id={paused && !position.finished ? 'paused' : position.finished ? 'done' : 'phase'}>
            {paused && !position.finished ? (
              <div className={styles.heroPhase}>
                <h2 className={`${styles.phaseTitle} ${styles.pausedTitle}`}>
                  <Icon name="pause" size={28} />
                  {t('programme.paused.title')}
                </h2>
                <p className={styles.muted}>
                  {t(
                    pausedDays(settings!, now) === 0
                      ? 'programme.paused.lineToday'
                      : 'programme.paused.line',
                    {
                      count: pausedDays(settings!, now),
                      date: pausedSince,
                      week: position.week,
                      session: sessionLabel(identity.letter),
                    },
                  )}
                </p>
                {gap !== undefined && gap > 28 ? (
                  <p className={styles.muted}>
                    {t('programme.paused.reentry', {
                      weeks: Math.floor(gap / 7),
                      count: record.sessionsPerWeek,
                    })}
                  </p>
                ) : null}
                <Button size="player" fullWidth icon="play" onClick={resume}>
                  {t('programme.paused.resume')}
                </Button>
              </div>
            ) : position.finished ? (
              <div className={styles.heroPhase}>
                <h2 className={styles.phaseTitle}>{t('programme.hero.cycleDone')}</h2>
                <p className={styles.muted}>
                  {record.reviewSeenAt && review?.sessions.last
                    ? t('programme.hero.cycleWaiting', {
                        count: Math.max(
                          0,
                          Math.floor(
                            (now.getTime() - Date.parse(review.sessions.last)) / 86_400_000,
                          ),
                        ),
                      })
                    : t(
                        record.reviewSeenAt
                          ? 'programme.hero.cycleDoneSeen'
                          : 'programme.hero.cycleDoneLine',
                      )}
                </p>
              </div>
            ) : currentPhase ? (
              <div className={styles.heroPhase}>
                <h2 className={styles.phaseTitle}>
                  {t('programme.hero.phase', {
                    // "Phase réadaptation" / "Re-adaptation phase": the name only opens the line in English.
                    name:
                      lang === 'fr'
                        ? currentPhase.name.fr.toLocaleLowerCase('fr')
                        : currentPhase.name.en,
                  })}
                </h2>
                {slug ? (
                  <p className={styles.muted}>{t(`programme.phase.${slug}.summary`)}</p>
                ) : null}
              </div>
            ) : (
              <h2 className={styles.phaseTitle}>{t('nav.programme')}</h2>
            )}
          </Swap>
        </section>

        <AnimatePresence initial={false}>
          {ordered.length > 0 ? (
            <m.div
              key="decisions"
              exit={{
                height: 0,
                opacity: 0,
                overflow: 'hidden',
                transition: tokens.reduced
                  ? {
                      opacity: { duration: tokens.duration.fast, ease: tokens.ease.move },
                      height: { duration: 0, delay: tokens.duration.fast },
                    }
                  : { duration: tokens.duration.base * EXIT_RATIO, ease: tokens.ease.exit },
              }}
            >
              <DecisionsNudge
                count={ordered.length}
                text={nudgeText}
                onOpen={() => setDecisions(ordered)}
              />
            </m.div>
          ) : null}
        </AnimatePresence>
        {ordered.length === 0 ? equipmentNudge : null}

        {position.finished && !openIsNext ? (
          <CycleEndCard
            programmeId={record.id}
            cycle={cycle}
            seen={Boolean(record.reviewSeenAt)}
            {...(review?.sessions.first && { first: review.sessions.first })}
            {...(review?.sessions.last && { last: review.sessions.last })}
            {...(review?.test && { test: review.test })}
            resuming={Boolean(openSession)}
          />
        ) : (
          <Card as="article" className={`${styles.card} ${styles.next}`}>
            <div>
              <p
                className={`${styles.nextLabel} ${nextDay?.date === todayKey && !paused ? styles.nextToday : ''}`}
              >
                {nextLabel}
              </p>
              <h2 className={styles.nextTitle}>{identity.fullName}</h2>
              {plan.session.focus ? (
                <p className={styles.nextMuscles}>{plan.session.focus[lang]}</p>
              ) : null}
            </div>
            {missed ? (
              <div className={styles.noteLine}>
                <Icon name="calendar" size={20} />
                <span>{t('programme.missed.line', { weekday: dayName(missed.date, 'long') })}</span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void repo.updateSettings({ missedDayDismissedAt: now.toISOString() }, lang)
                  }
                >
                  {t('programme.missed.ok')}
                </Button>
              </div>
            ) : null}
            <ul className={styles.facts}>
              <li>
                <Icon name="clock" size={20} />
                <span>
                  ~{shown.estimatedMinutes + (runsTest ? 5 : 0)} {t('labels.unit.min')}
                </span>
              </li>
              {exerciseCount(shown) > 0 ? (
                <li>
                  <Icon name="list" size={20} />
                  <span>
                    {t('programme.session.exercisesCount', { count: exerciseCount(shown) })}
                  </span>
                </li>
              ) : null}
              {runsTest ? (
                <li>
                  <Icon name="target" size={20} />
                  <span>
                    {t(
                      runsTest.placement === 'end'
                        ? 'programme.next.testFact'
                        : 'programme.next.testFactFirst',
                      { name: exerciseName(runsTest.exerciseId, lang) },
                    )}
                  </span>
                </li>
              ) : null}
              {reentry !== undefined ? (
                <li>
                  <Icon name="hourglass" size={20} />
                  <span>
                    {t('programme.restart.fact', {
                      n: reentryPosition(logs ?? []),
                      count: record.sessionsPerWeek,
                    })}
                  </span>
                </li>
              ) : null}
              {cardio ? (
                <li>
                  <Icon name="incline" size={20} />
                  <span>
                    {exerciseName(cardio.exerciseId, lang)}, {cardio.minutes} {t('labels.unit.min')}
                  </span>
                </li>
              ) : null}
            </ul>
            <PresenceList>
              {kit && settings?.travelKit ? (
                <RowMotion key="kit" gap={16} leave="dismiss">
                  <div className={styles.noteLine}>
                    <Icon name="suitcase" size={20} />
                    <span>
                      {t('programme.kit.line', {
                        until: t('programme.kit.until', {
                          date: dayMonth(settings.travelKit.until, lang, 'short').replace(
                            ' ',
                            '\u00A0',
                          ),
                        }),
                        what: kitSummary(t, travel),
                      })}
                    </span>
                    <Button variant="secondary" onClick={() => navigate({ name: 'travel' })}>
                      {t('programme.kit.manage')}
                    </Button>
                  </div>
                </RowMotion>
              ) : null}
            </PresenceList>
            <Button
              size="player"
              fullWidth
              icon="play"
              variant={openSession || paused ? 'secondary' : 'primary'}
              onClick={() => {
                if (openSession && openIsNext) {
                  clearSummary();
                  navigate({ name: 'play' });
                  return;
                }
                void begin(() => startProgrammeSession(record, equipment), identity.fullName);
              }}
              disabled={position.finished && !openIsNext}
            >
              {t(openIsNext ? 'programme.resumeSession' : 'programme.start')}
            </Button>
            <PresenceList>
              {paused ? (
                <RowMotion key="start-note" gap={16} leave="dismiss">
                  <p className={styles.startNote}>
                    <Icon name="info" size={20} />
                    <span>{t('programme.paused.startNote')}</span>
                  </p>
                </RowMotion>
              ) : null}
            </PresenceList>
            <Button
              variant="ghost"
              onClick={() => navigate({ name: 'session', sessionId: position.sessionId })}
            >
              {t('programme.next.details')}
            </Button>
          </Card>
        )}
        {/* One invitation under the next session: lighter week, limitation review, check-in. */}
        <LighterWeekSlot
          signal={zones.invitation === 'lighter-week' ? lighter : undefined}
          onOpen={() => lighter && setLighterOpen({ signal: lighter, weeks: record.weeks })}
          onLater={() => void repo.dismissLighterWeek(record.id)}
        />
        <PresenceList>
          {zones.invitation === 'limitation-review' && reviewRegion ? (
            <RowMotion key="limitation-review" leave="dismiss">
              <div className={styles.invite}>
                <LimitationReviewCard region={reviewRegion} />
              </div>
            </RowMotion>
          ) : null}
        </PresenceList>
        <CheckInSlot
          show={zones.invitation === 'check-in'}
          daysSince={daysSince}
          onOpen={() => setCheckInOpen(true)}
          onLater={() => void hideCheckIn()}
        />

        {strip ? <WeekStrip cells={strip} identities={identities} lang={lang} /> : null}

        <PresenceList>
          {hasConstraints(profile) ? (
            <RowMotion key="limits">
              <LimitsRow programme={record} profile={profile} />
            </RowMotion>
          ) : null}
        </PresenceList>

        {ordered.length > 0 ? equipmentNudge : null}

        <section className={styles.rot} aria-labelledby="rot-title">
          <div>
            <h2 className={styles.heading} id="rot-title">
              {t('programme.rotation.title')}
            </h2>
            <p className={styles.small}>{t('programme.rotation.intro')}</p>
          </div>
          <RotationGrid
            programme={record}
            position={
              position.finished ? { ...position, week: record.weeks + 1, index: 0 } : position
            }
            onPhase={setPhase}
          />
        </section>

        <section className={styles.list} aria-labelledby="slist-title">
          <h2 className={styles.heading} id="slist-title">
            {t('programme.sessions.title')}
          </h2>
          <div className={styles.rows}>
            {record.rotation.map((session, i) => {
              const id = identities[i]!;
              const state = placeState(record, session.id);
              const href = routeHref({ name: 'session', sessionId: session.id });
              return (
                <a
                  key={session.id}
                  className={styles.row}
                  href={href}
                  onClick={(event) => handleLinkClick(event, href)}
                >
                  <span
                    className={`${styles.rowId} ${state.kind === 'placed' ? styles.rowIdMine : ''}`}
                  >
                    {id.letter ? (
                      <span className={styles.num}>{id.letter}</span>
                    ) : (
                      <Icon name="heart" size={24} />
                    )}
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{id.title}</span>
                    <span className={styles.rowMeta}>
                      {state.kind === 'placed'
                        ? t('programme.sessions.mineMeta', {
                            minutes: session.estimatedMinutes,
                            name: state.generatedName[lang],
                          })
                        : state.kind === 'edited'
                          ? t('programme.sessions.editedMeta', {
                              minutes: session.estimatedMinutes,
                            })
                          : `${
                              dayOf?.[i] && !paused && !position.finished
                                ? `${rowDate(dayOf[i]!.date)}, `
                                : ''
                            }~${session.estimatedMinutes} ${t('labels.unit.min')}`}
                    </span>
                  </span>
                  <Icon name="chev-right" size={20} />
                </a>
              );
            })}
          </div>
        </section>
      </div>

      <PhaseSheet
        programme={record}
        phase={phase}
        currentWeek={position.week}
        onClose={() => setPhase(null)}
      />
      <DecisionsSheet
        proposals={decisions ?? []}
        open={decisions !== null}
        logs={logs}
        inNext={inNext}
        onClose={() => setDecisions(null)}
      />
      <LighterWeekSheet
        programmeId={record.id}
        weeks={lighterOpen?.weeks ?? record.weeks}
        signal={lighterOpen?.signal}
        onClose={() => setLighterOpen(null)}
      />
      <ProgrammeWhySheet programme={record} open={whyOpen} onClose={() => setWhyOpen(false)} />
      {beginDialog}
      <CheckInSheet
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSaved={() => toast.show({ message: t('checkin.saved') })}
      />
      <ChangePreviewSheet
        mode={preview}
        current={record}
        profile={profile}
        equipment={equipment}
        onClose={() => setPreview(null)}
        onEquipment={() => {
          setPreview(null);
          navigate({ name: 'equipment' });
        }}
      />
    </>
  );
}
