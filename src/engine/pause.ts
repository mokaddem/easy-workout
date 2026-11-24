import type { Settings } from '../domain';

const DAY_MS = 86_400_000;

/** Prompts that stay quiet while the programme is paused. */
export const PAUSE_HIDES = ['check-in', 'missed-day', 'lighter-week'] as const;
export type PausedPrompt = (typeof PAUSE_HIDES)[number];

/** The programme is paused. Only starting a programme session resumes it. */
export const isPaused = (settings: Pick<Settings, 'pause'>): boolean =>
  settings.pause !== undefined;

/** Which prompts to hide: all of them while paused, none otherwise. */
export const hiddenPrompts = (settings: Pick<Settings, 'pause'>): readonly PausedPrompt[] =>
  isPaused(settings) ? PAUSE_HIDES : [];

/** Whole days the programme has been paused. */
export function pausedDays(settings: Pick<Settings, 'pause'>, now: Date): number {
  if (!settings.pause) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(settings.pause.since)) / DAY_MS));
}

/**
 * Days a pause adds up to between the last session and `now`: paused days are part of the gap,
 * since nothing is trained meanwhile. A pause that started before the last session only counts
 * from that session on.
 */
export function pausedGapDays(
  settings: Pick<Settings, 'pause'>,
  lastSessionAt: string | undefined,
  now: Date,
): number {
  if (!settings.pause) return 0;
  const from = Math.max(
    Date.parse(settings.pause.since),
    lastSessionAt === undefined ? -Infinity : Date.parse(lastSessionAt),
  );
  return Math.max(0, (now.getTime() - from) / DAY_MS);
}
