import { useTranslation } from 'react-i18next';
import { itemKey, setGoal } from '@/engine';
import { noteChip, showsWhy } from '@/features/adapt';
import type { PlayContext } from './types';

export interface Why {
  /** The short line for the top of the animation slot. */
  text?: string;
  /** Pain safety cue: the stop glyph in danger text. */
  pain: boolean;
  /** First session at a new weight: the feel starts unpicked. */
  ask: boolean;
}

/** What the progression note of this set's exercise says, if anything. */
export function useWhy({ lang, log, step }: Pick<PlayContext, 'lang' | 'log' | 'step'>): Why {
  const { t } = useTranslation();
  const note = log.progression?.[itemKey(step.section, step.blockIndex, step.itemIndex)];
  const none = { pain: false, ask: false };
  if (!note || !showsWhy(note)) return none;
  const pain = note.code === 'pain-lighter';
  const ask = !!note.newLoad && !pain;
  if (!ask && step.set !== 1) return { ...none, pain: false };
  const target = step.planned.target;
  const range =
    target.kind === 'reps'
      ? { min: target.min, max: target.max }
      : target.kind === 'time'
        ? { min: target.minSec, max: target.maxSec }
        : {};
  const goal = setGoal(step.planned) ?? step.item.goal;
  const text = noteChip(t, lang, note, {
    exerciseId: step.item.exerciseId,
    ...range,
    ...(goal !== undefined && { goal }),
    ...(target.kind === 'time' && { time: true }),
    ...(ask && step.set > 1 && { later: true }),
  });
  return text === undefined ? none : { text, pain, ask };
}
