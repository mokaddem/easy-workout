import { describe, expect, it } from 'vitest';
import { addDays, dayKey, localDay, percentText, weekdayName } from './dates';

describe('dates', () => {
  it('reads a day as local, so it never shifts', () => {
    const d = localDay('2026-11-30');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 30]);
    expect(dayKey(d)).toBe('2026-11-30');
    expect(dayKey(addDays(d, 1))).toBe('2026-12-01');
  });

  it('names weekdays from Monday', () => {
    expect(weekdayName('mon', 'en')).toBe('Monday');
    expect(weekdayName('sun', 'fr')).toBe('dimanche');
    expect(weekdayName('wed', 'en', 'short')).toBe('Wed');
  });

  it('writes a share as a percentage, French with its narrow space', () => {
    expect(percentText(0.644, 'en')).toBe('64%');
    expect(percentText(0.644, 'fr')).toBe('64 %');
    expect(percentText(1.4, 'en')).toBe('100%');
    expect(percentText(-1, 'en')).toBe('0%');
  });
});
