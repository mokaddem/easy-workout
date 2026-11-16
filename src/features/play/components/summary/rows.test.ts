import { describe, expect, it } from 'vitest';
import type { Prescribed } from '@/engine';
import { movesUp, splitFigure } from './rows';

const reps = { kind: 'reps', min: 8, max: 10 } as const;
const p = (extra: Partial<Prescribed> = {}): Prescribed => ({ target: reps, ...extra });

describe('movesUp', () => {
  it('counts a heavier load, not a lighter one', () => {
    expect(movesUp(p({ load: { kind: 'kg', kg: 10 } }), p({ load: { kind: 'kg', kg: 12 } }))).toBe(
      true,
    );
    expect(movesUp(p({ load: { kind: 'kg', kg: 12 } }), p({ load: { kind: 'kg', kg: 10 } }))).toBe(
      false,
    );
  });
  it('counts a higher goal or a slower tempo at the same load', () => {
    expect(movesUp(p({ goal: 8 }), p({ goal: 9 }))).toBe(true);
    expect(movesUp(p({ goal: 9 }), p({ goal: 9 }))).toBe(false);
    expect(
      movesUp(
        p({ tempo: { down: 2, pause: 1, up: 2 } }),
        p({ tempo: { down: 3, pause: 1, up: 1 } }),
      ),
    ).toBe(true);
  });
  it('reads a lighter band as up when assisted', () => {
    const heavy = p({ load: { kind: 'band', level: 'heavy' } });
    const light = p({ load: { kind: 'band', level: 'light' } });
    expect(movesUp(heavy, light, true)).toBe(true);
    expect(movesUp(heavy, light)).toBe(false);
  });
});

describe('splitFigure', () => {
  it('separates numeral and unit', () => {
    expect(splitFigure('20 kg')).toEqual({ n: '20', unit: 'kg' });
    expect(splitFigure('14 reps')).toEqual({ n: '14', unit: 'reps' });
    expect(splitFigure('3-1-1')).toEqual({ n: '3-1-1', unit: '' });
    expect(splitFigure('Fort')).toEqual({ n: 'Fort', unit: '' });
    expect(splitFigure('+5 kg')).toEqual({ n: '+5', unit: 'kg' });
  });
});
