import type { TestContext } from '@/domain';

export interface TestColumn {
  id: string;
  date: string;
  value: number;
  context: TestContext;
}

/** The index of the best test of the same context (the latest on a tie). */
export function bestOfContext(columns: readonly TestColumn[], index: number): boolean {
  const mine = columns[index]!;
  let best = -1;
  columns.forEach((c, i) => {
    if (c.context === mine.context && (best < 0 || c.value >= columns[best]!.value)) best = i;
  });
  return best === index;
}
