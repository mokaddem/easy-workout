import { describe, expect, it } from 'vitest';
import type { EquipmentInventory } from '@/domain';
import { defaultItem } from './defaults';
import { invalidItems, itemError } from './validation';

describe('invalidItems', () => {
  it('accepts the starting specs of everything but empty fixed dumbbells', () => {
    expect(invalidItems([defaultItem('kettlebell'), defaultItem('band')])).toEqual([]);
  });

  it('flags a weight grid with nothing in it', () => {
    const fixed = defaultItem('dumbbell', 'fixed');
    expect(itemError(fixed)).toBe('no-weights');
    expect(invalidItems([fixed, defaultItem('band')])).toEqual([fixed.id]);
    expect(itemError({ id: 'kb', kind: 'kettlebell', weights: [] })).toBe('no-weights');
  });

  it('flags a range where the lightest is not below the heaviest', () => {
    const items: EquipmentInventory = [
      {
        id: 'a',
        kind: 'dumbbell',
        mode: 'adjustable',
        count: 2,
        minKg: 10,
        maxKg: 10,
        incrementKg: 2,
      },
    ];
    expect(invalidItems(items)).toEqual(['a']);
    expect(itemError(items[0]!)).toBe('range');
  });

  it('flags bands with no level', () => {
    expect(itemError({ id: 'b', kind: 'band', levels: [] })).toBe('no-levels');
  });
});
