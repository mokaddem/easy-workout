import type { MaxTest, TestContext } from '../../domain';

export const testValue = (test: MaxTest): number =>
  test.result.kind === 'reps' ? test.result.reps : test.result.seconds;

export interface TestEntry {
  test: MaxTest;
  value: number;
  /** The previous test of the same context, if any. */
  previous?: MaxTest;
  /** Value minus the previous one's. */
  change?: number;
}

export interface TestSeries {
  context: TestContext;
  /** Oldest first. */
  entries: TestEntry[];
}

const byTime = (a: MaxTest, b: MaxTest) => a.at.localeCompare(b.at);

/** Tests of an exercise per context (in a session / fresh), each against the previous one of the same context. */
export function maxTestHistory(tests: readonly MaxTest[], exerciseId: string): TestSeries[] {
  const mine = tests.filter((t) => t.exerciseId === exerciseId).sort(byTime);
  const series: TestSeries[] = [];
  for (const context of ['session', 'fresh'] as const) {
    const entries: TestEntry[] = [];
    for (const test of mine.filter((t) => t.context === context)) {
      const previous = entries.at(-1)?.test;
      entries.push({
        test,
        value: testValue(test),
        ...(previous && { previous, change: testValue(test) - testValue(previous) }),
      });
    }
    if (entries.length > 0) series.push({ context, entries });
  }
  return series;
}

export interface TestedExercise {
  exerciseId: string;
  count: number;
  last: MaxTest;
}

/** Exercises that have been tested, most recently tested first. */
export function testedExercises(tests: readonly MaxTest[]): TestedExercise[] {
  const out = new Map<string, TestedExercise>();
  for (const test of [...tests].sort(byTime)) {
    const current = out.get(test.exerciseId);
    out.set(test.exerciseId, {
      exerciseId: test.exerciseId,
      count: (current?.count ?? 0) + 1,
      last: test,
    });
  }
  return [...out.values()].sort((a, b) => b.last.at.localeCompare(a.last.at));
}
