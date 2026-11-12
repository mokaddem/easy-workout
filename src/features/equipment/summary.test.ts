import { describe, expect, it } from 'vitest';
import type { EquipmentItem } from '@/domain';
import { defaultItem } from './defaults';
import { summarize } from './summary';

const label = (l: string) => l;

describe('summarize', () => {
  it('recaps an adjustable pair with the language decimal mark', () => {
    const item = { ...defaultItem('dumbbell'), minKg: 2.5, maxKg: 24 } as const;
    expect(summarize(item, 'fr', label)).toEqual({
      key: 'adjustablePair',
      values: { min: '2,5', max: '24', nb: ' ' },
    });
    expect(summarize(item, 'en', label)?.values.min).toBe('2.5');
  });

  it('lists weights ascending and marks pairs', () => {
    const item: EquipmentItem = {
      id: 'x',
      kind: 'kettlebell',
      weights: [
        { kg: 16, count: 2 },
        { kg: 12, count: 1 },
      ],
    };
    expect(summarize(item, 'en', label)?.values.list).toBe('12, 16 × 2');
  });

  it('capitalises band levels', () => {
    expect(summarize(defaultItem('band'), 'en', (l) => l)?.values.list).toBe(
      'Light, medium, heavy',
    );
  });

  it('gives bar mount and bench type keys, nothing for plain items', () => {
    expect(summarize(defaultItem('pull-up-bar'), 'en', label)?.key).toBe('mount.doorway');
    expect(summarize(defaultItem('bench'), 'en', label)?.key).toBe('benchFlat');
    expect(summarize(defaultItem('rower'), 'en', label)).toBeNull();
  });
});
