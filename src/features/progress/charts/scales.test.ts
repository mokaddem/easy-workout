import { describe, expect, it } from 'vitest';
import {
  bodyAxis,
  columnCeiling,
  columnWidth,
  linear,
  nearestIndex,
  slotCentres,
  thin,
} from './scales';

describe('linear', () => {
  it('maps the domain onto the range', () => {
    const y = linear(0, 10, 100, 0);
    expect(y(0)).toBe(100);
    expect(y(10)).toBe(0);
    expect(y(2.5)).toBe(75);
  });
  it('centres a flat domain', () => {
    expect(linear(5, 5, 0, 40)(5)).toBe(20);
  });
});

describe('nearestIndex', () => {
  it('snaps to the closest entry', () => {
    expect(nearestIndex([10, 50, 90], 12)).toBe(0);
    expect(nearestIndex([10, 50, 90], 71)).toBe(2);
    expect(nearestIndex([10, 50, 90], 69)).toBe(1);
  });
  it('handles one entry', () => {
    expect(nearestIndex([42], 300)).toBe(0);
  });
});

describe('bodyAxis', () => {
  it('pads by 0.4 and rounds out to whole numbers', () => {
    expect(bodyAxis([79.7, 80.4])).toEqual({ min: 79, max: 81, ticks: [79, 80, 81] });
  });
  it('keeps at most five ticks', () => {
    const axis = bodyAxis([70, 80]);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
    expect(axis.ticks[0]).toBe(axis.min);
  });
  it('a single value still has a span', () => {
    const axis = bodyAxis([80]);
    expect(axis.max).toBeGreaterThan(axis.min);
  });
  it('has a fallback for no values', () => {
    expect(bodyAxis([]).ticks).toEqual([0, 1]);
  });
});

describe('columns', () => {
  it('leaves headroom above the larger of range and best', () => {
    expect(columnCeiling(12, 8)).toBeCloseTo(14.16);
    expect(columnCeiling(undefined, 20)).toBeCloseTo(23.6);
    expect(columnCeiling(undefined, 0)).toBeGreaterThan(0);
  });
  it('is 55 % of the narrowest gap within 4 and the cap', () => {
    expect(columnWidth([100, 30], 14)).toBe(14);
    expect(columnWidth([10], 14)).toBe(6);
    expect(columnWidth([2], 14)).toBe(4);
    expect(columnWidth([], 24)).toBe(24);
  });
  it('slots are centred', () => {
    expect(slotCentres(4)).toEqual([0.125, 0.375, 0.625, 0.875]);
  });
});

describe('thin', () => {
  it('keeps both ends', () => {
    const out = thin([1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
    expect(out).toEqual([1, 5, 9]);
  });
  it('leaves short lists alone', () => {
    expect(thin([1, 2], 5)).toEqual([1, 2]);
  });
});
