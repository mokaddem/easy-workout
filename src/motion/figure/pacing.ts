import type { LoopPhase } from '@/domain';

export type TempoPhase = 'down' | 'pause' | 'up';

/**
 * Where the player's tempo clock stands: the phase of the rep and how far through it (0..1), and
 * which rep it is (from 0), so a loop of several reps (one per arm) runs through them in turn.
 */
export interface TempoPoint {
  phase: TempoPhase;
  progress: number;
  rep?: number;
}

/**
 * A source that tells the figure where the player's tempo clock is. The figure only reads it:
 * the clock belongs to the player and the animation never drives it.
 */
export interface FigurePacing {
  /** The prescribed tempo, in seconds. */
  tempo: { down: number; pause: number; up: number };
  /** Called every frame while the figure moves; null when the pacer is not running (neutral loop). */
  read: () => TempoPoint | null;
}

/** The tempo phase and progress `elapsed` seconds after the pacer started (reps repeat). */
export function tempoPoint(
  tempo: { down: number; pause: number; up: number },
  elapsed: number,
): TempoPoint {
  const cycle = tempo.down + tempo.pause + tempo.up;
  if (cycle <= 0) return { phase: 'down', progress: 0, rep: 0 };
  const rep = Math.floor(elapsed / cycle);
  const into = elapsed - rep * cycle;
  if (into < tempo.down) return { phase: 'down', progress: into / tempo.down, rep };
  if (into < tempo.down + tempo.pause)
    return { phase: 'pause', progress: (into - tempo.down) / tempo.pause, rep };
  return { phase: 'up', progress: (into - tempo.down - tempo.pause) / tempo.up, rep };
}

/**
 * Counts reps for a source whose points carry no `rep`: a new rep each time the clock comes back
 * to lowering.
 */
export function repCounter(): (point: TempoPoint) => number {
  let rep = 0;
  let last: TempoPhase | null = null;
  return (point) => {
    if (point.rep !== undefined) return point.rep;
    if (point.phase === 'down' && last !== null && last !== 'down') rep++;
    last = point.phase;
    return rep;
  };
}

export const PHASE_OF_TEMPO: Record<TempoPhase, LoopPhase> = {
  down: 'eccentric',
  pause: 'pause',
  up: 'concentric',
};
