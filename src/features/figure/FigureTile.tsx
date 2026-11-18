import type { ReactNode } from 'react';
import type { EquipmentKind } from '@/domain';
import { useFigure } from '@/motion/figure';
import { useArrival } from './useArrival';
import styles from './figure.module.css';

/**
 * The key pose of an exercise as a still in a small tile; `fallback` shows while the figures load
 * and for an exercise without an animation.
 */
export function FigureTile({
  exerciseId,
  size,
  equipment,
  fallback = null,
  className,
  tone,
}: {
  exerciseId: string;
  size: number;
  equipment?: readonly EquipmentKind[] | undefined;
  fallback?: ReactNode;
  className?: string | undefined;
  /** The ground the tile sits on, when it is not the theme's own. */
  tone?: 'rest' | 'ink' | undefined;
}) {
  const figure = useFigure(exerciseId);
  const late = useArrival(!figure, !!figure);
  if (!figure) return <>{fallback}</>;
  const { Figure, animation } = figure;
  return (
    <span
      className={
        [className, late ? styles.arrive : undefined].filter(Boolean).join(' ') || undefined
      }
      {...(tone && { 'data-figure-tone': tone })}
      aria-hidden="true"
    >
      <Figure animation={animation} width={size} height={size} mode="still" equipment={equipment} />
    </span>
  );
}
