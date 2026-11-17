import { describe, expect, it } from 'vitest';
import { bodyLayout } from './bodyChart';

const pts = (dates: string[], base = 80) =>
  dates.map((date, i) => ({ date, value: base + i * 0.3 }));

describe('bodyLayout', () => {
  it('labels every check-in up to seven', () => {
    const layout = bodyLayout(pts(['2026-11-01', '2026-11-08', '2026-11-15']), false);
    expect(layout.labelled).toEqual([0, 1, 2]);
    expect(layout.monthLabels).toBe(false);
    expect(layout.xs[0]).toBe(0);
    expect(layout.xs[2]).toBe(1);
  });
  it('labels months past seven and always names the latest', () => {
    const dates = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 1 + i * 7));
      return d.toISOString().slice(0, 10);
    });
    const layout = bodyLayout(pts(dates), false);
    expect(layout.monthLabels).toBe(true);
    expect(layout.labelled.at(-1)).toBe(9);
    expect(layout.labelled.length).toBeLessThan(10);
  });
  it('centres a single check-in', () => {
    expect(bodyLayout(pts(['2026-11-01']), false).xs).toEqual([0.5]);
  });
  it('sleep reads 0 to 9 hours', () => {
    expect(bodyLayout(pts(['2026-11-01', '2026-11-08']), true).axis.ticks).toEqual([0, 3, 6, 9]);
  });
  it('handles no points', () => {
    expect(bodyLayout([], false).xs).toEqual([]);
  });
});
