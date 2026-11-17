import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { nearestIndex } from './scales';

export interface InspectOptions {
  /** X of each entry in pixels, from the left edge of the plot wrapper. */
  xs: readonly number[];
  /** The entry being looked at; null = the latest. */
  selected: number | null;
  onSelect: (index: number | null) => void;
}

/**
 * Touch, mouse and keyboard inspection of a chart: the pointer snaps to the nearest entry
 * anywhere in the plot, arrows step one entry, Escape goes back to the latest. Vertical scroll
 * stays with the page.
 */
export function useInspect({ xs, selected, onSelect }: InspectOptions) {
  const down = useRef(false);
  const pick = (event: PointerEvent<HTMLElement>) => {
    if (xs.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect(nearestIndex(xs, event.clientX - rect.left));
  };
  return {
    tabIndex: 0,
    role: 'group' as const,
    style: { touchAction: 'pan-y' } as const,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      down.current = true;
      pick(event);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (down.current || event.pointerType === 'mouse') pick(event);
    },
    onPointerUp() {
      down.current = false;
    },
    onPointerCancel() {
      down.current = false;
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (xs.length === 0) return;
      const at = selected ?? xs.length - 1;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onSelect(Math.max(0, at - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onSelect(Math.min(xs.length - 1, at + 1));
      } else if (event.key === 'Escape' && selected !== null) {
        event.preventDefault();
        event.stopPropagation();
        onSelect(null);
      }
    },
  };
}
