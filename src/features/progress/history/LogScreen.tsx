import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAnswers,
  useEquipment,
  useMaxTests,
  useProfile,
  useProgrammes,
  useSessionLog,
  useSessionLogs,
} from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { goBack, handleLinkClick, navigate, routeHref, type Route } from '@/app/router';
import { repo } from '@/db/repo';
import { isCooldownLog, type Language, type SessionLog } from '@/domain';
import { activeSeconds, phaseForWeek, sessionTotals } from '@/engine';
import {
  Button,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  Skeleton,
  useToast,
  type IconName,
} from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { ChangeTag, Rich } from '../../adapt';
import { exerciseName } from '../../adapt/format';
import { programmeIdentities } from '../../programme/format';
import { activeParts, clockTime, dayLong, langOf } from '../format';
import { CooldownLog } from './CooldownLog';
import { exerciseBlocks, type ExerciseBlock } from './blocks';
import { painStop } from './groups';
import { logIdentity } from './identity';
import { recordsIn } from './records';
import { SetTable } from './SetTable';
import { whyOf } from './why';
import styles from './History.module.css';

/** One finished session, read-only: how it went set by set, and the way to delete it. */
export function LogScreen({ route }: { route: Extract<Route, { name: 'log' }> }) {
  const { t } = useTranslation();
  const log = useSessionLog(route.logId);
  const logs = useSessionLogs();
  const programmes = useProgrammes();
  const tests = useMaxTests();
  const answers = useAnswers();
  const inventory = useEquipment();
  const bodyweightKg = useProfile()?.bodyweightKg;

  const bar = (
    <div className={styles.bar}>
      <IconButton icon="back" label={t('progress.log.back')} onClick={goBack} />
      <span className={styles.barText}>{t('progress.log.context')}</span>
    </div>
  );

  if (log === undefined || !logs || !programmes || !tests || !answers || !inventory)
    return (
      <>
        {bar}
        <div className={styles.skeletonPage} aria-busy="true">
          <Skeleton height={106} radius="var(--radius-lg)" />
          <Skeleton height={36} width="60%" />
          <Skeleton height={160} radius="var(--radius-lg)" />
        </div>
      </>
    );

  if (log === null)
    return (
      <>
        {bar}
        <EmptyState
          icon="list"
          title={t('progress.log.missingTitle')}
          description={t('progress.log.missingBody')}
          actionLabel={t('progress.log.missingAction')}
          onAction={() => navigate({ name: 'history' }, { replace: true })}
        />
      </>
    );

  if (isCooldownLog(log))
    return (
      <>
        {bar}
        <CooldownLog log={log} logs={logs} programmes={programmes} />
      </>
    );

  return (
    <>
      {bar}
      <LogDetail
        log={log}
        logs={logs}
        programmes={programmes}
        tests={tests}
        {...(bodyweightKg !== undefined && { bodyweightKg })}
        answers={answers}
        inventory={inventory}
      />
    </>
  );
}

function LogDetail({
  log,
  logs,
  programmes,
  tests,
  bodyweightKg,
  answers,
  inventory,
}: {
  log: SessionLog;
  logs: SessionLog[];
  programmes: ReturnType<typeof useProgrammes> & object;
  tests: ReturnType<typeof useMaxTests> & object;
  bodyweightKg?: number;
  answers: ReturnType<typeof useAnswers> & object;
  inventory: ReturnType<typeof useEquipment> & object;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = langOf(i18n.language);
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [warmOpen, setWarmOpen] = useState(false);

  const identity = logIdentity(log, programmes, lang);
  const totals = useMemo(() => sessionTotals(log, inventory), [log, inventory]);
  const blocks = useMemo(() => exerciseBlocks(log), [log]);
  const hasTest = tests.some((x) => x.logId === log.id);
  const records = useMemo(
    () => recordsIn(log, logs, programmes, tests, bodyweightKg),
    [log, logs, programmes, tests, bodyweightKg],
  );
  const source = log.source;
  const programme =
    source.kind === 'programme' ? programmes.find((p) => p.id === source.programmeId) : undefined;
  const phase =
    source.kind === 'programme' && programme
      ? phaseForWeek(programme, source.week)?.name[lang]
      : undefined;

  const active = activeParts(activeSeconds(log));
  const early = log.endedEarly === true;
  const pain = painStop(log);
  const painName = pain ? exerciseName(pain.exerciseId, lang) : undefined;

  const kicker =
    source.kind === 'programme'
      ? phase
        ? t('progress.log.kicker', { week: source.week, phase })
        : t('progress.log.kickerWeek', { week: source.week })
      : source.kind === 'quick'
        ? t('progress.log.kickerQuick')
        : t('progress.log.kickerOwn');

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

  let notice: { icon: IconName; text: string; pain?: boolean } | undefined;
  if (pain && painName)
    notice = {
      icon: 'stop',
      pain: true,
      text: t('progress.log.painNotice', { exercise: painName, set: pain.set }),
    };
  else if (log.status === 'abandoned')
    notice = { icon: 'close', text: t('progress.log.abandonedNotice') };
  else if (early)
    notice = {
      icon: 'flag',
      text: t(
        log.countsAsDone === false ? 'progress.log.earlyNoCountNotice' : 'progress.log.earlyNotice',
        { count: totals.main.done, done: totals.main.done, total: totals.main.planned },
      ),
    };

  const warm = blocks.filter((b) => b.section === 'warmup');
  const work = blocks.filter((b) => b.section !== 'warmup');
  const warmSkipped = warm.filter((b) => b.notReached || b.rows.every((r) => r.flag === 'skipped'));

  const answerOf = (exerciseId: string) => {
    const a = answers.find(
      (x) => x.logId === log.id && x.exerciseId === exerciseId && x.kind === 'no-equipment',
    );
    return a?.answer === 'swap' ? 'swap' : a?.answer === 'one-off' ? 'one-off' : undefined;
  };

  const itemOf = (block: ExerciseBlock) => {
    const [, bi, ii] = block.key.split('/');
    const b = log.plan[block.section][Number(bi)];
    if (!b) return undefined;
    return b.type === 'straight' ? b.item : b.items[Number(ii)];
  };

  // What the rotation does without this session.
  const current = programmes.find((p) => p.status === 'active');
  let nextName: { letter: string | undefined; title: string } | undefined;
  if (source.kind === 'programme' && current && current.id === source.programmeId) {
    const before = nextSession(current, logs);
    const after = nextSession(
      current,
      logs.filter((l) => l.id !== log.id),
    );
    if (before.index !== after.index || before.week !== after.week) {
      const id = programmeIdentities(current, lang)[after.index];
      nextName = id ? { letter: id.letter, title: id.title } : undefined;
    }
  }

  const setsLeaving = (() => {
    const seen = new Set<string>();
    for (const s of log.sets)
      if (s.actual && s.flag !== 'skipped' && s.section !== 'warmup')
        seen.add(`${s.section}/${s.blockIndex}/${s.itemIndex}/${s.set}`);
    return seen.size;
  })();

  const remove = async () => {
    setConfirm(false);
    try {
      const removed = await repo.deleteSessionLog(log.id);
      navigate({ name: 'history' }, { replace: true });
      toast.show({
        message: t('progress.log.deleted'),
        action: {
          label: t('common.undo'),
          onAction: () => void repo.restoreSessionLog(removed),
        },
      });
    } catch {
      // The session was closed or removed in the meantime: nothing to delete.
    }
  };

  const hero =
    identity.letter && identity.kind === 'programme' ? (
      <span className={styles.ldLetter} aria-hidden="true">
        {identity.letter}
      </span>
    ) : (
      <span className={styles.ldTile} aria-hidden="true">
        <Icon
          name={
            identity.kind === 'quick'
              ? 'bolt'
              : identity.kind === 'custom'
                ? 'bookmark'
                : identity.cardio
                  ? 'heart'
                  : 'list'
          }
          size={28}
        />
      </span>
    );

  return (
    <div className={styles.ld}>
      <div className={styles.ldId}>
        {hero}
        <div className={styles.ldText}>
          <span className={styles.ldKicker}>{kicker}</span>
          <h1 className={styles.ldName}>{identity.title}</h1>
        </div>
      </div>
      <p className={styles.ldWhen}>{when}</p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statN}>
            {active.hours !== undefined ? (
              <>
                {active.hours}
                <small>{t('progress.unit.h')}</small>
                {active.minutes}
              </>
            ) : (
              <>
                {active.minutes}
                <small>{t('progress.unit.min')}</small>
              </>
            )}
          </span>
          <span className={styles.statLabel}>{t('progress.log.statActive')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statN}>
            {totals.main.done}
            <small>/{totals.main.planned}</small>
          </span>
          <span className={styles.statLabel}>{t('progress.log.statSets')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statN}>{totals.totalReps}</span>
          <span className={styles.statLabel}>{t('progress.log.statReps')}</span>
        </div>
      </div>

      {notice ? (
        <p className={cx(styles.notice, notice.pain && styles.noticePain)}>
          <Icon name={notice.icon} size={20} />
          <span>
            <Rich text={notice.text} />
          </span>
        </p>
      ) : null}

      <section className={styles.sec} aria-labelledby="by-exercise">
        <div className={styles.secHead}>
          <h2 className={styles.secTitle} id="by-exercise">
            {t('progress.log.byExercise')}
          </h2>
          <span className={styles.secMeta}>
            {t('progress.log.exerciseCount', { count: work.length })}
          </span>
        </div>
        {warm.length > 0 ? (
          <div className={styles.disclosure}>
            <button
              type="button"
              className={styles.disclosureHead}
              aria-expanded={warmOpen}
              onClick={() => setWarmOpen((v) => !v)}
            >
              <span className={styles.disclosureText}>
                <span className={styles.disclosureTitle}>{t('progress.log.warmup')}</span>
                <span className={styles.disclosureMeta}>
                  {t('progress.log.warmupMeta', { count: warm.length })}
                  {warmSkipped.length > 0
                    ? t('progress.log.warmupSkipped', {
                        count: warmSkipped.length,
                        skipped: warmSkipped.length,
                      })
                    : ''}
                </span>
              </span>
              <Icon
                name="chev-down"
                size={20}
                className={cx(styles.chev, warmOpen && styles.chevOpen)}
              />
            </button>
            {warmOpen ? (
              <ul className={styles.warm}>
                {warm.map((b) => (
                  <li key={b.key}>
                    <span>{exerciseName(b.exerciseId, lang)}</span>
                    <span className={styles.warmState}>
                      {warmSkipped.includes(b)
                        ? t('progress.log.warmupPassed')
                        : t('progress.log.warmupDone')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {work.map((block) => {
          const why = whyOf(t, lang, itemOf(block), log.progression?.[block.key]);
          const href = routeHref({ name: 'exercise', exerciseId: block.exerciseId });
          const record = records.has(block.exerciseId);
          return (
            <div key={block.key} className={styles.lx}>
              <a className={styles.lxHead} href={href} onClick={(e) => handleLinkClick(e, href)}>
                <span className={styles.lxName}>{exerciseName(block.exerciseId, lang)}</span>
                <Icon name="chevron" size={20} className={styles.chev} />
              </a>
              {why || record ? (
                <div className={styles.lxWhy}>
                  {why?.tag ? <ChangeTag tag={why.tag} /> : null}
                  {record ? (
                    <span className={styles.medal}>
                      <Icon name="medal" size={20} />
                      {t('progress.log.bestSet')}
                    </span>
                  ) : null}
                  {why?.reason ? <span>{why.reason}</span> : null}
                </div>
              ) : null}
              <SetTable block={block} lang={lang} answer={answerOf(block.exerciseId)} />
            </div>
          );
        })}
      </section>

      {log.note ? (
        <section className={styles.sec} aria-labelledby="log-note">
          <h2 className={styles.secTitle} id="log-note">
            {t('progress.log.note')}
          </h2>
          <p className={styles.note}>{log.note}</p>
        </section>
      ) : null}

      {log.status !== 'in-progress' ? (
        <div className={styles.del}>
          <Button
            variant="destructive-outline"
            fullWidth
            icon="trash"
            onClick={() => setConfirm(true)}
          >
            {t('progress.log.delete')}
          </Button>
          <p>{t('progress.log.deleteHint')}</p>
        </div>
      ) : null}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('progress.log.deleteDialog.title')}
        description={
          <>
            <Rich
              text={t('progress.log.deleteDialog.body', {
                count: setsLeaving,
                sets: setsLeaving,
              })}
            />
            {nextName ? (
              <>
                {' '}
                <Rich
                  text={
                    nextName.letter
                      ? t('progress.log.deleteDialog.next', { name: nextName.letter })
                      : t('progress.log.deleteDialog.nextTitle', { name: nextName.title })
                  }
                />
              </>
            ) : null}
            {hasTest || log.test?.outcome === 'done' ? (
              <> {t('progress.log.deleteDialog.test')}</>
            ) : null}
          </>
        }
        confirmLabel={t('progress.log.deleteDialog.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}
