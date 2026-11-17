import type { TFunction } from 'i18next';
import { BAND_LEVELS } from '@/domain';
import type { Language, ProgressionNote } from '@/domain';
import { numberText, parseToken, type ChangeTagData } from '@/features/adapt/format';

const up = (t: TFunction, text: string): ChangeTagData => ({
  icon: 'arrow-up',
  text,
  srPrefix: t('adapt.detail.tag.srUp'),
});
const down = (t: TFunction, text: string): ChangeTagData => ({
  icon: 'arrow-down',
  text,
  srPrefix: t('adapt.detail.tag.srDown'),
});

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** The pill beside a progression note on the timeline: what moved, in a few words. */
export function noteTag(
  t: TFunction,
  lang: Language,
  note: ProgressionNote,
  assisted: boolean,
): ChangeTagData | undefined {
  const { from, to } = note.params;
  if (note.code === 'from-test')
    // The medal marks a record; the cast keeps the tag's icon union narrow elsewhere.
    return { icon: 'target' as ChangeTagData['icon'], text: t('stats.exercise.testTag') };
  if (note.code === 'added-load-start') return up(t, t('adapt.detail.tag.added'));
  if (typeof from === 'string' && typeof to === 'string') {
    const a = parseToken(from);
    const b = parseToken(to);
    if (a && b && (a.kind === 'kg' || a.kind === 'added') && a.kind === b.kind) {
      const d = Math.round((b.kg - a.kg) * 100) / 100;
      if (d === 0) return undefined;
      const text = t('adapt.detail.tag.kg', { value: numberText(Math.abs(d), lang) });
      return d > 0 ? up(t, text) : down(t, text);
    }
    if (a?.kind === 'band' && b?.kind === 'band') {
      const heavier = BAND_LEVELS.indexOf(b.level) > BAND_LEVELS.indexOf(a.level);
      if (assisted)
        return heavier
          ? down(t, t('adapt.detail.tag.moreHelp'))
          : up(t, t('adapt.detail.tag.lessHelp'));
      return heavier
        ? up(t, t('adapt.detail.tag.heavier'))
        : down(t, t('adapt.detail.tag.lighter'));
    }
    return undefined;
  }
  const a = num(from);
  const b = num(to);
  if (a !== undefined && b !== undefined && a !== b) {
    const diff = Math.abs(b - a);
    const seconds = note.code.startsWith('time-') || note.params.seconds !== undefined;
    const text = t(seconds ? 'adapt.detail.tag.seconds' : 'adapt.detail.tag.reps', {
      count: diff,
    });
    return b > a ? up(t, text) : down(t, text);
  }
  return undefined;
}
