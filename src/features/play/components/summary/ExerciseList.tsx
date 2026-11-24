import { Tick } from '@/motion';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { handleLinkClick, routeHref } from '@/app/router';
import type { Answer, Language } from '@/domain';
import { parseDropped, type NextTimeLine } from '@/engine';
import {
  Rich,
  changeFigure,
  exerciseName,
  noteReason,
  tokenOf,
  type Figure,
} from '@/features/adapt';
import { Icon } from '@/ui/components';
import { doneText } from './doneText';
import { movesUp, splitFigure, type ExerciseDone } from './rows';
import styles from './ExerciseList.module.css';

export type ListMode = 'normal' | 'quick' | 'deload' | 'peak';

interface Props {
  rows: ExerciseDone[];
  lines: NextTimeLine[];
  answers: Answer[];
  logId: string;
  mode: ListMode;
  lang: Language;
  buyNext: string[];
  /** The session ran on a travel kit: what stood in for what, and what was left out. */
  travel?: { substitutions: Record<string, string>; dropped: string[] };
}

/** One row per main exercise: what was done, next time's figure, and why. */
export function ExerciseList({ rows, lines, answers, logId, mode, lang, buyNext, travel }: Props) {
  const { t } = useTranslation();
  const showFigure = mode === 'normal' || mode === 'peak';
  const pure = t('adapt.summary.same');

  return (
    <section className={styles.sec} aria-labelledby="summary-list">
      <div className={styles.head}>
        <h2 className={styles.title} id="summary-list">
          {t('adapt.summary.list.title')}
        </h2>
        {showFigure ? <p className={styles.sub}>{t('adapt.summary.list.sub')}</p> : null}
        {travel ? <p className={styles.sub}>{t('play.summary.travelList')}</p> : null}
        {mode === 'deload' ? <p className={styles.sub}>{t('adapt.summary.deload')}</p> : null}
        {mode === 'peak' ? <p className={styles.sub}>{t('adapt.summary.peak')}</p> : null}
      </div>
      <ul className={styles.list} data-figures={showFigure || undefined}>
        {showFigure ? (
          <li className={styles.cols} aria-hidden="true">
            {t('adapt.summary.list.caption')}
          </li>
        ) : null}
        {rows.map((row) => {
          const line = lines.find((l) => l.itemKey === row.key);
          const answer = answers.find(
            (a) => a.logId === logId && a.exerciseId === row.exerciseId && a.answer === 'swap',
          );
          const exercise = exerciseById.get(row.exerciseId);
          const assisted = exercise?.loadType === 'band-assisted';

          let figure: Figure | undefined;
          let reason: string | undefined;
          let swapped = false;
          const standsIn = travel?.substitutions[row.key];
          if (standsIn) {
            swapped = true;
            reason = t('programme.kit.swapChip', { name: exerciseName(standsIn, lang) });
          } else if (answer?.substituteId) {
            swapped = true;
            reason = t('adapt.summary.swapped', { name: exerciseName(answer.substituteId, lang) });
          } else if (row.notReached) {
            reason = t('adapt.summary.notReached');
          } else if (row.flag === 'no-equipment') {
            reason = t('adapt.summary.oneOff');
          }
          if (!swapped && !row.notReached && line && !travel) {
            const up = movesUp(line.before, line.after, assisted);
            const hold = mode === 'peak' && !up;
            figure = changeFigure(t, lang, line.before, hold ? line.before : line.after);
            if (!reason && !hold && line.note)
              reason = noteReason(t, lang, line.note, {
                exerciseId: row.exerciseId,
                ...(row.min !== undefined && { min: row.min }),
                ...(row.max !== undefined && { max: row.max }),
                ...(line.after.goal !== undefined && { goal: line.after.goal }),
                time: row.unit === 'seconds',
                from: tokenOf(line.before.load),
              });
            if (!reason && hold && line.note?.code === 'hold')
              reason = noteReason(t, lang, line.note);
          }
          const done = doneText(t, lang, row);
          const split = figure ? splitFigure(figure.next) : undefined;
          return (
            <li key={row.key} className={styles.row}>
              {showFigure ? (
                <div className={styles.fig}>
                  {swapped ? (
                    <Icon name="swap" size={28} />
                  ) : figure && figure.kind !== 'same' ? (
                    <>
                      <span className={styles.was}>
                        {figure.previous}
                        <Icon name="arrow-right" size={20} />
                      </span>
                      <FigureNow n={split!.n} unit={split!.unit} />
                    </>
                  ) : (
                    <>
                      <span className={styles.was}>
                        <Icon name="equals" size={20} />
                        {pure.replace(/^=\s*/, '')}
                      </span>
                      {split && split.n ? <FigureNow n={split.n} unit={split.unit} muted /> : null}
                    </>
                  )}
                </div>
              ) : null}
              <div className={styles.text}>
                <span className={styles.name}>{exerciseName(row.exerciseId, lang)}</span>
                {done ? (
                  <span className={styles.did} data-pain={row.flag === 'pain' || undefined}>
                    <Rich text={done} />
                  </span>
                ) : null}
                {reason ? <span className={styles.why}>{reason}</span> : null}
              </div>
            </li>
          );
        })}
        {(travel?.dropped ?? []).flatMap((entry) => {
          const dropped = parseDropped(entry);
          return dropped
            ? [
                <li key={entry} className={`${styles.row} ${styles.dropped}`}>
                  <div className={styles.text}>
                    <span className={styles.name}>{exerciseName(dropped.exerciseId, lang)}</span>
                    <span className={styles.why}>{t('programme.kit.droppedShort')}</span>
                  </div>
                </li>,
              ]
            : [];
        })}
      </ul>
      {buyNext.length > 0 && mode !== 'quick' ? (
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
              {buyNext.length === 1
                ? t('adapt.summary.buyNext.one', { name: exerciseName(buyNext[0]!, lang) })
                : t('adapt.summary.buyNext.many', { count: buyNext.length })}
            </span>
            <span className={styles.nudgeSub}>{t('adapt.summary.buyNext.cta')}</span>
          </span>
          <Icon name="chev-right" size={20} />
        </a>
      ) : null}
    </section>
  );
}

function FigureNow({ n, unit, muted }: { n: string; unit: string; muted?: boolean }) {
  const word = !/\d/.test(n);
  return (
    <span
      className={styles.now}
      data-muted={muted || undefined}
      data-word={word || undefined}
      data-long={n.length > 4 || undefined}
    >
      <Tick>{n}</Tick>
      {unit ? <small>{unit}</small> : null}
    </span>
  );
}
