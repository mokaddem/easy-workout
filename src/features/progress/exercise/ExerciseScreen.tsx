import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import {
  useActiveProgramme,
  useAnswers,
  useEquipment,
  useMaxTests,
  useProgrammes,
  useSessionLogs,
} from '@/app/data';
import { useProgressContext } from '@/app/progress';
import { goBack, navigate, type Route } from '@/app/router';
import { nextSession } from '@/app/programme-state';
import type { BandLevel, Exercise, Language } from '@/domain';
import {
  changeTimeline,
  exerciseHistory,
  maxTestHistory,
  nextTime,
  type ExercisePoint,
} from '@/engine';
import { ChangeTag } from '@/features/adapt/ChangeTag';
import { GoalRuler } from '@/features/adapt/GoalRuler';
import { Rich } from '@/features/adapt/Rich';
import { numberText } from '@/features/adapt/format';
import { thumbIcon } from '@/features/editor/picker/thumbIcon';
import { equipmentInUse, FigureTile } from '@/features/figure';
import { HowToSheet } from '@/features/howto';
import { loadParts } from '@/features/play/format';
import { Appear } from '@/motion';
import { EmptyState, Icon, IconButton, SegmentedControl, Skeleton } from '@/ui/components';
import { LadderChart } from '../charts/LadderChart';
import { dayDate, longDate, nbsp } from '../charts/format';
import { ladderModel, type LadderRange } from '../charts/ladder';
import { readoutOf } from './readout';
import { letterOf, sinceSummary, swapLinks } from './logic';
import { standsOf } from './stands';
import { Timeline } from './Timeline';
import styles from './exercise.module.css';
import charts from '../charts/charts.module.css';

const SESSIONS_SHOWN = 4;

/** One exercise: where it stands, how it got there, the changes behind it. */
export function ExerciseScreen({ route }: { route: Extract<Route, { name: 'exercise' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const id = route.exerciseId;
  const exercise = exerciseById.get(id);
  const logs = useSessionLogs();
  const programmes = useProgrammes();
  const answers = useAnswers();
  const tests = useMaxTests();
  const inventory = useEquipment();
  const active = useActiveProgramme();
  const ctx = useProgressContext();

  const points = useMemo(
    () => (logs && programmes ? exerciseHistory(id, logs, programmes) : undefined),
    [id, logs, programmes],
  );
  const timeline = useMemo(() => (logs ? changeTimeline(id, logs) : []), [id, logs]);

  const cyclePoints = useMemo(() => {
    if (!points || !active) return [];
    const from = active.startedAt ?? active.createdAt ?? '';
    return points.filter((p) => p.at >= from);
  }, [points, active]);
  const hasCycle = cyclePoints.length > 0;
  const [pickedRange, setPickedRange] = useState<LadderRange | null>(null);
  const range: LadderRange = pickedRange ?? (hasCycle ? 'cycle' : 'all');
  const [selected, setSelected] = useState<number | null>(null);
  const [allSessions, setAllSessions] = useState(false);

  const back = (
    <div className={styles.bar}>
      <IconButton icon="back" label={t('common.back')} onClick={goBack} />
    </div>
  );

  if (!points || !logs || !programmes || !answers || !tests || !inventory || active === undefined)
    return (
      <>
        {back}
        <div className={styles.skeleton}>
          <Skeleton width="70%" height={48} />
          <Skeleton height={80} />
          <Skeleton height={260} radius="var(--radius-lg)" />
        </div>
      </>
    );

  if (points.length === 0)
    return (
      <>
        {back}
        <EmptyState
          icon="chart"
          title={t('stats.exercise.noneTitle')}
          description={t('stats.exercise.noneBody')}
        />
      </>
    );

  const name = exercise?.name[lang] ?? id;
  const links = swapLinks(id, answers);
  const equipmentKinds = [
    ...new Set((exercise?.equipment[0] ?? []).map((r) => t(`labels.equipment.${r.kind}`))),
  ];
  const kicker = [
    exercise ? t(`labels.pattern.${exercise.pattern}`) : '',
    equipmentKinds.length > 0 ? equipmentKinds.join(', ') : t('stats.exercise.bodyweight'),
  ]
    .filter(Boolean)
    .join(', ');

  const viewPoints = range === 'cycle' ? cyclePoints : points;
  const programmeSeen = points.some((p) => p.source === 'programme');
  const programme = active?.status === 'active' ? active : undefined;
  const cycleInfo =
    programme && logs
      ? (() => {
          const pos = nextSession(programme, logs);
          return { weeks: programme.weeks, current: pos.finished ? programme.weeks : pos.week };
        })()
      : undefined;
  const ownedBands: BandLevel[] = inventory
    .filter((i) => i.kind === 'band')
    .flatMap((i) => ('levels' in i ? (i.levels as BandLevel[]) : []));

  const model = ladderModel({
    points: viewPoints,
    range: range === 'cycle' && cycleInfo ? 'cycle' : 'all',
    ...(cycleInfo && { cycle: cycleInfo }),
    ...(exercise && { exercise }),
    ...(ownedBands.length > 0 && { ownedBands }),
    now: new Date(),
  });
  const lastIndex = model.items.length - 1;
  const shownIndex = selected !== null && selected <= lastIndex ? selected : lastIndex;
  const inspecting = selected !== null && selected <= lastIndex;
  const shownItem = model.items[shownIndex];
  const readout = shownItem
    ? readoutOf(t, lang, {
        point: shownItem.point,
        ...(exercise && { exercise }),
        latest: !inspecting && shownIndex === lastIndex,
        source: shownItem.point.source,
        ...(() => {
          const log = logs.find((l) => l.id === shownItem.point.logId);
          const letter = log ? letterOf(log, programmes) : undefined;
          return letter ? { letter } : {};
        })(),
      })
    : undefined;

  const perHint = exercise && loadParts(t, lang, { kind: 'kg', kg: 1 }, exercise, inventory).unit;
  const perDumbbell = perHint !== undefined && perHint !== t('labels.unit.kg');
  const levelKind = model.level?.kind;
  const levelTitle =
    levelKind === 'band'
      ? t('stats.ladder.levelBand')
      : levelKind === 'assisted'
        ? t('stats.ladder.levelAssisted')
        : levelKind === 'added'
          ? t('stats.ladder.levelAdded')
          : levelKind === 'kg'
            ? perDumbbell
              ? t('stats.ladder.levelKgPer', { unit: perHint })
              : t('stats.ladder.levelKg')
            : undefined;
  const unit = viewPoints.at(-1)?.best?.unit ?? 'reps';
  const valueTitle = exercise?.unilateral
    ? t('stats.ladder.valueWeaker')
    : t(`stats.ladder.value.${unit}`);

  const since = sinceSummary(viewPoints);
  const sinceDate = viewPoints[0] ? longDate(viewPoints[0].date, lang) : '';
  const sinceText = (() => {
    if (!since) return undefined;
    if (since.kind === 'load') {
      const sign = since.delta < 0 ? '−' : '+';
      return t('stats.exercise.sinceLoad', {
        date: sinceDate,
        delta: `${sign}${numberText(Math.abs(since.delta), lang)}${nbsp}kg`,
        per: perDumbbell ? ` ${perHint!.replace(/^kg\s+/, '')}` : '',
        from: `${numberText(since.from, lang)}${nbsp}kg`,
        to: `${numberText(since.to, lang)}${nbsp}kg`,
      });
    }
    if (since.kind === 'reps')
      return t(since.time ? 'stats.exercise.sinceSeconds' : 'stats.exercise.sinceReps', {
        date: sinceDate,
        count: since.count,
        n: numberText(since.count, lang),
      });
    const assisted = exercise?.loadType === 'band-assisted';
    return t(assisted ? 'stats.exercise.sinceBandsLess' : 'stats.exercise.sinceBandsMore', {
      date: sinceDate,
      count: since.count,
      from: t(`labels.band.${since.from}`).toLocaleLowerCase(lang),
      to: t(`labels.band.${since.to}`).toLocaleLowerCase(lang),
    });
  })();

  // Where it stands and what it aims at, from the latest programme session containing it.
  const aim = (() => {
    if (!ctx) return undefined;
    const point = [...points].reverse().find((p) => p.source === 'programme');
    const log = point && logs.find((l) => l.id === point.logId);
    if (!log || log.source.kind !== 'programme') return undefined;
    const { programmeId } = log.source;
    const owner = programmes.find((p) => p.id === programmeId);
    if (!owner) return undefined;
    return nextTime(log, owner, ctx).lines.find((l) => l.exerciseId === id)?.after;
  })();
  const latest = points.at(-1)!;
  const stands = latest.best ? standsOf(t, lang, latest.best) : undefined;

  const testSeries = maxTestHistory(
    tests.filter((x) => !x.stopped),
    id,
  );
  const testEntries = testSeries
    .flatMap((s) => s.entries.map((e) => ({ ...e, context: s.context })))
    .sort((a, b) => b.test.at.localeCompare(a.test.at));

  const sessionsNewest = [...points].reverse();
  const visibleSessions = allSessions ? sessionsNewest : sessionsNewest.slice(0, SESSIONS_SHOWN);

  const goalRange =
    aim?.target.kind === 'reps'
      ? { min: aim.target.min, max: aim.target.max, time: false }
      : aim?.target.kind === 'time'
        ? { min: aim.target.minSec, max: aim.target.maxSec, time: true }
        : undefined;
  const goal = aim && goalRange ? (aim.goal ?? goalRange.min) : undefined;
  const loadCell = (() => {
    const load = aim?.load;
    if (load && exercise && load.kind !== 'bodyweight') {
      const parts = loadParts(t, lang, load, exercise, inventory);
      return { ...parts };
    }
    return undefined;
  })();

  return (
    <>
      {back}
      <div className={styles.scroll}>
        <div className={styles.page}>
          <header>
            <div className={styles.kicker}>
              {exercise ? <Icon name={thumbIcon(exercise)} size={20} /> : null}
              <span>{kicker}</span>
            </div>
            <h1 className={`${styles.name} ${name.length > 18 ? styles.nameLong : ''}`}>{name}</h1>
            {links.replaces.length > 0 || links.replacedBy ? (
              <div className={styles.swapLine}>
                {links.replaces.length > 0 ? (
                  <span>
                    {t('stats.exercise.replaces')}{' '}
                    {links.replaces.map((rid, i) => (
                      <span key={rid}>
                        {i > 0 ? ', ' : ''}
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => navigate({ name: 'exercise', exerciseId: rid })}
                        >
                          {exerciseById.get(rid)?.name[lang] ?? rid}
                        </button>
                      </span>
                    ))}
                  </span>
                ) : null}
                {links.replacedBy ? (
                  <span>
                    {t('stats.exercise.replacedBy')}{' '}
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => navigate({ name: 'exercise', exerciseId: links.replacedBy! })}
                    >
                      {exerciseById.get(links.replacedBy)?.name[lang] ?? links.replacedBy}
                    </button>
                  </span>
                ) : null}
              </div>
            ) : null}
          </header>

          {exercise ? <HowToRow exercise={exercise} lang={lang} /> : null}

          <section
            className={`${styles.now} ${goal === undefined ? styles.nowOne : ''}`}
            aria-label={t('stats.exercise.now')}
          >
            <div className={styles.cell}>
              <div className={styles.cellFigure}>
                {loadCell?.value ? (
                  <>
                    <span className={styles.bigNum}>{loadCell.value}</span>
                    {loadCell.unit ? (
                      <span className={styles.cellUnit}>{loadCell.unit}</span>
                    ) : null}
                  </>
                ) : loadCell?.word ? (
                  <span className={styles.bigWord}>{loadCell.word}</span>
                ) : stands ? (
                  <>
                    <span className={styles.bigNum}>{stands.value}</span>
                    <span className={styles.cellUnit}>{stands.unit}</span>
                  </>
                ) : null}
              </div>
              <span className={styles.cellCaption}>
                {loadCell
                  ? exercise?.loadType === 'band-assisted'
                    ? t('stats.exercise.leastHelp')
                    : ''
                  : t('stats.exercise.bestSet')}
              </span>
            </div>
            {goal !== undefined && goalRange ? (
              <div className={styles.cell}>
                <div className={styles.cellFigure}>
                  <span className={styles.bigNum}>{numberText(goal, lang)}</span>
                  <span className={styles.cellUnit}>
                    {goalRange.time ? t('labels.unit.s') : t('stats.unit.reps', { count: goal })}
                  </span>
                </div>
                <span className={styles.cellCaption}>{t('stats.exercise.next')}</span>
                <GoalRuler
                  goal={goal}
                  min={goalRange.min}
                  max={goalRange.max}
                  time={goalRange.time}
                />
              </div>
            ) : null}
          </section>

          <section className={styles.section} aria-labelledby="ex-progress">
            <div className={styles.head}>
              <h2 id="ex-progress" className={styles.title}>
                {t('stats.exercise.progress')}
              </h2>
              {hasCycle && cycleInfo ? (
                <SegmentedControl
                  label={t('stats.exercise.range')}
                  value={range}
                  onChange={(v) => {
                    setPickedRange(v);
                    setSelected(null);
                  }}
                  options={[
                    { value: 'cycle', label: t('stats.exercise.rangeCycle') },
                    { value: 'all', label: t('stats.exercise.rangeAll') },
                  ]}
                />
              ) : null}
            </div>
            <div className={styles.card}>
              {readout ? (
                <div className={styles.readout} aria-live="polite">
                  <div className={styles.readoutTop}>
                    <span>{readout.title}</span>
                    {inspecting ? (
                      <IconButton
                        icon="close"
                        label={t('stats.exercise.closeInspect')}
                        onClick={() => setSelected(null)}
                      />
                    ) : null}
                  </div>
                  <div className={styles.readoutMain}>
                    {readout.big ? <span className={styles.readoutBig}>{readout.big}</span> : null}
                    <span className={readout.pain ? styles.readoutPain : styles.readoutWords}>
                      {readout.words}
                    </span>
                  </div>
                  {readout.sub ? (
                    <p className={styles.readoutSub}>
                      <Rich text={readout.sub} />
                    </p>
                  ) : null}
                </div>
              ) : null}
              <Appear id={range}>
                <LadderChart
                  model={model}
                  selected={selected}
                  onSelect={setSelected}
                  {...(levelTitle && { levelTitle })}
                  valueTitle={valueTitle}
                  name={t('stats.exercise.chartName', { name })}
                />
                <ul className={charts.legend}>
                  {model.range ? (
                    <li>
                      <span className={charts.swatchBand} aria-hidden="true" />
                      {t('stats.exercise.legendRange', {
                        min: numberText(model.range.min, lang),
                        max: numberText(model.range.max, lang),
                      })}
                    </li>
                  ) : null}
                  {model.level ? (
                    <li>
                      <span className={charts.swatchStep} aria-hidden="true" />
                      {t(`stats.exercise.legendStep.${model.level.kind}`)}
                    </li>
                  ) : null}
                </ul>
              </Appear>
            </div>
            {sinceText ? (
              <p className={styles.summary}>
                <Rich text={sinceText} />
              </p>
            ) : null}
            {points.length === 1 ? (
              <p className={styles.note}>{t('stats.exercise.onePoint')}</p>
            ) : null}
            {!programmeSeen ? (
              <div className={styles.notice}>
                <Icon name="info" size={20} />
                <span>{t('stats.exercise.onlyQuick')}</span>
              </div>
            ) : null}
          </section>

          {testEntries.length > 0 ? (
            <section className={styles.section} aria-labelledby="ex-tests">
              <h2 id="ex-tests" className={styles.title}>
                {t('stats.exercise.tests')}
              </h2>
              <ul className={styles.rows}>
                {testEntries.slice(0, 4).map((entry) => {
                  const time = entry.test.result.kind === 'time';
                  const tag =
                    entry.change !== undefined && entry.change !== 0
                      ? ({
                          icon: entry.change > 0 ? 'arrow-up' : 'arrow-down',
                          text: t(time ? 'adapt.detail.tag.seconds' : 'adapt.detail.tag.reps', {
                            count: Math.abs(entry.change),
                          }),
                          srPrefix: t(
                            entry.change > 0 ? 'adapt.detail.tag.srUp' : 'adapt.detail.tag.srDown',
                          ),
                        } as const)
                      : undefined;
                  return (
                    <li key={entry.test.id} className={styles.testRow}>
                      <span className={styles.testWhen}>
                        <span>{longDate(entry.test.date, lang)}</span>
                        <span className={styles.testCtx}>
                          {t(`stats.tests.ctx.${entry.context}`)}
                        </span>
                        {tag ? <ChangeTag tag={tag} /> : null}
                      </span>
                      <span className={styles.testValue}>
                        {numberText(entry.value, lang)}
                        <span className={styles.standsUnit}>
                          {time ? t('labels.unit.s') : t('stats.unit.reps', { count: entry.value })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => navigate({ name: 'tests' })}
                >
                  {t('stats.exercise.allTests')}
                </button>
              </div>
            </section>
          ) : null}

          {programmeSeen && timeline.length > 0 ? (
            <ChangedSection
              exercise={exercise}
              id={id}
              timeline={timeline}
              points={points}
              logs={logs}
              programmes={programmes}
            />
          ) : null}

          <section className={styles.section} aria-labelledby="ex-sessions">
            <div className={styles.head}>
              <h2 id="ex-sessions" className={styles.title}>
                {t('stats.exercise.sessions')}
              </h2>
              <span className={styles.count}>{points.length}</span>
            </div>
            <ul className={styles.rows}>
              {visibleSessions.map((p) => (
                <SessionRow
                  key={p.logId}
                  point={p}
                  lang={lang}
                  logs={logs}
                  programmes={programmes}
                />
              ))}
            </ul>
            {sessionsNewest.length > SESSIONS_SHOWN ? (
              <div>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => setAllSessions((v) => !v)}
                >
                  {allSessions
                    ? t('stats.exercise.seeLess')
                    : t('stats.exercise.seeMoreSessions', {
                        count: sessionsNewest.length - SESSIONS_SHOWN,
                      })}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

function ChangedSection({
  exercise,
  id,
  timeline,
  points,
  logs,
  programmes,
}: {
  exercise: Exercise | undefined;
  id: string;
  timeline: ReturnType<typeof changeTimeline>;
  points: readonly ExercisePoint[];
  logs: Parameters<typeof Timeline>[0]['logs'];
  programmes: Parameters<typeof Timeline>[0]['programmes'];
}): ReactNode {
  const { t } = useTranslation();
  return (
    <section className={styles.section} aria-labelledby="ex-changed">
      <div className={styles.head}>
        <h2 id="ex-changed" className={styles.title}>
          {t('stats.exercise.changed')}
        </h2>
      </div>
      <Timeline
        entries={timeline}
        points={points}
        logs={logs}
        programmes={programmes}
        exercise={exercise}
        exerciseId={id}
      />
    </section>
  );
}

function SessionRow({
  point,
  lang,
  logs,
  programmes,
}: {
  point: ExercisePoint;
  lang: Language;
  logs: Parameters<typeof Timeline>[0]['logs'];
  programmes: Parameters<typeof Timeline>[0]['programmes'];
}) {
  const { t } = useTranslation();
  const log = logs.find((l) => l.id === point.logId);
  const letter = log ? letterOf(log, programmes) : undefined;
  const label =
    point.source === 'quick'
      ? t('stats.exercise.sessionQuick')
      : point.source === 'custom'
        ? t('stats.exercise.sessionOwn')
        : letter
          ? t('stats.exercise.sessionRow', { letter, week: point.week ?? 1 })
          : point.sessionName[lang];
  const stands = point.best ? standsOf(t, lang, point.best) : undefined;
  return (
    <li>
      <button
        type="button"
        className={styles.sessionRow}
        onClick={() => navigate({ name: 'log', logId: point.logId })}
      >
        <span>
          <span className={styles.sessionName}>{label}</span>
          <br />
          <span className={styles.sessionMeta}>
            {dayDate(point.date, lang)}
            {stands
              ? ` · ${stands.word ? `${stands.word}, ` : ''}${stands.value}${nbsp}${stands.unit}`
              : ''}
            {point.stopped === 'pain' ? (
              <>
                {' · '}
                <span className={styles.pain}>{t('stats.exercises.pain')}</span>
              </>
            ) : null}
          </span>
        </span>
        <Icon name="chevron" size={20} className={styles.chev} />
      </button>
    </li>
  );
}

/** The "How to do it" row under the title: the picture, what it opens, and the sheet itself. */
function HowToRow({ exercise, lang }: { exercise: Exercise; lang: Language }) {
  const { t } = useTranslation();
  const inventory = useEquipment();
  const [open, setOpen] = useState(false);
  const equipment = equipmentInUse(exercise, inventory);
  return (
    <>
      <button
        type="button"
        className={styles.howto}
        data-howto={exercise.id}
        aria-label={`${t('stats.exercise.howto')}, ${exercise.name[lang]}`}
        onClick={() => setOpen(true)}
      >
        <span className={styles.howtoThumb}>
          <FigureTile
            exerciseId={exercise.id}
            size={56}
            equipment={equipment}
            fallback={<Icon name={thumbIcon(exercise)} size={28} />}
          />
        </span>
        <span className={styles.howtoText}>
          <b>{t('stats.exercise.howto')}</b>
          <span>{t('stats.exercise.howtoMeta', { count: exercise.execution[lang].length })}</span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
      <HowToSheet
        open={open}
        onClose={() => setOpen(false)}
        exerciseId={exercise.id}
        equipment={equipment}
      />
    </>
  );
}
