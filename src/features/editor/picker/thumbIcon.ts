import type { Exercise } from '@/domain';
import type { IconName } from '@/ui/components';

const GLYPH: Record<string, IconName> = {
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  band: 'band',
  'mini-band': 'miniband',
  'weight-belt': 'belt',
  'weight-vest': 'vest',
  'pull-up-bar': 'bar',
  'dip-bars': 'dips',
  bench: 'bench',
  treadmill: 'treadmill',
  'stationary-bike': 'bike',
  rower: 'rower',
  'jump-rope': 'rope',
  'ab-wheel': 'wheel',
  'suspension-trainer': 'straps',
};

/** The glyph of the main implement of the exercise; a person when it needs none. */
export function thumbIcon(exercise: Exercise): IconName {
  for (const setup of exercise.equipment)
    for (const req of setup) {
      const glyph = GLYPH[req.kind];
      if (glyph) return glyph;
    }
  return 'user';
}
