import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useProgrammes, useSessionLogs } from '@/app/data';
import { goBack, type Route } from '@/app/router';
import type { ProgrammeRecord } from '@/db';
import type { EquipmentInventory, Language, SessionLog } from '@/domain';
import { phaseForWeek, sessionForWeek } from '@/engine';
import { Rich, loadText, numberText, tokenOf } from '@/features/adapt';
import { loadParts } from '@/features/play/format';
import { WeekRuler } from '@/features/programme/WeekRuler';
import { exerciseName, sessionIdentity } from '@/features/programme/format';
import { AppBar, EmptyState, Icon, Skeleton } from '@/ui/components';
import { NBSP } from '@/features/cycle/review';
import { pastRows, type PastItemRow } from './session';
import styles from './PastSession.module.css';

/** One session of a past programme, week by week, with what was done under each exercise. */
export function PastSessionScreen({ route }: { route: Extract<Route, { name: 'past-session' }> }) {
  const { t } = useTranslation();
  const programmes = useProgrammes();
  const logs = useSessionLogs();
  const record = programmes?.find((p) => p.id === route.programmeId);
  const session = record?.rotation.find((s) => s.id === route.sessionId);
  if (!programmes || !logs)
    return (
      <>
        <AppBar title="" onBack={goBack} backLabel={t('common.back')} />
        <div className={styles.skeleton}>
          <Skeleton height={144} radius="var(--radius-lg)" />
        </div>
      </>
    );
  if (!record || !session)
    return (
      <>
        <AppBar title={t('cycle.past.title')} onBack={goBack} backLabel={t('common.back')} />
        <EmptyState icon="file" title={t('cycle.review.missing')} description="" />
      </>
    );
  return <Loaded record={record} sessionId={route.sessionId} logs={logs} />;
}

const logOf = (
  record: ProgrammeRecord,
  sessionId: string,
  week: number,
  logs: readonly SessionLog[],
) =>
  logs
    .filter(
      (l) =>
        l.status === 'completed' &&
        l.source.kind === 'programme' &&
        l.source.programmeId === record.id &&
        l.source.sessionId === sessionId &&
        l.source.week === week,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .at(-1);

function Loaded({
  record,
  sessionId,
  logs,
}: {
  record: ProgrammeRecord;
  sessionId: string;
  logs: SessionLog[];
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const lastDone = [...Array(record.weeks).keys()]
    .map((i) => i + 1)
    .filter((w) => logOf(record, sessionId, w, logs))
    .at(-1);
  const [week, setWeek] = useState(lastDone ?? record.weeks);
  const base = record.rotation.find((s) => s.id === sessionId)!;
  const identity = sessionIdentity(base, lang, record.rotation);
  const log = logOf(record, sessionId, week, logs);
  const plan = log?.plan ?? sessionForWeek(record, sessionId, week).session;
  const phase = phaseForWeek(record, week);
  const rows = pastRows(plan, log);
  const cycleName = t('cycle.past.viewTitle', {
    programme: t(`labels.goal.${record.goal}`),
    n: record.generation?.cycle ?? 1,
  });
  const inventory = record.generation?.equipment ?? [];
  const date = log
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
        day: 'numeric',
        month: 'long',
      }).format(new Date(log.startedAt))
    : undefined;

  return (
    <>
      <AppBar
        title={cycleName}
        onBack={goBack}
        backLabel={t('cycle.past.backProgramme', { n: record.generation?.cycle ?? 1 })}
      />
      <section className={styles.head}>
        <div className={styles.id}>
          {identity.letter ? (
            <span className={styles.letter} aria-hidden="true">
              {identity.letter}
            </span>
          ) : (
            <Icon name="heart" size={28} />
          )}
          <div className={styles.idText}>
            {identity.letter ? (
              <span className={styles.kicker}>
                {t('cycle.past.sessionKicker', { letter: identity.letter })}
              </span>
            ) : null}
            <h1 className={styles.title}>{identity.title}</h1>
          </div>
        </div>
        <p className={styles.readOnly}>
          <Icon name="clock" size={20} />
          <span>{t('cycle.past.readOnly')}</span>
        </p>
      </section>
      <div className={styles.weeks}>
        <WeekRuler
          weeks={record.weeks}
          phases={record.phases}
          selected={week}
          current={record.weeks + 1}
          onSelect={setWeek}
        />
        <p className={styles.weekLine}>
          {date
            ? t('cycle.past.weekLine', {
                week,
                phase: (phase?.name[lang] ?? '').split(' + ')[0]?.toLocaleLowerCase(lang),
                date,
              })
            : t('cycle.past.weekLineNone', {
                week,
                phase: (phase?.name[lang] ?? '').split(' + ')[0]?.toLocaleLowerCase(lang),
              })}
        </p>
      </div>
      <section className={styles.list}>
        {rows.map((row) => (
          <Row key={row.key} row={row} lang={lang} inventory={inventory} />
        ))}
      </section>
    </>
  );
}

function dose(t: ReturnType<typeof useTranslation>['t'], row: PastItemRow) {
  const target = row.item.target;
  const range = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);
  switch (target.kind) {
    case 'reps':
      return { n: `${row.sets} × ${range(target.min, target.max)}`, u: t('cycle.past.setsReps') };
    case 'time':
      return {
        n: `${row.sets} × ${range(target.minSec, target.maxSec)}`,
        u: t('cycle.past.setsTime'),
      };
    case 'max':
      return { n: `${row.sets} × Max`, u: t('cycle.past.setsReps') };
    case 'cardio':
      return { n: range(target.minMinutes, target.maxMinutes), u: t('cycle.past.minutes') };
    case 'interval':
      return {
        n: `${target.rounds} × ${target.workSec}/${target.recoverySec}`,
        u: t('cycle.past.rounds'),
      };
  }
}

function Row({
  row,
  lang,
  inventory,
}: {
  row: PastItemRow;
  lang: Language;
  inventory: EquipmentInventory;
}) {
  const { t } = useTranslation();
  const d = dose(t, row);
  const exercise = exerciseById.get(row.item.exerciseId);
  const load = loadParts(t, lang, row.load, exercise, inventory);
  const { done } = row;
  const unit =
    done.unit === 'reps'
      ? t('labels.unit.reps')
      : done.unit === 'seconds'
        ? t('labels.unit.s')
        : t('labels.unit.min');
  const values = done.values.map((v) => numberText(v, lang)).join(', ');
  const doneLoad =
    done.load && done.load.kind !== 'bodyweight'
      ? loadText(t, lang, tokenOf(done.load))
      : undefined;
  let text: string;
  if (done.values.length > 0) {
    const shown = `${values}${NBSP}${unit}`;
    text = doneLoad
      ? t('cycle.past.doneAt', { values: shown, load: doneLoad })
      : t('cycle.past.done', { values: shown });
    if (done.stopped === 'pain') text = `${text} ${t('cycle.past.doneStopped')}`;
  } else if (done.stopped === 'pain') text = t('cycle.past.doneStopped');
  else if (done.stopped === 'no-equipment') text = t('cycle.past.doneNoEquipment');
  else text = t('cycle.past.notDone');
  const did = done.values.length > 0;
  return (
    <article className={styles.rx}>
      <span className={styles.idx}>{row.index}</span>
      <h3 className={styles.name}>{exerciseName(row.item.exerciseId, lang)}</h3>
      <div className={styles.body}>
        <div className={styles.nums}>
          <div className={styles.cell}>
            <span className={styles.n}>{d.n}</span>
            <span className={styles.u}>{d.u}</span>
          </div>
          {load.value ? (
            <div className={styles.cell}>
              <span className={styles.n}>{load.value}</span>
              {load.unit ? <span className={styles.u}>{load.unit}</span> : null}
            </div>
          ) : load.word ? (
            <div className={styles.cell}>
              <span className={styles.word}>{load.word}</span>
            </div>
          ) : null}
        </div>
        <p className={`${styles.done} ${did ? '' : styles.notDone}`}>
          <Icon name={did ? 'check' : 'minus'} size={20} />
          <span>
            <Rich text={text} />
          </span>
        </p>
      </div>
    </article>
  );
}
