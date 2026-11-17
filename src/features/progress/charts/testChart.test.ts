import { describe, expect, it } from 'vitest';
import { bestOfContext, type TestColumn } from './testChart';

const col = (id: string, value: number, context: TestColumn['context']): TestColumn => ({
  id,
  date: '2026-11-01',
  value,
  context,
});

describe('bestOfContext', () => {
  const columns = [
    col('a', 20, 'fresh'),
    col('b', 18, 'session'),
    col('c', 24, 'fresh'),
    col('d', 22, 'session'),
  ];
  it('finds the best of each context separately', () => {
    expect(columns.map((_, i) => bestOfContext(columns, i))).toEqual([false, false, true, true]);
  });
  it('takes the latest on a tie', () => {
    const tie = [col('a', 20, 'fresh'), col('b', 20, 'fresh')];
    expect(bestOfContext(tie, 0)).toBe(false);
    expect(bestOfContext(tie, 1)).toBe(true);
  });
});
