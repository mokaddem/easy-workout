import { useReducedMotion } from 'motion/react';
import { useSettings } from '@/app/data';

/** Whether figures move: the Settings switch is on (the default) and reduced motion is not. */
export function useFiguresAnimated(): boolean {
  const settings = useSettings();
  const reduced = useReducedMotion() ?? false;
  return (settings?.figuresAnimated ?? true) && !reduced;
}
