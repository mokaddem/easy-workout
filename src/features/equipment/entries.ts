import type { EquipmentItem } from '@/domain';
import type { IconName } from '@/ui/components';
import type { OwnedKind } from './defaults';

/** One line of the checklist. Adjustable and fixed dumbbells are separate entries. */
export type EntryKey =
  | 'dumbbell-adjustable'
  | 'dumbbell-fixed'
  | 'kettlebell'
  | 'band'
  | 'mini-band'
  | 'suspension-trainer'
  | 'ab-wheel'
  | 'weight-belt'
  | 'weight-vest'
  | 'pull-up-bar'
  | 'dip-bars'
  | 'bench'
  | 'treadmill'
  | 'stationary-bike'
  | 'rower'
  | 'jump-rope';

export type FormKind =
  'adjustable' | 'weights' | 'levels' | 'added' | 'bar' | 'bench' | 'treadmill' | null;

export interface Entry {
  key: EntryKey;
  kind: OwnedKind;
  mode?: 'adjustable' | 'fixed';
  icon: IconName;
  form: FormKind;
}

export interface Group {
  id: string;
  entries: readonly Entry[];
}

const entry = (
  key: EntryKey,
  kind: OwnedKind,
  icon: IconName,
  form: FormKind,
  mode?: 'adjustable' | 'fixed',
): Entry => ({ key, kind, icon, form, ...(mode ? { mode } : {}) });

/** Stable order, same in onboarding and in the editor. */
export const GROUPS: readonly Group[] = [
  {
    id: 'free',
    entries: [
      entry('dumbbell-adjustable', 'dumbbell', 'dumbbell', 'adjustable', 'adjustable'),
      entry('dumbbell-fixed', 'dumbbell', 'dumbbell', 'weights', 'fixed'),
      entry('kettlebell', 'kettlebell', 'kettlebell', 'weights'),
    ],
  },
  {
    id: 'bands',
    entries: [
      entry('band', 'band', 'band', 'levels'),
      entry('mini-band', 'mini-band', 'miniband', 'levels'),
      entry('suspension-trainer', 'suspension-trainer', 'straps', null),
      entry('ab-wheel', 'ab-wheel', 'wheel', null),
    ],
  },
  {
    id: 'load',
    entries: [
      entry('weight-belt', 'weight-belt', 'belt', 'added'),
      entry('weight-vest', 'weight-vest', 'vest', 'added'),
    ],
  },
  {
    id: 'bars',
    entries: [
      entry('pull-up-bar', 'pull-up-bar', 'bar', 'bar'),
      entry('dip-bars', 'dip-bars', 'dips', null),
      entry('bench', 'bench', 'bench', 'bench'),
    ],
  },
  {
    id: 'cardio',
    entries: [
      entry('treadmill', 'treadmill', 'treadmill', 'treadmill'),
      entry('stationary-bike', 'stationary-bike', 'bike', null),
      entry('rower', 'rower', 'rower', null),
      entry('jump-rope', 'jump-rope', 'rope', null),
    ],
  },
];

export const ENTRIES: readonly Entry[] = GROUPS.flatMap((g) => g.entries);

export function entryOf(item: EquipmentItem): Entry | undefined {
  return ENTRIES.find(
    (e) => e.kind === item.kind && (item.kind !== 'dumbbell' || e.mode === item.mode),
  );
}

export const HOUSEHOLD = ['chair', 'wall', 'door', 'table', 'mat'] as const;
