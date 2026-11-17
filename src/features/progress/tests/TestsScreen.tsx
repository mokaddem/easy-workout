import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useActiveProgramme, useMaxTests, useProgrammes } from '@/app/data';
import { goBack, navigate } from '@/app/router';
import type { Language, MaxTest } from '@/domain';
import {
  maxTestHistory,
  testedExercises,
  testExerciseFor,
  testPlacement,
  testWeeks,
  testValue,
} from '@/engine';
import { ChangeTag } from '@/features/adapt/ChangeTag';
import { Rich } from '@/features/adapt/Rich';
import { numberText } from '@/features/adapt/format';
import { sessionIdentity } from '@/features/programme/format';
import { AppBar, Button, Dock, EmptyState, Icon, Skeleton } from '@/ui/components';
import { TestChart } from '../charts/TestChart';
import type { TestColumn } from '../charts/testChart';
import { longDate } from '../charts/format';
import { TestNowSheet } from './TestNowSheet';
import { contextOf } from './logic';
import { useTestContext } from './useTestContext';
import styles from './tests.module.css';
import charts from '../charts/charts.module.css';

/** Every max test: the programme's next one, then each tested exercise with its chart and rows. */
export function TestsScreen() {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const tests = useMaxTests();
  const programmes = useProgrammes();
  const active = useActiveProgramme();
  const ctx = useTestContext();
  const [sheet, setSheet] = useState(false);

  const results = useMemo(() => (tests ?? []).filter((x) => !x.stopped), [tests]);
  const tested = useMemo(() => testedExercises(results), [results]);

  const plan = useMemo(() => {
    if (!active || !ctx) return undefined;
    const week = testWeeks(active)[0];
    if (!week) return undefined;
    if (
      ctx.maxTests.some((x) => x.programmeId === active.id && x.context === 'session' && !x.stopped)
    )
      return undefined;
    const exerciseId = testExerciseFor(active, week, ctx);
    if (!exerciseId) return undefined;
    const at = testPlacement(active, week, exerciseId, ctx);
    const session = at && active.rotation.find((s) => s.id === at.sessionId);
    const letter = session ? sessionIdentity(session, lang, active.rotation).letter : undefined;
    return { exerciseId, week, letter, placement: at?.placement };
  }, [active, ctx, lang]);

  const bar = (
    <AppBar title={t('stats.tests.title')} onBack={goBack} backLabel={t('common.back')} />
  );

  if (!tests || !programmes || active === undefined)
    return (
      <>
        {bar}
        <div className={styles.skeleton}>
          <Skeleton height={96} radius="var(--radius-lg)" />
          <Skeleton height={200} radius="var(--radius-lg)" />
        </div>
      </>
    );

  const dock = (
    <Dock>
      <Button size="player" fullWidth icon="target" onClick={() => setSheet(true)}>
        {t('stats.tests.take')}
      </Button>
    </Dock>
  );

  if (tested.length === 0) {
    const week = active ? testWeeks(active)[0] : undefined;
    return (
      <>
        {bar}
        <div className={styles.scroll}>
          <EmptyState
            icon="target"
            title={t('stats.tests.emptyTitle')}
            description={
              week ? t('stats.tests.emptyBody', { week }) : t('stats.tests.emptyBodyNoWeek')
            }
          />
        </div>
        {dock}
        <TestNowSheet open={sheet} onClose={() => setSheet(false)} />
      </>
    );
  }

  return (
    <>
      {bar}
      <div className={styles.scroll}>
        <div className={styles.page}>
          {plan ? (
            <section className={styles.plan} aria-labelledby="tests-plan">
              <span className={styles.well} aria-hidden="true">
                <Icon name="target" size={24} />
              </span>
              <div className={styles.planText}>
                <h2 id="tests-plan" className={styles.planTitle}>
                  {t('stats.tests.plan', {
                    exercise: exerciseById.get(plan.exerciseId)?.name[lang] ?? plan.exerciseId,
                  })}
                </h2>
                <p className={styles.planBody}>
                  <Rich
                    text={
                      plan.letter
                        ? t(
                            plan.placement === 'after-warmup'
                              ? 'stats.tests.planWhenWarm'
                              : 'stats.tests.planWhen',
                            { letter: plan.letter, week: plan.week },
                          )
                        : t('stats.tests.planWeek', { week: plan.week })
                    }
                  />
                </p>
              </div>
            </section>
          ) : null}
          {tested.map((entry) => (
            <TestSection
              key={entry.exerciseId}
              exerciseId={entry.exerciseId}
              tests={results}
              programmes={programmes}
              lang={lang}
            />
          ))}
        </div>
      </div>
      {dock}
      <TestNowSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

function TestSection({
  exerciseId,
  tests,
  programmes,
  lang,
}: {
  exerciseId: string;
  tests: readonly MaxTest[];
  programmes: Parameters<typeof contextOf>[1];
  lang: Language;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const series = maxTestHistory(tests, exerciseId);
  const entries = series
    .flatMap((s) => s.entries)
    .sort((a, b) => a.test.at.localeCompare(b.test.at));
  const columns: TestColumn[] = entries.map((e) => ({
    id: e.test.id,
    date: e.test.date,
    value: e.value,
    context: e.test.context,
  }));
  const time = entries.at(-1)?.test.result.kind === 'time';
  const unitText = (value: number) =>
    time ? t('labels.unit.s') : t('stats.unit.reps', { count: value });
  const active = selected !== null && selected < entries.length ? selected : entries.length - 1;
  const shown = entries[active]!;
  const hasSession = columns.some((c) => c.context === 'session');
  const hasFresh = columns.some((c) => c.context === 'fresh');
  const weekOfSession = (programmeId?: string) => {
    const p = programmeId ? programmes.find((x) => x.id === programmeId) : undefined;
    return p ? testWeeks(p).at(-1) : undefined;
  };
  const sessionLegendWeek = weekOfSession(
    entries.find((e) => e.test.context === 'session')?.test.programmeId,
  );
  const name = exerciseById.get(exerciseId)?.name[lang] ?? exerciseId;

  return (
    <section className={styles.section} aria-labelledby={`tests-${exerciseId}`}>
      <div className={styles.head}>
        <h2 id={`tests-${exerciseId}`} className={styles.title}>
          <button
            type="button"
            className={styles.titleLink}
            onClick={() => navigate({ name: 'exercise', exerciseId })}
          >
            {name}
          </button>
        </h2>
        <span className={styles.count}>{t('stats.tests.count', { count: entries.length })}</span>
      </div>
      <div className={styles.card}>
        <p className={styles.readout} aria-live="polite">
          {longDate(shown.test.date, lang)} · {numberText(shown.value, lang)}
          {' '}
          {unitText(shown.value)}
        </p>
        <TestChart
          columns={columns}
          selected={selected}
          onSelect={setSelected}
          name={t('stats.tests.chartName', { name })}
        />
        <ul className={charts.legend}>
          {hasFresh ? (
            <li>
              <span className={charts.swatchSolid} aria-hidden="true" />
              {t('stats.tests.ctx.fresh')}
            </li>
          ) : null}
          {hasSession ? (
            <li>
              <span className={charts.swatchHollow} aria-hidden="true" />
              {sessionLegendWeek
                ? t('stats.tests.legendSession', { week: sessionLegendWeek })
                : t('stats.tests.ctx.session')}
            </li>
          ) : null}
        </ul>
      </div>
      <ul className={styles.rows}>
        {[...entries].reverse().map((e) => {
          const ctx = contextOf(e.test, programmes);
          const label =
            ctx.kind === 'session'
              ? ctx.cycle !== undefined
                ? t('stats.tests.ctx.cycle', { ctx: t('stats.tests.ctx.session'), n: ctx.cycle })
                : t('stats.tests.ctx.session')
              : ctx.beforeProgramme
                ? t('stats.tests.ctx.before', { ctx: t('stats.tests.ctx.fresh') })
                : t('stats.tests.ctx.fresh');
          const tag =
            e.change !== undefined && e.change !== 0
              ? ({
                  icon: e.change > 0 ? 'arrow-up' : 'arrow-down',
                  text: t(time ? 'adapt.detail.tag.seconds' : 'adapt.detail.tag.reps', {
                    count: Math.abs(e.change),
                  }),
                  srPrefix: t(e.change > 0 ? 'adapt.detail.tag.srUp' : 'adapt.detail.tag.srDown'),
                } as const)
              : undefined;
          return (
            <li key={e.test.id} className={styles.testRow} data-test={e.test.id}>
              <span className={styles.when}>
                <span className={styles.date}>{longDate(e.test.date, lang)}</span>
                <span className={styles.ctx}>{label}</span>
                {tag ? <ChangeTag tag={tag} /> : null}
              </span>
              <span className={styles.value}>
                {numberText(testValue(e.test), lang)}
                <span className={styles.unit}>{unitText(e.value)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
