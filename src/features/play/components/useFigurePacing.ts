import { useMemo } from 'react';
import type { Tempo } from '@/domain';
import { tempoPoint, type FigurePacing } from '@/motion/figure';
import type { TempoPacer } from '../signals';

/**
 * Feeds the figure from the tempo strip's own clock: the same start time and tempo. Without a
 * tempo the figure loops at its neutral pace; the strip stopped, `read` answers null.
 */
export function useFigurePacing(
  tempo: Tempo | undefined,
  pacer: TempoPacer,
): FigurePacing | undefined {
  const { startedAt } = pacer;
  const down = tempo?.down;
  const pause = tempo?.pause;
  const up = tempo?.up;
  return useMemo(() => {
    if (down === undefined || pause === undefined || up === undefined) return undefined;
    const current = { down, pause, up };
    return {
      tempo: current,
      read: () =>
        startedAt === null ? null : tempoPoint(current, (Date.now() - startedAt) / 1000),
    };
  }, [startedAt, down, pause, up]);
}
