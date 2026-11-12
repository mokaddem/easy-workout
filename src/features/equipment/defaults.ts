import type { EquipmentItem, OWNED_EQUIPMENT_KINDS } from '@/domain';

export type OwnedKind = (typeof OWNED_EQUIPMENT_KINDS)[number];

/**
 * What a freshly ticked item starts with: common home specs, edited from there.
 * Fixed dumbbells start with no weight: the user picks the ones they own.
 * Dumbbells come adjustable unless `mode` says fixed; the two have different ids so both can be owned.
 */
export function defaultItem(
  kind: OwnedKind,
  mode: 'adjustable' | 'fixed' = 'adjustable',
): EquipmentItem {
  switch (kind) {
    case 'dumbbell':
      return mode === 'fixed'
        ? { id: 'dumbbell-fixed', kind, mode, weights: [] }
        : {
            id: 'dumbbell-adjustable',
            kind,
            mode,
            count: 2,
            minKg: 2,
            maxKg: 24,
            incrementKg: 2,
          };
    case 'kettlebell':
      return { id: kind, kind, weights: [{ kg: 12, count: 1 }] };
    case 'band':
      return { id: kind, kind, levels: ['light', 'medium', 'heavy'] };
    case 'mini-band':
      return { id: kind, kind, levels: ['light', 'medium'] };
    case 'weight-belt':
      return { id: kind, kind, maxKg: 20, incrementKg: 2.5 };
    case 'weight-vest':
      return { id: kind, kind, maxKg: 10, incrementKg: 1 };
    case 'pull-up-bar':
      return { id: kind, kind, mount: 'doorway' };
    case 'bench':
      return { id: kind, kind, incline: false };
    case 'treadmill':
      return { id: kind, kind, maxSpeedKmh: 14, maxInclinePct: 0 };
    case 'dip-bars':
    case 'stationary-bike':
    case 'rower':
    case 'jump-rope':
    case 'ab-wheel':
    case 'suspension-trainer':
      return { id: kind, kind };
  }
}
