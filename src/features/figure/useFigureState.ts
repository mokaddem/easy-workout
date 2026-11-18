import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import type { ExerciseAnimation } from '@/domain';
import type { FigureProps } from '@/motion/figure';

type Chunk = typeof import('@/motion/figure/chunk');

let loaded: Chunk | undefined;
let pending: Promise<Chunk> | undefined;

/** The figure chunk, loaded once and shared with `useFigure` (the same dynamic import). */
function load(): Promise<Chunk> {
  pending ??= import('@/motion/figure/chunk').then((chunk) => (loaded = chunk));
  return pending;
}

export type FigureState =
  | { status: 'loading' | 'none' }
  | { status: 'ready'; Figure: ComponentType<FigureProps>; animation: ExerciseAnimation };

/**
 * The figure of an exercise with where it stands: `loading` while the chunk arrives, `none` for an
 * exercise that has no animation, `ready` with the figure and its animation.
 */
export function useFigureState(exerciseId: string): FigureState {
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
  return useMemo((): FigureState => {
    if (!chunk) return { status: 'loading' };
    const animation = chunk.animationFor(exerciseId);
    return animation ? { status: 'ready', Figure: chunk.Figure, animation } : { status: 'none' };
  }, [chunk, exerciseId]);
}
