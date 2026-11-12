import { useMemo } from 'react';
import { useReducedMotion } from 'motion/react';

/** Reads the motion custom properties from the document, so scripts and CSS share one source. */
function readVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function seconds(name: string): number {
  const raw = readVar(name);
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 0;
  return raw.endsWith('ms') ? value / 1000 : value;
}

function pixels(name: string): number {
  const value = parseFloat(readVar(name));
  return Number.isNaN(value) ? 0 : value;
}

type Bezier = [number, number, number, number];

function bezier(name: string, fallback: Bezier): Bezier | 'linear' {
  const raw = readVar(name);
  if (raw === 'linear') return 'linear';
  const match = /cubic-bezier\(([^)]+)\)/.exec(raw);
  if (!match?.[1]) return fallback;
  const parts = match[1].split(',').map(Number);
  return parts.length === 4 && parts.every((n) => !Number.isNaN(n))
    ? [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
    : fallback;
}

export interface MotionTokens {
  /** Seconds. Already shortened by the reduced-motion overrides in the stylesheet. */
  duration: { instant: number; fast: number; base: number; slow: number; flood: number };
  ease: {
    snap: Bezier | 'linear';
    exit: Bezier | 'linear';
    move: Bezier | 'linear';
    punch: Bezier | 'linear';
  };
  /** Pixels. Zero under reduced motion. */
  distance: { sm: number; md: number; lg: number };
  reduced: boolean;
}

export function readTokens(reduced: boolean): MotionTokens {
  return {
    duration: {
      instant: seconds('--duration-instant'),
      fast: seconds('--duration-fast'),
      base: seconds('--duration-base'),
      slow: seconds('--duration-slow'),
      flood: seconds('--duration-flood'),
    },
    ease: {
      snap: bezier('--ease-snap', [0.16, 1, 0.3, 1]),
      exit: bezier('--ease-exit', [0.7, 0, 0.84, 0]),
      move: bezier('--ease-move', [0.65, 0, 0.35, 1]),
      punch: bezier('--ease-punch', [0.34, 1.56, 0.64, 1]),
    },
    distance: {
      sm: pixels('--motion-distance-sm'),
      md: pixels('--motion-distance-md'),
      lg: pixels('--motion-distance-lg'),
    },
    reduced,
  };
}

/** Motion tokens for script-driven animation; re-read when the reduced-motion setting flips. */
export function useMotionTokens(): MotionTokens {
  const reduced = useReducedMotion() ?? false;
  return useMemo(() => readTokens(reduced), [reduced]);
}

/** Exits run at about 70 % of the matching entrance. */
export const EXIT_RATIO = 0.7;
