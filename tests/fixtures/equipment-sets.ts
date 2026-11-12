import type { EquipmentInventory } from '../../src/domain';
import { referenceEquipment } from './reference-equipment';

/** Equipment sets covering the shapes of home setups the generator must handle. */
export const equipmentSets: Record<string, EquipmentInventory> = {
  reference: referenceEquipment,
  bodyweight: [],
  'bands-and-bar': [
    { id: 'bands', kind: 'band', levels: ['light', 'heavy'] },
    { id: 'bar', kind: 'pull-up-bar', mount: 'doorway' },
  ],
  kettlebells: [
    {
      id: 'kb',
      kind: 'kettlebell',
      weights: [
        { kg: 8, count: 2 },
        { kg: 12, count: 1 },
        { kg: 16, count: 1 },
      ],
    },
  ],
  'fixed-dumbbells': [
    {
      id: 'db',
      kind: 'dumbbell',
      mode: 'fixed',
      weights: [
        { kg: 4, count: 2 },
        { kg: 8, count: 2 },
        { kg: 12, count: 2 },
      ],
    },
    { id: 'bench', kind: 'bench', incline: false },
    { id: 'rope', kind: 'jump-rope' },
  ],
  'well-equipped': [
    {
      id: 'db',
      kind: 'dumbbell',
      mode: 'adjustable',
      count: 2,
      minKg: 2.5,
      maxKg: 32.5,
      incrementKg: 2.5,
    },
    { id: 'bench', kind: 'bench', incline: true },
    {
      id: 'bands',
      kind: 'band',
      levels: ['extra-light', 'light', 'medium', 'heavy', 'extra-heavy'],
    },
    { id: 'mini', kind: 'mini-band', levels: ['light', 'medium'] },
    { id: 'bar', kind: 'pull-up-bar', mount: 'wall', maxLoadKg: 150 },
    {
      id: 'kb',
      kind: 'kettlebell',
      weights: [
        { kg: 12, count: 2 },
        { kg: 16, count: 1 },
        { kg: 24, count: 1 },
      ],
    },
    { id: 'dips', kind: 'dip-bars' },
    { id: 'rope', kind: 'jump-rope' },
    { id: 'wheel', kind: 'ab-wheel' },
    { id: 'trx', kind: 'suspension-trainer' },
    { id: 'rower', kind: 'rower' },
    { id: 'vest', kind: 'weight-vest', maxKg: 20, incrementKg: 2 },
  ],
};
