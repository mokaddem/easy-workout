import { tempoPoint, type FigurePacing } from '@/motion/figure';

export type Speed = 'normal' | 'slow';

type Tempo = { down: number; pause: number; up: number };

/** Seconds per phase of the neutral loop, and the slow one (twice as long). */
export const TEMPOS: Record<Speed, Tempo> = {
  normal: { down: 1.4, pause: 0.25, up: 1.1 },
  slow: { down: 2.8, pause: 0.5, up: 2.2 },
};

const cycle = (t: Tempo) => t.down + t.pause + t.up;

/**
 * The how-to's own clock: loops at a chosen speed, can be paused and keeps its place in the rep
 * when the speed changes.
 */
export class StageClock {
  private speed: Speed = 'normal';
  private base = 0;
  private origin: number;
  private paused = false;

  constructor(private readonly now: () => number = () => performance.now()) {
    this.origin = this.now();
  }

  private elapsed(): number {
    return this.paused ? this.base : this.base + (this.now() - this.origin) / 1000;
  }

  setSpeed(speed: Speed): void {
    if (speed === this.speed) return;
    const at = this.elapsed();
    this.base = (at * cycle(TEMPOS[speed])) / cycle(TEMPOS[this.speed]);
    this.origin = this.now();
    this.speed = speed;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.base = this.elapsed();
    this.origin = this.now();
    this.paused = paused;
  }

  pacing(): FigurePacing {
    return {
      tempo: TEMPOS[this.speed],
      read: () => tempoPoint(TEMPOS[this.speed], this.elapsed()),
    };
  }
}

/** Wraps the player's pacing so the figure can be stopped where it stands. */
export function pausable(source: FigurePacing, isPaused: () => boolean): FigurePacing {
  let frozen: ReturnType<FigurePacing['read']> | undefined;
  return {
    tempo: source.tempo,
    read: () => {
      if (!isPaused()) {
        frozen = undefined;
        return source.read();
      }
      frozen ??= source.read();
      return frozen;
    },
  };
}
