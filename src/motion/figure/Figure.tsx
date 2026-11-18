import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { EquipmentKind, ExerciseAnimation } from '@/domain';
import { floorShapes, frame, TONE_CSS } from './look';
import { PHASE_OF_TEMPO, repCounter, type FigurePacing } from './pacing';
import { buildParts, variantFor } from './parts';
import { evaluate, neutralPace, prepare, tempoPace, timeAtPhase, timeOf } from './pose';
import { createFigureView } from './view';

export interface FigureProps {
  animation: ExerciseAnimation;
  /** Slot size in px; the framing follows it. */
  width: number;
  height: number;
  /** `loop` moves; `still` shows the key pose, framed to fill the slot (thumbnails). */
  mode?: 'loop' | 'still';
  /** With `still`: the key pose in the loop's framing, so it does not resize when the loop resumes. */
  loopFraming?: boolean;
  /** The user asked to play: moves even under reduced motion. Everything else keeps the still. */
  play?: boolean;
  /** Px the floor line runs past the figure's box on the left and right (the slot's full width). */
  floorBleed?: readonly [number, number];
  /**
   * The second side of a per-side move: the picture flipped left to right, so the working limb
   * stays on the camera's side.
   */
  side?: 1 | 2;
  /**
   * The equipment in use (the kinds of the exercise's chosen setup). Props that can stand in for
   * each other (dumbbell / kettlebell, chair / bench / table, band / mini-band) are drawn as the
   * one in use, at the same place; an implement that changes the body's position has its own
   * variant of the animation. Without it, the first setup listed.
   */
  equipment?: readonly EquipmentKind[] | undefined;
  /** The player's tempo clock. Without it the figure loops at a neutral pace. */
  pacing?: FigurePacing | undefined;
  /** Accessible name. Without one the figure is hidden from assistive technology. */
  label?: string | undefined;
  /** Draw this moment of the loop (seconds) and stop. For previews and screenshots. */
  freezeAt?: number | undefined;
  className?: string | undefined;
}

/**
 * The exercise figure, drawn as an inline SVG. It only moves while it is looping, the page is
 * visible and the figure is on screen; under reduced motion it always shows its key pose.
 */
export function Figure({
  animation,
  width,
  height,
  mode = 'loop',
  loopFraming = false,
  play = false,
  floorBleed,
  side = 1,
  equipment,
  pacing,
  label,
  freezeAt,
  className,
}: FigureProps) {
  const reduced = (useReducedMotion() ?? false) && !play;
  const still = mode === 'still';
  // A fresh array each render must not reframe the figure: key the memo on its contents.
  const equipmentKey = equipment?.join() ?? '';
  const inUse = useMemo(
    () => (equipmentKey ? (equipmentKey.split(',') as EquipmentKind[]) : undefined),
    [equipmentKey],
  );
  const anim = useMemo(() => variantFor(animation, inUse), [animation, inUse]);
  const flip = side === 2 && anim.perSide;
  const fr = useMemo(
    () => frame(anim, width, height, { still: still && !loopFraming, equipment: inUse }),
    [anim, width, height, still, loopFraming, inUse],
  );
  const floor = useMemo(() => floorShapes(fr), [fr]);
  const neutral = useMemo(() => prepare(anim, neutralPace(anim)), [anim]);

  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setOnScreen(last.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The player passes a fresh pacing object each render; the loop reads the latest one.
  const pacingRef = useRef(pacing);
  useEffect(() => {
    pacingRef.current = pacing;
  });
  const tempoKey = pacing ? `${pacing.tempo.down}/${pacing.tempo.pause}/${pacing.tempo.up}` : '';

  const moving = mode === 'loop' && !reduced && freezeAt === undefined;
  const running = moving && visible && onScreen;

  useEffect(() => {
    const host = groupRef.current;
    if (!host) return;
    const view = createFigureView(host, fr, anim);
    const paint = (prep: ReturnType<typeof prepare>, t: number) => {
      const { frames, loop } = evaluate(prep, t);
      view.draw(buildParts(frames, anim, { minR: fr.minR, equipment: inUse, loop }));
    };
    // A continuous cycle keeps its own pace: a tempo would squeeze its moving holds to nothing.
    const tempo = anim.cycle ? undefined : pacingRef.current?.tempo;
    const paced = tempo ? prepare(anim, tempoPace(tempo)) : null;
    const tStill = timeOf(neutral, anim.still);
    const repOf = repCounter();

    let raf = 0;
    if (running) {
      const start = performance.now();
      const tick = () => {
        const point = paced ? pacingRef.current?.read() : null;
        if (paced && point)
          paint(
            paced,
            timeAtPhase(paced, PHASE_OF_TEMPO[point.phase], point.progress, repOf(point)),
          );
        else paint(neutral, (performance.now() - start) / 1000);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } else if (mode === 'loop' && !reduced && freezeAt !== undefined) {
      paint(paced ?? neutral, freezeAt);
    } else {
      paint(neutral, tStill);
    }
    return () => {
      cancelAnimationFrame(raf);
      view.destroy();
    };
    // tempoKey stands for the pacing's tempo: the prepared loop is rebuilt when it changes.
  }, [anim, fr, neutral, running, mode, reduced, freezeAt, tempoKey, inUse]);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ display: 'block', overflow: 'visible' }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path
        d={`M${-(floorBleed?.[0] ?? 0)} ${floor.lineY.toFixed(1)}H${width + (floorBleed?.[1] ?? 0)}`}
        fill="none"
        strokeWidth={1}
        style={{ stroke: TONE_CSS.floor }}
      />
      <g transform={flip ? `matrix(-1 0 0 1 ${width} 0)` : undefined}>
        <path d={floor.shadow} style={{ fill: TONE_CSS.shadow }} />
        <g ref={groupRef} />
      </g>
    </svg>
  );
}
