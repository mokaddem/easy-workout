import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tick } from '@/motion';
import {
  useActiveProgramme,
  useAnswers,
  useEquipment,
  useMaxTests,
  useProgrammes,
  useSessionLog,
  useSessionLogs,
} from '@/app/data';
import { useNextTime } from '@/app/progress';
import { nextSession } from '@/app/programme-state';
import { navigate } from '@/app/router';
import { repo } from '@/db/repo';
import type { Language, SessionLog } from '@/domain';
import { activeSeconds, phaseForWeek, previousTest, sessionTotals, type Proposal } from '@/engine';
import { Rich } from '@/features/adapt';
import { Button, Card, Icon, SetStrip, SwitchRow, TestResultRow } from '@/ui/components';
import { BackupLine } from '../../settings/BackupBanner';
import { useBackupReminder } from '../../settings/useBackupReminder';
import { programmeIdentities } from '../../programme/format';
import { durationParts, numberText, stripGroups } from '../format';
import { clearSummary } from '../lifecycle';
import { resultValue } from '../testFlow';
import { valueText } from '../testFormat';
import { exerciseById } from '@/catalogue';
import { exerciseLabel } from '../format';
import { Decisions } from './summary/Decisions';
import { ExerciseList, type ListMode } from './summary/ExerciseList';
import { mainExercises } from './summary/rows';
import { useLeaveOneOffs } from './summary/useOneOffs';
import styles from './Summary.module.css';

/** The end of a session: how long, how much, and whether it counts. Reads the stored log. */
export function SummaryScreen({ id }: { id: string }) {
  const log = useSessionLog(id);
  useEffect(() => {
    // The session is gone (nothing was logged, or it was removed): nothing to summarise.
    if (log === null) {
      clearSummary();
      navigate({ name: 'programme' }, { replace: true });
    }
  }, [log]);
  if (!log) return null;
  return <Summary log={log} />;
}

function Summary({ log }: { log: SessionLog }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const inventory = useEquipment() ?? [];
  const programme = useActiveProgramme();
  const logs = useSessionLogs();
  const [counts, setCounts] = useState(log.countsAsDone ?? true);
  const backup = useBackupReminder();
  const programmes = useProgrammes();
  const answers = useAnswers() ?? [];
  const nextTime = useNextTime(log);
  const maxTests = useMaxTests();

  // The decisions the session raised, kept as they were when the summary opened so an answered
  // card stays on screen with its Undo.
  const [proposals, setProposals] = useState<Proposal[] | undefined>();
  if (!proposals && nextTime) setProposals(nextTime.proposals);
  const oneOffs = useLeaveOneOffs(proposals ?? []);

  const totals = sessionTotals(log, inventory);
  const duration = durationParts(activeSeconds(log));
  const groups = stripGroups(log);
  const early = log.endedEarly === true;
  const quick = log.source.kind === 'quick';
  const inRotation =
    log.source.kind === 'programme' && !!programme && programme.id === log.source.programmeId;

  const toggle = (value: boolean) => {
    setCounts(value);
    void repo.setCountsAsDone(log.id, value).catch(() => setCounts(!value));
  };

  // What the rotation does once this session counts.
  let onLine = t('play.summary.switchOn');
  let endsProgramme = false;
  if (inRotation && programme && log.source.kind === 'programme') {
    const after = nextSession(
      programme,
      (logs ?? []).map((l) => (l.id === log.id ? { ...l, countsAsDone: true } : l)),
    );
    if (after.finished) {
      onLine = t('play.summary.switchOnEnd');
      endsProgramme = true;
    } else {
      const identity = programmeIdentities(programme, lang)[after.index]!;
      const name = identity.letter
        ? t('play.summary.sessionLetter', { letter: identity.letter })
        : identity.fullName;
      onLine =
        after.week > log.source.week
          ? t('play.summary.switchOnWeek', { week: after.week, name })
          : t('play.summary.switchOnNext', { name });
    }
  }

  const rows = useMemo(() => mainExercises(log), [log]);
  const source = log.source;
  const sourceProgramme =
    source.kind === 'programme'
      ? (programmes ?? []).find((p) => p.id === source.programmeId)
      : undefined;
  const phaseKind =
    source.kind === 'programme' && sourceProgramme
      ? phaseForWeek(sourceProgramme, source.week)?.kind
      : undefined;
  const mode: ListMode = quick
    ? 'quick'
    : phaseKind === 'deload'
      ? 'deload'
      : phaseKind === 'peak'
        ? 'peak'
        : 'normal';
  const sessionLetter =
    source.kind === 'programme' && sourceProgramme
      ? programmeIdentities(sourceProgramme, lang)[
          sourceProgramme.rotation.findIndex((s) => s.id === source.sessionId)
        ]?.letter
      : undefined;

  const context =
    log.source.kind === 'programme'
      ? t('play.summary.context', { week: log.source.week, name: log.plan.name[lang] })
      : log.plan.name[lang];

  const back = () => {
    oneOffs.record();
    clearSummary();
    navigate({ name: quick ? 'quick' : 'programme' }, { replace: true });
  };
  const toReview = inRotation && counts && endsProgramme && log.source.kind === 'programme';
  const review = () => {
    oneOffs.record();
    clearSummary();
    if (log.source.kind === 'programme')
      navigate({ name: 'review', programmeId: log.source.programmeId }, { replace: true });
  };

  // The max test this session ran: its result against the last one, or that it was skipped.
  const tested = (maxTests ?? []).find((x) => x.logId === log.id && !x.stopped);
  const testRow = tested ? (
    (() => {
      const kind = tested.result.kind === 'reps' ? 'reps' : 'time';
      const before = previousTest(tested, maxTests ?? []);
      const to = valueText(kind, resultValue(tested));
      const from = before ? valueText(kind, resultValue(before)) : undefined;
      return (
        <TestResultRow
          kicker={t('play.summary.testKicker')}
          name={exerciseLabel(exerciseById.get(tested.exerciseId), lang, tested.exerciseId)}
          figure={{
            ...(from !== undefined && { from }),
            to,
            ...(kind === 'reps' && { unit: t('labels.unit.reps') }),
            srText:
              from !== undefined
                ? t('play.test.srFigure', { from, to })
                : t('play.test.srFirst', { to }),
          }}
        />
      );
    })()
  ) : log.test?.outcome === 'skipped' ? (
    <p className={styles.notice}>
      <Icon name="info" size={20} />
      <span>
        <Rich text={t('play.summary.testSkipped')} />
      </span>
    </p>
  ) : null;

  return (
    <div className={styles.root}>
      <div className={styles.context}>
        <span>{context}</span>
      </div>
      <div className={styles.scroll}>
        <div className={styles.sum}>
          <div className={styles.head}>
            <h1 className={styles.title}>
              {t(early ? 'play.summary.titleEarly' : 'play.summary.title')}
            </h1>
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
              <span className={styles.durLabel}>{t('play.summary.durationLabel')}</span>
            </div>
          </div>

          {groups.length > 0 || totals.hardSets > 0 ? (
            <div className={styles.head} style={{ gap: 16 }}>
              {groups.length > 0 ? (
                <div className={styles.sweep}>
                  <SetStrip groups={groups} />
                </div>
              ) : null}
              {totals.hardSets > 0 ? (
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statN}>
                      <Tick>{totals.hardSets}</Tick>
                    </span>
                    <span className={styles.statLabel}>
                      {t('play.summary.sets', { count: totals.hardSets })}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statN}>
                      <Tick>{numberText(totals.totalReps, lang)}</Tick>
                    </span>
                    <span className={styles.statLabel}>
                      {t('play.summary.reps', { count: totals.totalReps })}
                    </span>
                    {totals.volumeKg > 0 ? (
                      <span className={styles.statSub}>
                        {t('play.summary.volume', { kg: numberText(totals.volumeKg, lang) })}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {inRotation ? (
            <Card className={styles.switchCard}>
              <SwitchRow
                large
                checked={counts}
                onChange={toggle}
                title={t('play.summary.switchTitle')}
                meta={counts ? onLine : t('play.summary.switchOff')}
              />
            </Card>
          ) : quick || log.source.kind === 'custom' ? (
            <p className={styles.notice}>
              <Icon name="info" size={20} />
              <span>{t(quick ? 'play.summary.quickNotice' : 'play.summary.customNotice')}</span>
            </p>
          ) : null}

          {testRow}

          <Decisions
            proposals={proposals ?? []}
            rows={rows}
            lines={nextTime?.lines ?? []}
            {...(sessionLetter && { sessionLetter })}
            onAnswered={(proposal) => oneOffs.markAnswered(proposal)}
            onUndone={(proposal) => oneOffs.markUndone(proposal)}
          />
          {backup.reminder !== 'none' ? <BackupLine state={backup} /> : null}
          {rows.length > 0 ? (
            <ExerciseList
              rows={rows}
              lines={nextTime?.lines ?? []}
              answers={answers}
              logId={log.id}
              mode={mode}
              lang={lang}
              buyNext={nextTime?.buyNext ?? []}
            />
          ) : null}
        </div>
      </div>
      <div className={styles.dock}>
        <Button size="player" fullWidth onClick={toReview ? review : back}>
          {toReview
            ? t('play.summary.toReview')
            : t(quick ? 'play.summary.backQuick' : 'play.summary.backProgramme')}
        </Button>
      </div>
    </div>
  );
}
