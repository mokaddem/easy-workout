import type { TFunction } from 'i18next';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { ProgrammeRecord } from '@/db';
import type { Language, MaxTest, SessionLog } from '@/domain';
import { groupsOf, testValue, type CycleReview, type LiftChange, type LiftReading } from '@/engine';
import { handleLinkClick, navigate, routeHref } from '@/app/router';
import { Tick } from '@/motion';
import {
  capFirst,
  loadText,
  repsText,
  secondsText,
  tokenOf,
  ChangeTag,
  Rich,
  type ChangeTagData,
} from '@/features/adapt';
import { effortText } from '@/features/programme/effort';
import { exerciseName } from '@/features/programme/format';
import {
  Button,
  CompareFigure,
  CycleStrip,
  Icon,
  TestResultCard,
  type IconName,
} from '@/ui/components';
import {
  NBSP,
  bodyFigure,
  cycleNumber,
  liftFigure,
  painRows,
  stripWeeks,
  type PainRow,
} from './review';
import type { CycleData } from './useCycleData';
import styles from './ReviewBody.module.css';

const dateFormat = (lang: Language, iso: string, month: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { day: 'numeric', month }).format(
    new Date(iso),
  );

/** m:ss for a hold test. */
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export interface ReviewBodyProps {
  data: CycleData & { record: ProgrammeRecord; review: CycleReview };
  /** A past cycle: no title, no carry-over line, no offers, no open choices. */
  readOnly?: boolean;
  /** The "Ton profil" section, built by the screen that owns the offers. */
  profileSection?: ReactNode;
  /** The open-choices nudge and its note. */
  decisions?: ReactNode;
}

/** The numbers of a finished cycle: sessions, test, main lifts, body, pain. */
export function ReviewBody({ data, readOnly, profileSection, decisions }: ReviewBodyProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const { record, review, logs } = data;
  const cycle = cycleNumber(record);
  const next = cycle + 1;
  const { sessions } = review;
  const weeks = useMemo(() => stripWeeks(record, logs), [record, logs]);
  const patchy = sessions.endedEarly >= Math.ceil(sessions.planned / 4);
  const pain = useMemo(
    () =>
      painRows(
        record,
        review.pain.map((p) => p.exerciseId),
        logs,
        data.answers,
      ),
    [record, review.pain, logs, data.answers],
  );
  const heldPain = new Map(
    pain.filter((p) => p.answer === 'lighter' || p.answer === 'keep').map((p) => [p.exerciseId, p]),
  );

  return (
    <div className={styles.rv}>
      {readOnly ? null : (
        <header className={styles.head}>
          <h1 className={styles.title}>{t('cycle.review.title', { n: cycle })}</h1>
          {sessions.first && sessions.last ? (
            <p className={styles.muted}>
              {t('cycle.review.dates', {
                from: dateFormat(lang, sessions.first),
                to: dateFormat(lang, sessions.last),
              })}
            </p>
          ) : null}
        </header>
      )}

      <section className={styles.cyc} aria-label={t('cycle.review.stripLabel')}>
        <div className={styles.cycRow}>
          <span className={`${styles.num} ${styles.cycN}`}>
            <Tick>{sessions.inFull}</Tick>
          </span>
          <span className={`${styles.num} ${styles.cycOf}`}>/{sessions.planned}</span>
        </div>
        <span className={styles.cycLabel}>
          {t('cycle.review.full', { count: sessions.inFull })}
        </span>
        <CycleStrip weeks={weeks} size="tall" sweep />
        <p className={styles.key}>
          <span>
            <i />
            {t('cycle.review.keyFull')}
          </span>
          {sessions.endedEarly > 0 ? (
            <span>
              <i className={styles.early} />
              <Rich text={t('cycle.review.keyEarly', { count: sessions.endedEarly })} />
            </span>
          ) : null}
        </p>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={`${styles.num} ${styles.statN}`}>
              {sessions.weeksTaken}
              <span className={styles.statU}>{t('cycle.review.weeksUnit')}</span>
            </span>
            <span className={styles.statLabel}>
              {sessions.weeksTaken === record.weeks
                ? t('cycle.review.weeksOnPlan')
                : t('cycle.review.weeksPlanned', { planned: record.weeks })}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.num} ${styles.statN}`}>
              <Tick>{sessions.mainSets}</Tick>
            </span>
            <span className={styles.statLabel}>{t('cycle.review.mainSets')}</span>
          </div>
        </div>
        {review.cardio.plannedMin > 0 ? (
          <p className={styles.cardio}>
            <Icon name="incline" size={20} />
            <span>
              <Rich
                text={t('cycle.review.cardio', {
                  done: review.cardio.doneMin,
                  planned: review.cardio.plannedMin,
                })}
              />
            </span>
          </p>
        ) : null}
        {patchy && !readOnly ? (
          <p className={styles.note}>
            <Icon name="info" size={20} />
            <span>{t('cycle.review.patchyNote', { next })}</span>
          </p>
        ) : null}
      </section>

      <TestSection data={data} lang={lang} readOnly={Boolean(readOnly)} next={next} />

      {review.lifts.length > 0 ? (
        <section className={styles.sec}>
          <div className={styles.secHead}>
            <h2 className={styles.secTitle}>{t('cycle.review.lifts.title')}</h2>
            <p>{t('cycle.review.lifts.intro')}</p>
            {readOnly ? null : <p>{t('cycle.review.lifts.carry', { next })}</p>}
          </div>
          <div className={styles.trio}>
            <div>
              <span className={`${styles.num} ${styles.trioN}`}>{review.counts.progressed}</span>
              <span>{t('cycle.review.lifts.progressed')}</span>
            </div>
            <div>
              <span className={`${styles.num} ${styles.trioN}`}>{review.counts.held}</span>
              <span>{t('cycle.review.lifts.held')}</span>
            </div>
            <div>
              <span className={`${styles.num} ${styles.trioN}`}>{review.counts.atMax}</span>
              <span>{t('cycle.review.lifts.atMax')}</span>
            </div>
          </div>
          <ul className={styles.lifts}>
            {review.lifts.map((lift) => (
              <LiftRow
                key={`${lift.sessionId}/${lift.slot ?? ''}`}
                lift={lift}
                lang={lang}
                pain={heldPain.get(lift.end?.exerciseId ?? '')}
              />
            ))}
          </ul>
          {review.buyNext.length > 0 ? (
            <a
              className={styles.nudge}
              href={routeHref({ name: 'equipment', view: 'buy' })}
              onClick={(event) =>
                handleLinkClick(event, routeHref({ name: 'equipment', view: 'buy' }))
              }
            >
              <span className={styles.well}>
                <Icon name="bag" />
              </span>
              <span className={styles.nudgeText}>
                <span className={styles.nudgeTitle}>
                  {t('cycle.review.lifts.nudge', { count: review.buyNext.length })}
                </span>
                <span className={styles.nudgeSub}>{buyNextLine(t, lang, review.buyNext)}</span>
              </span>
              <Icon name="chev-right" size={20} />
            </a>
          ) : null}
        </section>
      ) : null}

      <BodySection review={review} lang={lang} />

      {profileSection}

      <section className={styles.sec}>
        <div className={styles.secHead}>
          <h2 className={styles.secTitle}>{t('cycle.review.pain.title')}</h2>
        </div>
        {pain.map((row) => (
          <PainLine key={row.exerciseId} row={row} lang={lang} />
        ))}
        {decisions}
        {pain.length === 0 && !decisions ? (
          <p className={styles.note}>
            <Icon name="check" size={20} />
            <span>{t('cycle.review.pain.allClear')}</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ test */

function TestSection({
  data,
  lang,
  readOnly,
  next,
}: {
  data: ReviewBodyProps['data'];
  lang: Language;
  readOnly: boolean;
  next: number;
}) {
  const { t } = useTranslation();
  const { record, review, logs, programmes } = data;
  const test = review.test;
  const week = record.weeks;
  if (!test) {
    const blocked = logs.some(
      (l) =>
        l.source.kind === 'programme' &&
        l.source.programmeId === record.id &&
        l.test?.outcome === 'pain',
    );
    const skipped = logs.some(
      (l) =>
        l.source.kind === 'programme' &&
        l.source.programmeId === record.id &&
        l.test?.outcome === 'skipped',
    );
    return (
      <section className={styles.sec}>
        <div className={styles.secHead}>
          <h2 className={styles.secTitle}>{t('cycle.review.test.title')}</h2>
        </div>
        <div className={styles.emptyCard}>
          <span className={styles.well}>
            <Icon name="target" />
          </span>
          <div>
            <h3 className={styles.emptyTitle}>{t('cycle.review.test.noneTitle')}</h3>
            <p>
              {blocked
                ? t('cycle.review.test.blockedBody', { week })
                : skipped
                  ? t('cycle.review.test.skippedBody', { week, next })
                  : t('cycle.review.test.noneBody', { next })}
            </p>
            {!blocked && !readOnly ? (
              <Button variant="secondary" onClick={() => navigate({ name: 'tests' })}>
                {t('cycle.review.test.action')}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  const { current, previous } = test;
  const exercise = exerciseById.get(current.exerciseId);
  const time = current.result.kind === 'time';
  const show = (value: number) => (time ? clock(value) : String(value));
  const to = testValue(current);
  const from = previous ? testValue(previous) : undefined;
  const diff = from === undefined ? 0 : to - from;
  const name = exerciseName(current.exerciseId, lang);
  const previousCycle = previous?.programmeId
    ? programmes.find((p) => p.id === previous.programmeId)
    : undefined;
  const tag: ChangeTagData | undefined =
    from === undefined
      ? undefined
      : diff === 0
        ? { icon: 'arrow-right', text: t('cycle.review.test.equal') }
        : {
            icon: diff > 0 ? 'arrow-up' : 'arrow-down',
            text: time
              ? t('adapt.detail.tag.seconds', { count: Math.abs(diff) })
              : t('adapt.detail.tag.reps', { count: Math.abs(diff) }),
            srPrefix: t(diff > 0 ? 'adapt.detail.tag.srUp' : 'adapt.detail.tag.srDown'),
          };
  const placement = placementOf(current, logs);
  const same = previous && placement && placement === placementOf(previous, logs);
  const group = exercise ? groupsOf(exercise)[0] : undefined;
  return (
    <section className={styles.sec}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle}>{t('cycle.review.test.title')}</h2>
      </div>
      <TestResultCard
        kicker={t(time ? 'cycle.review.test.kickerTime' : 'cycle.review.test.kickerReps')}
        name={name}
        figure={{
          ...(from !== undefined && { from: show(from) }),
          to: show(to),
          ...(!time && { unit: t('labels.unit.reps') }),
          ...(previous && {
            fromCaption: previousCycle
              ? t('cycle.review.test.prevCycle', { n: cycleNumber(previousCycle) })
              : dateFormat(lang, previous.date, 'short'),
          }),
          toCaption: dateFormat(lang, current.date, 'short'),
          ...(tag && { tag: <ChangeTag tag={tag} size="large" /> }),
          srText:
            from === undefined
              ? t('cycle.review.test.srFirst', { name, to: show(to) })
              : t('cycle.review.test.sr', { name, from: show(from), to: show(to) }),
        }}
        line={
          same && group
            ? t('cycle.review.test.sameConditions', {
                placement:
                  placement === 'end'
                    ? t('cycle.review.test.placementEnd', {
                        of: t(`cycle.review.muscles.${group}`),
                      })
                    : t('cycle.review.test.placementFirst'),
              })
            : undefined
        }
      />
    </section>
  );
}

const placementOf = (test: MaxTest, logs: readonly SessionLog[]) =>
  logs.find((l) => l.id === test.logId)?.test?.placement;

/* ------------------------------------------------------------------ lifts */

function readingText(
  t: TFunction,
  lang: Language,
  reading: LiftReading,
  variant?: string,
): ReactNode {
  const value =
    reading.unit === 'reps' ? repsText(t, reading.value) : secondsText(reading.value, lang);
  const load =
    reading.load && reading.load.kind !== 'bodyweight'
      ? loadText(t, lang, tokenOf(reading.load))
      : undefined;
  const effort = reading.rir === undefined ? undefined : effortText(t, Math.max(0, reading.rir));
  const key = load
    ? effort
      ? 'lineLoad'
      : 'lineLoadNoEffort'
    : effort
      ? 'lineBare'
      : 'lineBareNoEffort';
  const text = t(`cycle.review.lifts.${key}`, { value, load, effort });
  return (
    <Rich text={variant ? t('cycle.review.lifts.lineVariant', { variant, rest: text }) : text} />
  );
}

function LiftRow({
  lift,
  lang,
  pain,
}: {
  lift: LiftChange;
  lang: Language;
  pain: PainRow | undefined;
}) {
  const { t } = useTranslation();
  const figure = liftFigure(lift);
  const { start, end } = lift;
  const name = exerciseName((end ?? start)?.exerciseId ?? '', lang);
  const caption =
    figure.kind === 'percent'
      ? 'pctCap'
      : figure.kind === 'reps'
        ? 'repsCap'
        : figure.kind === 'harder'
          ? 'harderCap'
          : figure.kind === 'held'
            ? lift.status === 'equipment-max'
              ? 'atMaxCap'
              : 'heldCap'
            : null;
  const endLoad =
    end?.load && end.load.kind !== 'bodyweight' ? loadText(t, lang, tokenOf(end.load)) : undefined;
  const why: { icon: IconName; text: string } | undefined =
    pain && endLoad
      ? {
          icon: 'stop',
          text: t('cycle.review.lifts.heldPain', {
            load: endLoad,
            date: dateFormat(lang, pain.at),
          }),
        }
      : lift.status === 'equipment-max' && endLoad
        ? { icon: 'bag', text: t('cycle.review.lifts.atMaxWhy', { load: endLoad }) }
        : lift.status === 'equipment-max'
          ? { icon: 'bag', text: t('cycle.review.lifts.atMaxWhyBare') }
          : undefined;
  const sr =
    figure.kind === 'percent'
      ? t('cycle.review.lifts.percentSr', { name, percent: figure.value })
      : figure.kind === 'reps'
        ? t('cycle.review.lifts.repsSr', { name, count: figure.value })
        : undefined;
  return (
    <li className={styles.lf}>
      <div className={styles.lfFig} aria-hidden={sr ? true : undefined}>
        {figure.kind === 'percent' || figure.kind === 'reps' ? (
          <span className={`${styles.num} ${styles.lfN}`}>
            +{figure.value}
            <small>{figure.kind === 'percent' ? ' %' : NBSP + t('labels.unit.reps')}</small>
          </span>
        ) : figure.kind === 'none' ? (
          <span className={`${styles.num} ${styles.lfN}`}>–</span>
        ) : (
          <span className={`${styles.glyph} ${figure.kind === 'held' ? styles.glyphMuted : ''}`}>
            <Icon name={figure.kind === 'harder' ? 'step-up' : 'equals'} />
          </span>
        )}
        {caption ? (
          <span className={styles.lfCap}>{t(`cycle.review.lifts.${caption}`)}</span>
        ) : null}
      </div>
      <span className={styles.lfName}>{name}</span>
      {sr ? <span className={styles.srOnly}>{sr}</span> : null}
      <dl className={styles.lfEnds}>
        {start ? (
          <>
            <dt>{t('cycle.review.lifts.start')}</dt>
            <dd>
              {readingText(
                t,
                lang,
                start,
                lift.variantChanged ? exerciseName(start.exerciseId, lang) : undefined,
              )}
            </dd>
          </>
        ) : null}
        {end ? (
          <>
            <dt>{t('cycle.review.lifts.end')}</dt>
            <dd>
              {readingText(
                t,
                lang,
                end,
                lift.variantChanged ? exerciseName(end.exerciseId, lang) : undefined,
              )}
            </dd>
          </>
        ) : null}
      </dl>
      {why ? (
        <span className={styles.lfWhy}>
          <Icon name={why.icon} size={20} />
          <span>{why.text}</span>
        </span>
      ) : null}
    </li>
  );
}

/** Up to two names, then how many more. */
function buyNextLine(t: TFunction, lang: Language, ids: readonly string[]): string {
  const shown = ids.slice(0, 2).map((id) => exerciseName(id, lang));
  const names = capFirst(new Intl.ListFormat(lang, { type: 'conjunction' }).format(shown), lang);
  const more = ids.length - shown.length;
  return more > 0
    ? t('cycle.review.lifts.nudgeSubMore', { names, count: more })
    : t('cycle.review.lifts.nudgeSub', { names });
}

/* ------------------------------------------------------------------ body */

function BodySection({ review, lang }: { review: CycleReview; lang: Language }) {
  const { t } = useTranslation();
  const cells = [
    { key: 'weight' as const, trend: review.body.weight, unit: 'kg' as const },
    { key: 'waist' as const, trend: review.body.waist, unit: 'cm' as const },
  ].flatMap(({ key, trend, unit }) =>
    trend.delta ? [{ key, trend, unit, weeks: trend.delta.weeks }] : [],
  );
  const count = Math.max(review.body.weight.points.length, review.body.waist.points.length);
  // The comparison needs time between the first and the last check-in, not the cycle's length.
  const dates = [...review.body.weight.points, ...review.body.waist.points]
    .map((p) => p.date)
    .sort();
  const spanWeeks =
    dates.length > 1
      ? Math.floor(
          (Date.parse(dates[dates.length - 1]!) - Date.parse(dates[0]!)) / (7 * 86_400_000),
        )
      : 0;
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  return (
    <section className={styles.sec}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle}>{t('cycle.review.body.title')}</h2>
        {cells.length > 0 ? (
          <p>
            {t('cycle.review.body.intro', {
              count: Math.max(...cells.map((c) => c.trend.points.length)),
              weeks: Math.max(...cells.map((c) => c.weeks)),
            })}
          </p>
        ) : null}
      </div>
      {cells.length > 0 ? (
        <>
          <div className={styles.body2}>
            {cells.map(({ key, trend, unit }) => {
              const { from, to } = bodyFigure(trend.points);
              const diff = Math.round((to - from) * 2) / 2;
              const label = t(`cycle.review.body.${key}`);
              const unitText = t(`cycle.review.body.${unit}`);
              return (
                <div key={key} className={styles.body2Cell}>
                  <span className={styles.body2Label}>{label}</span>
                  <CompareFigure
                    size="medium"
                    from={number.format(from)}
                    to={number.format(to)}
                    unit={unitText}
                    srText={t('cycle.review.body.sr', {
                      label,
                      from: number.format(from),
                      to: number.format(to),
                      unit: unitText,
                    })}
                    tag={
                      diff === 0 ? undefined : (
                        <ChangeTag
                          tag={{
                            icon: diff > 0 ? 'arrow-up' : 'arrow-down',
                            text: `${number.format(Math.abs(diff))}${NBSP}${unitText}`,
                          }}
                        />
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          <a
            className={styles.link}
            href={routeHref({ name: 'body' })}
            onClick={(event) => handleLinkClick(event, routeHref({ name: 'body' }))}
          >
            {t('cycle.review.seeProgress')}
          </a>
        </>
      ) : (
        <p className={styles.note}>
          <Icon name="scale" size={20} />
          <span>
            {count === 0
              ? t('cycle.review.body.none')
              : t('cycle.review.body.few', { count, weeks: spanWeeks })}
          </span>
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ pain */

function PainLine({ row, lang }: { row: PainRow; lang: Language }) {
  const { t } = useTranslation();
  const date = dateFormat(lang, row.at);
  const after = row.after
    ? row.after.kind === 'clear'
      ? t('cycle.review.pain.afterClear')
      : t('cycle.review.pain.afterAgain', { date: dateFormat(lang, row.after.at) })
    : '';
  const text = row.answer
    ? t('cycle.review.pain.line', {
        date,
        answer: t(`cycle.review.pain.answers.${row.answer}`),
        after,
      })
    : t('cycle.review.pain.unanswered', { date });
  return (
    <div className={styles.painRow}>
      <span className={`${styles.well} ${styles.wellPain}`}>
        <Icon name="stop" />
      </span>
      <div>
        <b>{exerciseName(row.exerciseId, lang)}</b>
        <span>
          <Rich text={text.trim()} />
        </span>
      </div>
    </div>
  );
}
