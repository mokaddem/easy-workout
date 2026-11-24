import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useProfile } from '@/app/data';
import { itemKey, setGoal } from '@/engine';
import { exerciseName, noteChip, showsWhy, sparedJoint } from '@/features/adapt';
import type { PlayContext } from './types';

export interface Why {
  /** The short line for the top of the animation slot. */
  text?: string;
  /** Pain safety cue: the stop glyph in danger text. */
  pain: boolean;
  /** First session at a new weight: the feel starts unpicked. */
  ask: boolean;
  /** A glyph for what stands in for the usual load note: the travel kit's swap. */
  glyph?: 'swap';
}

/** What the progression note of this set's exercise says, if anything. */
export function useWhy({ lang, log, step }: Pick<PlayContext, 'lang' | 'log' | 'step'>): Why {
  const { t } = useTranslation();
  const profile = useProfile();
  const key = itemKey(step.section, step.blockIndex, step.itemIndex);
  const note = log.progression?.[key];
  const none = { pain: false, ask: false };
  const joint = sparedJoint(exerciseById.get(step.item.exerciseId), profile);
  // Nothing about the load to say: what shaped the session is the next best thing, on the first set.
  const fallback = (): Why => {
    if (step.set !== 1) return none;
    const from = log.adjustments?.travel?.substitutions[key];
    if (from)
      return {
        ...none,
        text: t('programme.kit.swapChip', { name: exerciseName(from, lang) }),
        glyph: 'swap',
      };
    if (log.adjustments?.doseCapped?.includes(key))
      return {
        ...none,
        text: t('why.constraint.cappedChip', {
          joint: joint ? t(`labels.joint.${joint}.your`) : t('why.constraint.joint'),
        }),
      };
    if (
      log.adjustments?.reentry !== undefined &&
      step.section === 'main' &&
      step.blockIndex === 0 &&
      step.itemIndex === 0
    )
      return { ...none, text: t('why.constraint.reentryChip') };
    return none;
  };
  if (!note || !showsWhy(note)) return fallback();
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
    ...(joint && { joint }),
  });
  return text === undefined ? fallback() : { text, pain, ask };
}
