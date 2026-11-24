import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { canTick, daysStatus, missingDays, previewDays, sameDays, sortDays } from './model';

describe('training days', () => {
  it('keeps days in week order without duplicates', () => {
    expect(sortDays(['fri', 'mon', 'fri', 'wed'])).toEqual(['mon', 'wed', 'fri']);
    expect(sameDays(['fri', 'mon'], ['mon', 'fri'])).toBe(true);
    expect(sameDays(['mon'], ['mon', 'fri'])).toBe(false);
  });

  it('allows as many days as sessions in a week', () => {
    expect(canTick(['mon', 'wed'], 3)).toBe(true);
    expect(canTick(['mon', 'wed', 'fri'], 3)).toBe(false);
  });

  it('says how many are left, or that the week is full', () => {
    expect(daysStatus([], 3)).toEqual({ kind: 'none' });
    expect(daysStatus(['mon'], 3)).toEqual({ kind: 'left', count: 2 });
    expect(daysStatus(['mon', 'wed', 'fri'], 3)).toEqual({ kind: 'full', count: 3 });
  });

  it('wants all the days or none', () => {
    expect(missingDays([], 4)).toBe(0);
    expect(missingDays(['mon', 'wed'], 4)).toBe(2);
    expect(missingDays(['mon', 'tue', 'wed', 'thu'], 4)).toBe(0);
  });

  it('lays the rotation on the coming week from the next session', () => {
    // Friday 20 November 2026.
    const now = new Date(2026, 10, 20, 9, 0);
    const preview = previewDays({
      days: ['mon', 'wed', 'fri'],
      now,
      logs: [] as SessionLog[],
      nextIndex: 1,
      size: 3,
    });
    // Today is a training day with nothing started: the next session (index 1) takes it.
    expect(preview.byDay.get('fri')).toBe(1);
    expect(preview.byDay.get('mon')).toBe(2);
    expect(preview.byDay.get('wed')).toBe(0);
    expect(preview.first?.day.weekday).toBe('fri');
    expect(preview.first?.index).toBe(1);
  });

  it('previews nothing without days', () => {
    const preview = previewDays({ days: [], now: new Date(), logs: [], nextIndex: 0, size: 3 });
    expect(preview.byDay.size).toBe(0);
    expect(preview.first).toBeUndefined();
  });
});
