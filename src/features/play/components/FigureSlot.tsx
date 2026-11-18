import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EquipmentKind } from '@/domain';
import { useArrival, useFigureState, useFiguresAnimated } from '@/features/figure';
import type { FigurePacing } from '@/motion/figure';
import { Icon, type IconName } from '@/ui/components';
import styles from '../Play.module.css';
import { WhyChip } from './parts';
import type { Why } from './why';

interface Box {
  slotWidth: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The room left for the figure once the chip, the cue and the mark have taken theirs. */
function measure(slot: HTMLElement): Box | null {
  const W = slot.clientWidth;
  const H = slot.clientHeight;
  if (W <= 0 || H <= 0) return null;
  let [top, bottom, left, right] = [0, 0, 0, 0];
  for (const el of slot.querySelectorAll<HTMLElement>('[data-reserve]')) {
    if (getComputedStyle(el).display === 'none') continue;
    let side = el.dataset.reserve;
    if (side === 'chip') side = H < 140 ? 'left' : 'top';
    if (side === 'top') top = Math.max(top, el.offsetTop + el.offsetHeight);
    else if (side === 'bottom') bottom = Math.max(bottom, H - el.offsetTop + 2);
    else if (side === 'left') left = Math.max(left, el.offsetLeft + el.offsetWidth);
    else if (side === 'right' && H < 200) right = Math.max(right, W - el.offsetLeft);
  }
  const width = Math.round(W - left - right);
  const height = Math.round(H - top - bottom);
  return width > 0 && height > 0 ? { slotWidth: W, left, top, width, height } : null;
}

/**
 * The exercise figure of the player: one button over the whole slot that opens the how-to. The
 * why chip, the cue and the enlarge mark reserve their boxes and the figure is framed in what is
 * left. Without an animation the slot shows the equipment glyph and the cue.
 */
export function FigureSlot({
  exerciseId,
  name,
  glyph,
  cue,
  why,
  equipment,
  side,
  hold,
  rest,
  pacing,
  covered,
  onOpenHowTo,
}: {
  exerciseId: string;
  name: string;
  glyph: IconName;
  cue?: string | undefined;
  why?: Why | undefined;
  equipment?: readonly EquipmentKind[] | undefined;
  /** The side being worked, for a per-side move: the second side shows the mirror image. */
  side?: 'left' | 'right' | undefined;
  /** A hold or a recovery: the key pose, still. */
  hold?: boolean | undefined;
  /** On the yellow rest screen: the figure takes the rest tones. */
  rest?: boolean | undefined;
  pacing?: FigurePacing | undefined;
  /** The how-to sheet is open over the slot: one figure moves at a time, so this one rests. */
  covered?: boolean | undefined;
  onOpenHowTo?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const state = useFigureState(exerciseId);
  const figure = state.status === 'ready' ? state : undefined;
  const animated = useFiguresAnimated();
  const late = useArrival(state.status === 'loading', !!figure);
  const slotRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const chip = !!why?.text;

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const update = () => {
      const next = measure(slot);
      setBox((prev) =>
        prev &&
        next &&
        prev.slotWidth === next.slotWidth &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    for (const el of slot.querySelectorAll('[data-reserve]')) observer.observe(el);
    return () => observer.disconnect();
  }, [chip, why?.text, cue, state.status]);

  // Tell the slot which phase of the tempo the figure is following (for tests and styling).
  const tracked = useMemo<FigurePacing | undefined>(
    () =>
      pacing && {
        tempo: pacing.tempo,
        read: () => {
          const point = pacing.read();
          const el = slotRef.current;
          if (el && el.dataset.phase !== point?.phase) {
            if (point) el.dataset.phase = point.phase;
            else delete el.dataset.phase;
          }
          return point;
        },
      },
    [pacing],
  );

  const second = side === 'right';
  const sideLabel = side ? t('play.side.pill', { side: t(`play.side.${side}`) }) : undefined;

  return (
    <div
      ref={slotRef}
      className={styles.slot}
      data-state={state.status}
      {...(rest && { 'data-figure-tone': 'rest' })}
    >
      {state.status === 'loading' ? <div className={styles.slotWait} aria-hidden="true" /> : null}
      {state.status === 'none' ? <Icon className={styles.slotGlyph} name={glyph} /> : null}
      {figure && box ? (
        <div
          className={`${styles.slotFigure} ${second ? styles.slotSide2 : late ? styles.slotLate : ''}`}
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          <figure.Figure
            animation={figure.animation}
            width={box.width}
            height={box.height}
            mode={animated && !hold && !covered ? 'loop' : 'still'}
            {...(animated && (hold || covered) && { loopFraming: true })}
            floorBleed={[box.left, box.slotWidth - box.left - box.width]}
            side={second ? 2 : 1}
            equipment={equipment}
            pacing={animated && !hold && !covered ? tracked : undefined}
          />
        </div>
      ) : null}
      {chip && why ? <WhyChip why={why} /> : null}
      {second && sideLabel && !chip ? (
        <span className={styles.slotSide} aria-hidden="true">
          <b>{t('play.side.rightLetter')}</b>
          <span>{sideLabel}</span>
        </span>
      ) : null}
      {cue ? (
        <p className={styles.slotCue} data-reserve="bottom">
          {cue}
        </p>
      ) : null}
      <span className={styles.slotMore} data-reserve="right" aria-hidden="true">
        <Icon name="expand" />
      </span>
      <button
        type="button"
        className={styles.slotHit}
        aria-label={t('play.figure.open', { name })}
        onClick={onOpenHowTo}
      />
    </div>
  );
}
