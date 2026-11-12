import type { EquipmentInventory } from '../../src/domain';

/** Equipment the reference programme is written for: no bench, everything else done on the floor or a chair. */
export const referenceEquipment: EquipmentInventory = [
  {
    id: 'dumbbells',
    kind: 'dumbbell',
    mode: 'adjustable',
    count: 2,
    minKg: 2,
    maxKg: 24,
    incrementKg: 2,
  },
  { id: 'bands', kind: 'band', levels: ['light', 'medium', 'heavy'] },
  { id: 'belt', kind: 'weight-belt', maxKg: 20, incrementKg: 2.5 },
  { id: 'bar', kind: 'pull-up-bar', mount: 'doorway' },
  { id: 'treadmill', kind: 'treadmill', maxSpeedKmh: 16, maxInclinePct: 15 },
];
