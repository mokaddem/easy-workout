import { describe, expect, it } from 'vitest';
import { activeParts, agoText, daysAgo, timeText, weekRangeText } from './format';

describe('progress formatting', () => {
  it('splits active time into hours and minutes', () => {
    expect(activeParts(45 * 60)).toEqual({ minutes: '45' });
    expect(activeParts(160 * 60)).toEqual({ hours: 2, minutes: '40' });
    expect(activeParts(65 * 60)).toEqual({ hours: 1, minutes: '05' });
    expect(activeParts(0)).toEqual({ minutes: '0' });
  });

  it('says time in a sentence', () => {
    expect(timeText(965 * 60)).toBe('16 h 05');
    expect(timeText(30 * 60)).toBe('30 min');
  });

  it('counts calendar days, not 24 h blocks', () => {
    expect(daysAgo(new Date(2026, 10, 16, 23, 0), new Date(2026, 10, 17, 1, 0))).toBe(1);
    expect(daysAgo(new Date(2026, 10, 17, 1, 0), new Date(2026, 10, 17, 23, 0))).toBe(0);
  });

  it('words how long ago in days, then weeks, then months', () => {
    const now = new Date(2026, 10, 17, 12);
    expect(agoText(new Date(2026, 10, 16, 8), now, 'en')).toBe('yesterday');
    expect(agoText(new Date(2026, 10, 11, 8), now, 'en')).toBe('6 days ago');
    expect(agoText(new Date(2026, 9, 27, 8), now, 'en')).toBe('3 weeks ago');
    expect(agoText(new Date(2026, 6, 1, 8), now, 'en')).toBe('4 months ago');
  });

  it('writes a week as a range', () => {
    expect(weekRangeText('2026-11-09', '2026-11-15', 'en')).toMatch(/Nov 9\s?[–-]\s?15/);
  });
});
