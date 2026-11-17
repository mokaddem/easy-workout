import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import type { Language, ProgressionNote, SessionItem } from '@/domain';
import {
  deltaText,
  noteReason,
  secondsText,
  showsWhy,
  type ChangeTagData,
  type NoteContext,
} from '../../adapt/format';

const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** The pill of the change a note made: "↑ 2 kg", "↑ 1 rep", "More help"; none when nothing moved. */
export function noteTag(
  t: TFunction,
  lang: Language,
  exerciseId: string,
  note: ProgressionNote,
): ChangeTagData | undefined {
  const up = (text: string): ChangeTagData => ({
    icon: 'arrow-up',
    text,
    srPrefix: t('adapt.detail.tag.srUp'),
  });
  const down = (text: string): ChangeTagData => ({
    icon: 'arrow-down',
    text,
    srPrefix: t('adapt.detail.tag.srDown'),
  });
  const p = note.params;
  const assisted = exerciseById.get(exerciseId)?.loadType === 'band-assisted';
  switch (note.code) {
    case 'load-up':
    case 'load-up-low':
    case 'load-down':
    case 'added-load-start': {
      const delta = deltaText(lang, str(p.from), str(p.to) ?? str(p.load));
      if (delta === undefined) return up(t('adapt.detail.tag.added'));
      return delta.startsWith('+') ? up(delta) : down(delta.replace('−', ''));
    }
    case 'band-heavier':
      return assisted ? down(t('adapt.detail.tag.moreHelp')) : up(t('adapt.detail.tag.heavier'));
    case 'band-lighter':
      return assisted ? up(t('adapt.detail.tag.lessHelp')) : down(t('adapt.detail.tag.lighter'));
    case 'reps-up':
    case 'from-test': {
      const diff = (num(p.to) ?? 0) - (num(p.from) ?? 0);
      return diff > 0 ? up(t('adapt.detail.tag.reps', { count: diff })) : undefined;
    }
    case 'work-longer': {
      const diff = (num(p.to) ?? 0) - (num(p.from) ?? 0);
      return diff > 0 ? up(secondsText(diff, lang)) : undefined;
    }
    default:
      return undefined;
  }
}

/** The why of an exercise in a session: the tag and the short reason. */
export function whyOf(
  t: TFunction,
  lang: Language,
  item: SessionItem | undefined,
  note: ProgressionNote | undefined,
): { tag?: ChangeTagData; reason?: string } | undefined {
  if (!item || !note || !showsWhy(note)) return undefined;
  const target = item.target;
  const ctx: NoteContext = {
    exerciseId: item.exerciseId,
    ...(target.kind === 'reps' && { min: target.min, max: target.max }),
    ...(target.kind === 'time' && { min: target.minSec, max: target.maxSec, time: true }),
    ...(item.goal !== undefined && { goal: item.goal }),
  };
  const tag = noteTag(t, lang, item.exerciseId, note);
  const reason = noteReason(t, lang, note, ctx);
  if (!tag && !reason) return undefined;
  return { ...(tag && { tag }), ...(reason && { reason }) };
}
