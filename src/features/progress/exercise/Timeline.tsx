import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise, Language, SessionLog } from '@/domain';
import type { ExercisePoint, ExerciseRecord, TimelineEntry } from '@/engine';
import { ChangeTag } from '@/features/adapt/ChangeTag';
import { Rich } from '@/features/adapt/Rich';
import { noteDetail } from '@/features/adapt/format';
import { recordSetText } from '@/features/records/format';
import { Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { dayDate, longDate } from '../charts/format';
import { dotOf, letterOf } from './logic';
import { noteTag } from './noteTag';
import styles from './exercise.module.css';

export const TIMELINE_SHOWN = 4;

type Dot = NonNullable<ReturnType<typeof dotOf>> | 'record';

export interface TimelineProps {
  entries: readonly TimelineEntry[];
  /** Sets that beat the exercise's best, marked among the changes. */
  records?: readonly ExerciseRecord[];
  points: readonly ExercisePoint[];
  logs: readonly SessionLog[];
  programmes: Parameters<typeof letterOf>[1];
  exercise: Exercise | undefined;
  exerciseId: string;
}

/** What changed and why, newest first: the words of the session detail, with a tag. */
export function Timeline({
  entries,
  records = [],
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

  const whereOf = (logId: string, point: ExercisePoint | undefined) => {
    const log = logs.find((l) => l.id === logId);
    const letter = log ? letterOf(log, programmes) : undefined;
    return point?.source === 'quick'
      ? t('stats.exercise.whenQuick')
      : letter
        ? t('stats.exercise.whenSession', { letter })
        : undefined;
  };

  const changes = entries
    .map((entry) => {
      const dot = dotOf(entry.note);
      if (!dot) return undefined;
      const point = points.find((p) => p.logId === entry.logId);
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
      const where = whereOf(entry.logId, point);
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
        dot: Dot;
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

  const marks = records.map((record) => ({
    key: `${record.logId}-record`,
    code: 'record',
    at: record.at,
    repeats: 1,
    since: '',
    dot: 'record' as const,
    when: [
      dayDate(record.at, lang),
      whereOf(
        record.logId,
        points.find((p) => p.logId === record.logId),
      ),
    ]
      .filter(Boolean)
      .join(', '),
    tag: undefined,
    text: t('stats.exercise.record', {
      set: recordSetText(t, lang, record.set),
      previous: recordSetText(t, lang, record.previous),
    }),
  }));
  const shown = [...marks, ...changes].sort((a, b) => b.at.localeCompare(a.at));

  if (shown.length === 0) return null;
  const visible = all ? shown : shown.slice(0, TIMELINE_SHOWN);
  return (
    <>
      <ol className={styles.tl}>
        {visible.map((item) => (
          <li key={item.key} className={styles.tlItem}>
            {item.dot === 'record' ? (
              <span className={styles.tlMedal} aria-hidden="true">
                <Icon name="medal" size={20} />
              </span>
            ) : (
              <span
                className={cx(
                  styles.tlDot,
                  item.dot === 'hold' && styles.tlDotHold,
                  item.dot === 'pain' && styles.tlDotPain,
                )}
                aria-hidden="true"
              />
            )}
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
