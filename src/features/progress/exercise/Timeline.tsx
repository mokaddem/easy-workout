import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise, Language, SessionLog } from '@/domain';
import type { ExercisePoint, TimelineEntry } from '@/engine';
import { ChangeTag } from '@/features/adapt/ChangeTag';
import { Rich } from '@/features/adapt/Rich';
import { noteDetail } from '@/features/adapt/format';
import { cx } from '@/ui/components/cx';
import { dayDate, longDate } from '../charts/format';
import { dotOf, letterOf } from './logic';
import { noteTag } from './noteTag';
import styles from './exercise.module.css';

export const TIMELINE_SHOWN = 4;

export interface TimelineProps {
  entries: readonly TimelineEntry[];
  points: readonly ExercisePoint[];
  logs: readonly SessionLog[];
  programmes: Parameters<typeof letterOf>[1];
  exercise: Exercise | undefined;
  exerciseId: string;
}

/** What changed and why, newest first: the words of the session detail, with a tag. */
export function Timeline({
  entries,
  points,
  logs,
  programmes,
  exercise,
  exerciseId,
}: TimelineProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [all, setAll] = useState(false);
  const assisted = exercise?.loadType === 'band-assisted';

  const shown = entries
    .map((entry) => {
      const dot = dotOf(entry.note);
      if (!dot) return undefined;
      const point = points.find((p) => p.logId === entry.logId);
      const log = logs.find((l) => l.id === entry.logId);
      const time = point?.best?.unit === 'seconds' || point?.target.kind === 'time';
      const text =
        entry.note.code === 'from-test'
          ? t('stats.exercise.fromTest', {
              date: longDate(String(entry.note.params.date ?? point?.date ?? ''), lang),
              result: t(time ? 'stats.exercise.resultSeconds' : 'stats.exercise.resultReps', {
                count: Number(entry.note.params.test ?? 0),
              }),
              goal: t(time ? 'stats.exercise.resultSeconds' : 'stats.exercise.resultReps', {
                count: Number(entry.note.params.to ?? 0),
              }),
            })
          : noteDetail(t, lang, entry.note, {
              exerciseId,
              ...(point?.range && { min: point.range.min, max: point.range.max }),
              ...(time && { time }),
            });
      if (!text) return undefined;
      const letter = log ? letterOf(log, programmes) : undefined;
      const where =
        point?.source === 'quick'
          ? t('stats.exercise.whenQuick')
          : letter
            ? t('stats.exercise.whenSession', { letter })
            : undefined;
      return {
        key: `${entry.logId}-${entry.note.code}`,
        code: entry.note.code,
        at: entry.at,
        repeats: 1,
        since: '',
        dot,
        when: [dayDate(entry.at, lang), where].filter(Boolean).join(', '),
        tag: noteTag(t, lang, entry.note, assisted),
        text,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== undefined)
    // A hold repeated session after session says the same thing: once, with how long it lasted.
    .reduce<
      {
        key: string;
        code: string;
        at: string;
        repeats: number;
        since: string;
        dot: NonNullable<ReturnType<typeof dotOf>>;
        when: string;
        tag: ReturnType<typeof noteTag>;
        text: string;
      }[]
    >((out, item) => {
      const last = out[out.length - 1];
      if (last && item.dot === 'hold' && last.dot === 'hold' && last.code === item.code) {
        last.repeats += 1;
        last.since = item.at;
      } else out.push(item);
      return out;
    }, []);

  if (shown.length === 0) return null;
  const visible = all ? shown : shown.slice(0, TIMELINE_SHOWN);
  return (
    <>
      <ol className={styles.tl}>
        {visible.map((item) => (
          <li key={item.key} className={styles.tlItem}>
            <span
              className={cx(
                styles.tlDot,
                item.dot === 'hold' && styles.tlDotHold,
                item.dot === 'pain' && styles.tlDotPain,
              )}
              aria-hidden="true"
            />
            <div className={styles.tlBody}>
              <div className={styles.tlWhen}>
                <span>{item.when}</span>
                {item.tag ? <ChangeTag tag={item.tag} /> : null}
              </div>
              <p className={styles.tlText}>
                <Rich text={item.text} />
              </p>
              {item.repeats > 1 ? (
                <p className={styles.tlWhen}>
                  {t('stats.exercise.sameSince', {
                    count: item.repeats,
                    date: dayDate(item.since, lang),
                  })}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {shown.length > TIMELINE_SHOWN ? (
        <div className={styles.tlMore}>
          <button type="button" className={styles.ghost} onClick={() => setAll((v) => !v)}>
            {all
              ? t('stats.exercise.seeLess')
              : t('stats.exercise.seeMoreChanges', { count: shown.length - TIMELINE_SHOWN })}
          </button>
        </div>
      ) : null}
    </>
  );
}
