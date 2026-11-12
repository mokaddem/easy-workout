import type { QuickFocus } from '@/engine';
import { QUICK_FOCUSES } from '@/engine';
import type { Session } from '@/domain';

export const QUICK_MINUTES = [15, 20, 30, 45, 60] as const;
export type QuickMinutes = (typeof QUICK_MINUTES)[number];

export interface QuickChoices {
  minutes: QuickMinutes;
  focus: QuickFocus;
  bodyweightOnly: boolean;
}

export const DEFAULT_CHOICES: QuickChoices = { minutes: 30, focus: 'full', bodyweightOnly: false };

const KEY = 'ew.quick.choices';

/** Reads the choices kept for this visit; anything unexpected falls back to the defaults. */
export function loadChoices(): QuickChoices {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_CHOICES;
    const data = JSON.parse(raw) as Partial<QuickChoices> | null;
    const minutes = QUICK_MINUTES.find((m) => m === data?.minutes);
    const focus = QUICK_FOCUSES.find((f) => f === data?.focus);
    return {
      minutes: minutes ?? DEFAULT_CHOICES.minutes,
      focus: focus ?? DEFAULT_CHOICES.focus,
      bodyweightOnly: data?.bodyweightOnly === true,
    };
  } catch {
    return DEFAULT_CHOICES;
  }
}

export function saveChoices(choices: QuickChoices): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(choices));
  } catch {
    /* storage unavailable: the choices simply are not kept */
  }
}

/** Exercise ids in session order: warm-up, main work, finisher. */
export function exerciseSequence(session: Session): string[] {
  const ids: string[] = [];
  for (const section of [session.warmup, session.main, session.finisher])
    for (const block of section)
      if (block.type === 'straight') ids.push(block.item.exerciseId);
      else for (const item of block.items) ids.push(item.exerciseId);
  return ids;
}

/** Number of exercises of `after` that `before` did not have; 0 when the lists are identical. */
export function changedExercises(before: Session, after: Session): number {
  const a = exerciseSequence(before);
  const b = exerciseSequence(after);
  if (a.length === b.length && a.every((id, i) => id === b[i])) return 0;
  const pool = [...a];
  let added = 0;
  for (const id of b) {
    const at = pool.indexOf(id);
    if (at >= 0) pool.splice(at, 1);
    else added += 1;
  }
  // Same exercises in another order still counts as a change.
  return Math.max(added, 1);
}
