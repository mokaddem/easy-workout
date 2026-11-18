import { useEffect, useMemo, useState, type ComponentType } from 'react';
import type { ExerciseAnimation } from '@/domain';
import type { FigureProps } from './Figure';

type Chunk = typeof import('./chunk');

let loaded: Chunk | undefined;
let pending: Promise<Chunk> | undefined;

/** One dynamic import for the runtime and every animation. */
function load(): Promise<Chunk> {
  pending ??= import('./chunk').then((chunk) => (loaded = chunk));
  return pending;
}

export interface LoadedFigure {
  Figure: ComponentType<FigureProps>;
  animation: ExerciseAnimation;
}

/**
 * The figure and the animation of an exercise, or undefined while the chunk loads and for an
 * exercise that has no animation. Once loaded, later calls answer on the first render.
 */
export function useFigure(exerciseId: string): LoadedFigure | undefined {
  const [chunk, setChunk] = useState<Chunk | undefined>(loaded);
  useEffect(() => {
    if (chunk) return;
    let live = true;
    void load().then((c) => {
      if (live) setChunk(c);
    });
    return () => {
      live = false;
    };
  }, [chunk]);
  return useMemo(() => {
    const animation = chunk?.animationFor(exerciseId);
    return chunk && animation ? { Figure: chunk.Figure, animation } : undefined;
  }, [chunk, exerciseId]);
}
