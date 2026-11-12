import type { CSSProperties } from 'react';
import { cx } from './cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  /** Use a radius token, e.g. `var(--radius-lg)`. */
  radius?: string;
  className?: string;
}

/** Sunken placeholder block at the size of the real content; no shimmer. */
export function Skeleton({ width = '100%', height = 16, radius, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(styles.skeleton, className)}
      style={{ width, height, ...(radius ? { borderRadius: radius } : null) }}
    />
  );
}
