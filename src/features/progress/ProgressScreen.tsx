import { isCooldownLog } from '@/domain';
import { useTranslation } from 'react-i18next';
import {
  useActiveProgramme,
  useCheckIns,
  useMaxTests,
  useProgrammes,
  useSessionLogs,
} from '@/app/data';
import { navigate } from '@/app/router';
import {
  activeSeconds,
  calendarWeekActivity,
  exerciseList,
  highlights,
  phaseForWeek,
  programmeWeekSets,
} from '@/engine';
import { Button, CycleStrip, Dock, Icon, Skeleton } from '@/ui/components';
import { Rich } from '../adapt';
import { repsText, secondsText, exerciseName } from '../adapt/format';
import { programmeIdentities } from '../programme/format';
import { HighlightList } from './components/HighlightList';
import { MeterList } from './components/MeterList';
import { NavRow } from './components/NavRow';
import { cycleProgress, slotsLeft } from './cycle';
import {
  activeParts,
  agoText,
  langOf,
  listText,
  longDate,
  timeText,
  weekRangeText,
} from './format';
import styles from './ProgressScreen.module.css';

/** The Progress tab: this week, the cycle, what moved up, and the way into each part of the history. */
export function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const logs = useSessionLogs();
  const programmes = useProgrammes();
  const record = useActiveProgramme();
  const tests = useMaxTests();
  const checkIns = useCheckIns();
  const now = new Date();

  if (!logs || !programmes || record === undefined || !tests || !checkIns)
    return (
      <div className={styles.page} aria-busy="true">
        <h1 className={styles.display}>{t('progress.title')}</h1>
        <div className={styles.skeleton}>
          <div className={styles.skeletonRow}>
            <Skeleton width={96} height={74} />
            <Skeleton width={150} height={74} />
          </div>
          <Skeleton height={110} radius="var(--radius-lg)" />
          <Skeleton height={68} />
          <Skeleton height={68} />
          <Skeleton height={68} />
        </div>
      </div>
    );

  // A cooldown is stretching, not training: it never shows as a session.
  const completed = logs.filter((l) => l.status === 'completed' && !isCooldownLog(l));
  const lastTest = [...tests].filter((x) => !x.stopped).sort((a, b) => b.at.localeCompare(a.at))[0];
  const lastCheckIn = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
  const exercisesDone = exerciseList(logs, programmes).length;
  const past = programmes.filter((p) => p.status !== 'active').length;

  const bodyRow = (
    <NavRow
      icon="scale"
      title={t('progress.nav.body.title')}
      meta={
        lastCheckIn
          ? t('progress.nav.body.meta', {
              when: agoText(new Date(`${lastCheckIn.date}T12:00:00`), now, lang),
            })
          : t('progress.nav.body.none')
      }
      onClick={() => navigate({ name: 'body' })}
    />
  );
  const testsRow = (
    <NavRow
      icon="target"
      title={t('progress.nav.tests.title')}
      meta={
        lastTest
          ? t('progress.nav.tests.meta', {
              name: exerciseName(lastTest.exerciseId, lang),
              value:
                lastTest.result.kind === 'reps'
                  ? repsText(t, lastTest.result.reps)
                  : secondsText(lastTest.result.seconds, lang),
              date: longDate(lastTest.at, lang),
            })
          : t('progress.nav.tests.none')
      }
      onClick={() => navigate({ name: 'tests' })}
    />
  );

  if (completed.length === 0) {
    const ghostWeeks = Array.from({ length: record?.weeks ?? 8 }, (_, w) => ({
      label: t('progress.weekShort', { week: w + 1 }),
      cells: Array.from({ length: record?.sessionsPerWeek ?? 4 }, () => 'later' as const),
    }));
    return (
      <>
        <div className={styles.page}>
          <h1 className={styles.display}>{t('progress.title')}</h1>
          <CycleStrip weeks={ghostWeeks} ghost />
          <div className={styles.emptyText}>
            <h2 className={styles.emptyTitle}>{t('progress.empty.title')}</h2>
            <p className={styles.muted}>{t('progress.empty.body')}</p>
          </div>
          <section className={styles.sec} style={{ gap: 4 }}>
            <h2 className={styles.secTitle}>{t('progress.empty.already')}</h2>
            <div className={styles.nav}>
              {bodyRow}
              {testsRow}
              {past > 0 ? (
                <NavRow
                  icon="file"
                  title={t('progress.nav.past.title')}
                  meta={t('progress.nav.past.meta', { count: past })}
                  onClick={() => navigate({ name: 'past' })}
                />
              ) : null}
            </div>
          </section>
        </div>
        <Dock>
          <Button size="player" fullWidth onClick={() => navigate({ name: 'programme' })}>
            {t('progress.seeNext')}
          </Button>
        </Dock>
      </>
    );
  }

  const week = calendarWeekActivity(logs, now);
  const mix = [
    week.bySource.programme > 0 &&
      t('progress.week.mixProgramme', { count: week.bySource.programme }),
    week.bySource.quick > 0 && t('progress.week.mixQuick', { count: week.bySource.quick }),
    week.bySource.custom > 0 && t('progress.week.mixOwn', { count: week.bySource.custom }),
  ].filter((x): x is string => typeof x === 'string');
  const active = activeParts(week.activeSeconds);
  const sessionsLabel = t('progress.week.sessions', { count: week.sessions });

  const programme = record ?? undefined;
  const cycle = programme
    ? cycleProgress(programme, logs, (w) => t('progress.weekShort', { week: w }))
    : undefined;
  const phase = programme && cycle ? phaseForWeek(programme, cycle.week)?.name[lang] : undefined;
  const programmeLogs = programme
    ? completed.filter(
        (l) =>
          l.source.kind === 'programme' &&
          l.source.programmeId === programme.id &&
          l.countsAsDone !== false,
      )
    : [];
  const first = programmeLogs.map((l) => l.startedAt).sort()[0];
  const programmeSec = programmeLogs.reduce((sum, l) => sum + activeSeconds(l), 0);

  const weekSets =
    programme && cycle && !cycle.finished
      ? programmeWeekSets({
          programme,
          week: cycle.week,
          logs,
          programmeStartedAt: programme.startedAt ?? first ?? now.toISOString(),
        })
      : undefined;
  const identities = programme ? programmeIdentities(programme, lang) : [];
  const left =
    programme && cycle && !cycle.finished
      ? slotsLeft(
          identities.map((identity) => identity),
          cycle.week,
          programme.sessionsPerWeek,
          cycle.doneInWeek,
        )
      : [];
  const leftNames = left.map((identity) => identity.letter ?? identity.title);
  const outside = weekSets
    ? completed.filter((l) => l.source.kind !== 'programme' && l.startedAt > weekSets.since)
    : [];

  const lifted = highlights(logs, programmes, tests, now);
  const lastLog = completed.reduce((a, b) => (a.startedAt > b.startedAt ? a : b));

  return (
    <div className={styles.page}>
      <h1 className={styles.display}>{t('progress.title')}</h1>

      <section className={styles.sec} aria-labelledby="week-title">
        <div className={styles.secHead}>
          <h2 className={styles.secTitle} id="week-title">
            {t('progress.week.title')}
          </h2>
          <span className={styles.secMeta}>
            {weekRangeText(week.startDate, week.endDate, lang)}
          </span>
        </div>
        <div className={styles.figs}>
          <div className={styles.fig}>
            <span className={styles.figN}>
              <span className={styles.num}>{week.sessions}</span>
            </span>
            <span className={styles.figLabel}>{sessionsLabel}</span>
          </div>
          <div className={styles.fig}>
            <span className={styles.figN}>
              {active.hours !== undefined ? (
                <>
                  <span className={styles.num}>{active.hours}</span>
                  <span className={styles.unit}>{t('progress.unit.h')}</span>
                  <span className={styles.num}>{active.minutes}</span>
                </>
              ) : (
                <>
                  <span className={styles.num}>{active.minutes}</span>
                  <span className={styles.unit}>{t('progress.unit.min')}</span>
                </>
              )}
            </span>
            <span className={styles.figLabel}>{t('progress.week.active')}</span>
          </div>
        </div>
        <p className={styles.line}>
          {mix.length > 0
            ? t('progress.week.mix', { list: listText(mix, lang) })
            : t('progress.week.none')}
        </p>
      </section>

      {programme && cycle ? (
        <section className={styles.sec} aria-labelledby="cycle-title">
          <div className={styles.secHead}>
            <h2 className={styles.secTitle} id="cycle-title">
              {t('progress.cycle.title')}
            </h2>
            <span className={styles.secMeta}>
              {t('progress.cycle.week', { week: cycle.week, weeks: programme.weeks })}
            </span>
          </div>
          {!cycle.finished ? (
            <p className={styles.line}>
              {phase ? `${phase}. ` : ''}
              <Rich
                text={t('progress.cycle.done', {
                  count: cycle.doneInWeek,
                  done: cycle.doneInWeek,
                  perWeek: programme.sessionsPerWeek,
                })}
              />
            </p>
          ) : null}
          <div className={styles.cycle}>
            <CycleStrip weeks={cycle.weeks} />
            <div className={styles.foot}>
              {cycle.finished ? (
                <>
                  <p className={styles.line}>
                    <Rich
                      text={t('progress.cycle.ended', {
                        count: cycle.done,
                        done: cycle.done,
                        planned: cycle.planned,
                      })}
                    />
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ name: 'review', programmeId: programme.id })}
                  >
                    {t('progress.cycle.review')}
                  </Button>
                </>
              ) : cycle.done > 0 && first ? (
                <p className={styles.line}>
                  <Rich
                    text={t('progress.cycle.total', {
                      count: cycle.done,
                      done: cycle.done,
                      planned: cycle.planned,
                      time: timeText(programmeSec),
                      date: longDate(first, lang),
                    })}
                  />
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.sec}>
          <div className={styles.noteGhost}>
            <p className={styles.note}>
              <Icon name="info" size={20} />
              {t('progress.cycle.noProgramme')}
            </p>
            <Button variant="ghost" onClick={() => navigate({ name: 'programme' })}>
              {t('progress.cycle.create')}
            </Button>
          </div>
        </section>
      )}

      <section className={styles.sec} aria-labelledby="hl-title">
        <div className={styles.secHead}>
          <h2 className={styles.secTitle} id="hl-title">
            {t('progress.highlights.title')}
          </h2>
          <span className={styles.secMeta}>{t('progress.highlights.window')}</span>
        </div>
        {lifted.length > 0 ? (
          <HighlightList items={lifted} lang={lang} />
        ) : (
          <p className={styles.note}>
            <Icon name="info" size={20} />
            {t('progress.highlights.empty')}
          </p>
        )}
      </section>

      {programme && weekSets ? (
        <section className={styles.sec} aria-labelledby="sets-title">
          <h2 className={styles.secTitle} id="sets-title">
            {t('progress.sets.title', { week: weekSets.week })}
          </h2>
          <p className={styles.secSub}>
            {t('progress.sets.sub')}
            {leftNames.length > 0
              ? ` ${t('progress.sets.left', { count: leftNames.length, names: listText(leftNames, lang) })}`
              : ''}
            {outside.length > 0
              ? ` ${t(
                  outside.every((l) => l.source.kind === 'quick')
                    ? 'progress.sets.outsideQuick'
                    : 'progress.sets.outside',
                )}`
              : ''}
          </p>
          <MeterList rows={weekSets.rows} />
        </section>
      ) : null}

      <section className={styles.sec} aria-labelledby="history-title" style={{ gap: 4 }}>
        <h2 className={styles.secTitle} id="history-title">
          {t('progress.history.title')}
        </h2>
        <div className={styles.nav}>
          <NavRow
            icon="list"
            title={t('progress.nav.sessions.title')}
            meta={t('progress.nav.sessions.meta', {
              count: completed.length,
              when: agoText(new Date(lastLog.startedAt), now, lang),
            })}
            onClick={() => navigate({ name: 'history' })}
          />
          <NavRow
            icon="chart"
            title={t('progress.nav.exercises.title')}
            meta={t('progress.nav.exercises.meta', { count: exercisesDone })}
            onClick={() => navigate({ name: 'exercises' })}
          />
          {bodyRow}
          {testsRow}
          {past > 0 ? (
            <NavRow
              icon="file"
              title={t('progress.nav.past.title')}
              meta={t('progress.nav.past.meta', { count: past })}
              onClick={() => navigate({ name: 'past' })}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
