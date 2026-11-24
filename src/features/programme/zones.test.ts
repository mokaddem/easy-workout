import { describe, expect, it } from 'vitest';
import { cardZones, type ZoneInput } from './zones';

const none: ZoneInput = {
  paused: false,
  finished: false,
  restart: false,
  outOfDate: false,
  backup: false,
  lighterWeek: false,
  limitationReview: false,
  checkIn: false,
};
const zones = (patch: Partial<ZoneInput>) => cardZones({ ...none, ...patch });

describe('cardZones', () => {
  it('shows nothing when nothing is due', () => {
    expect(zones({})).toEqual({ banner: null, invitation: null });
  });

  it('keeps one banner: restart, then out of date, then backup', () => {
    expect(zones({ restart: true, outOfDate: true, backup: true }).banner).toBe('restart');
    expect(zones({ outOfDate: true, backup: true }).banner).toBe('out-of-date');
    expect(zones({ backup: true }).banner).toBe('backup');
  });

  it('keeps one invitation: lighter week, then limitation review, then check-in', () => {
    expect(zones({ lighterWeek: true, limitationReview: true, checkIn: true }).invitation).toBe(
      'lighter-week',
    );
    expect(zones({ limitationReview: true, checkIn: true }).invitation).toBe('limitation-review');
    expect(zones({ checkIn: true }).invitation).toBe('check-in');
  });

  it('asks nothing about the calendar while paused, but keeps the data banners', () => {
    expect(
      zones({
        paused: true,
        restart: true,
        outOfDate: true,
        lighterWeek: true,
        limitationReview: true,
        checkIn: true,
      }),
    ).toEqual({ banner: 'out-of-date', invitation: null });
    expect(zones({ paused: true, restart: true, backup: true }).banner).toBe('backup');
  });

  it('shows no invitation once the cycle is finished', () => {
    expect(zones({ finished: true, checkIn: true, lighterWeek: true }).invitation).toBeNull();
    expect(zones({ finished: true, backup: true }).banner).toBe('backup');
  });
});
