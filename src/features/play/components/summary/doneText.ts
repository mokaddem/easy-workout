import type { TFunction } from 'i18next';
import type { Language } from '@/domain';
import { loadText, numberText, tokenOf } from '@/features/adapt';
import type { ExerciseDone } from './rows';

/** What was done in an exercise, as one line with `<b>` marks (render it with `<Rich>`). */
export function doneText(t: TFunction, lang: Language, row: ExerciseDone): string {
  const count = row.values.length;
  const painted = row.flag === 'pain';
  if (row.flag === 'no-equipment')
    return t('adapt.summary.done.noEquipment', { count, total: row.total });
  if (count === 0) return painted ? t('adapt.summary.done.pain') : '';

  const list = row.values.map((v) => numberText(v, lang)).join(', ');
  const time = row.unit === 'seconds';
  const values = time ? `${list}${' '}${t('labels.unit.s')}` : list;
  const partial = painted || count < row.total;

  let text: string;
  if (row.group && !time)
    text = t('adapt.summary.done.rounds', { count, values: `${list} ${t('labels.unit.reps')}` });
  else if (time)
    text = t(partial ? 'play.summary.ofTotalTime' : 'play.summary.doneTime', {
      count,
      total: row.total,
      values,
    });
  else
    text = t(partial ? 'adapt.summary.done.ofTotal' : 'adapt.summary.done.sets', {
      count,
      total: row.total,
      values,
    });

  const loadToken = tokenOf(row.load);
  if (row.load && row.load.kind !== 'bodyweight')
    text = t('adapt.summary.done.atLoad', { text, load: loadText(t, lang, loadToken) });
  if (painted) text = t('adapt.summary.done.thenPain', { text });
  return text;
}
