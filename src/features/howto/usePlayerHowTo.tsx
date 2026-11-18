import { useCallback, useState, type ReactNode } from 'react';
import type { EquipmentKind } from '@/domain';
import type { FigurePacing } from '@/motion/figure';
import { HowToSheet, type HowToRest } from './HowToSheet';

/**
 * The how-to of a player screen: `open` for the figure's tap, `sheet` to render once. The sheet is
 * state of the screen that owns it, so it goes when that screen is replaced (a rest ending, a
 * hold or phase changing, the side switching); `rest` adds the countdown band and closes the
 * sheet at 0.
 */
export function usePlayerHowTo({
  exerciseId,
  equipment,
  side,
  pacing,
  rest,
  screenKey,
}: {
  exerciseId: string;
  equipment?: readonly EquipmentKind[] | undefined;
  side?: 'left' | 'right' | undefined;
  pacing?: FigurePacing | undefined;
  rest?: HowToRest | undefined;
  /** What the screen under the sheet shows: when it changes, the sheet closes. */
  screenKey: string;
}): { open: () => void; isOpen: boolean; sheet: ReactNode } {
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const shown = openedOn === screenKey;
  const open = useCallback(() => setOpenedOn(screenKey), [screenKey]);
  const close = useCallback(() => setOpenedOn(null), []);
  const sheet = (
    <HowToSheet
      open={shown}
      onClose={close}
      exerciseId={exerciseId}
      equipment={equipment}
      side={side === 'right' ? 2 : 1}
      pacing={pacing}
      rest={rest}
    />
  );
  return { open, isOpen: shown, sheet };
}
