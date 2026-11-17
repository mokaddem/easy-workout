import type { Issue } from '@/engine';
import { issueKey } from '@/engine';
import type { Section } from '@/engine';

export const blockKey = (section: Section, index: number) => `${section}:${index}`;

export interface GroupedIssues {
  /** Issues shown at a block's foot. */
  byBlock: Map<string, Issue[]>;
  /** Issues about the whole session (no block). */
  session: Issue[];
  /** The main part has nothing in it. */
  mainEmpty: boolean;
  /** Over or under the session length, shown in the meter line. */
  budget: Issue | undefined;
  /** Blocking issues, in session order. */
  blocking: Issue[];
  /** Issues left after dismissals. */
  shown: Issue[];
}

const BUDGET = new Set(['over-budget', 'under-budget']);

/** Sorts the issues of a session by where they show, dropping the warnings the user dismissed. */
export function groupIssues(
  issues: readonly Issue[],
  dismissed: readonly string[] = [],
): GroupedIssues {
  const gone = new Set(dismissed);
  const result: GroupedIssues = {
    byBlock: new Map(),
    session: [],
    mainEmpty: false,
    budget: undefined,
    blocking: [],
    shown: [],
  };
  for (const issue of issues) {
    if (issue.level === 'warn' && gone.has(issueKey(issue))) continue;
    if (BUDGET.has(issue.code)) {
      result.budget = issue;
      continue;
    }
    result.shown.push(issue);
    if (issue.level === 'block') result.blocking.push(issue);
    if (issue.code === 'main-empty') result.mainEmpty = true;
    else if (issue.ref) {
      const key = blockKey(issue.ref.section, issue.ref.blockIndex);
      result.byBlock.set(key, [...(result.byBlock.get(key) ?? []), issue]);
    } else result.session.push(issue);
  }
  return result;
}

/** Which blocking issue to jump to first: the earliest block in session order, else a session one. */
export function firstBlocking(grouped: GroupedIssues): Issue | undefined {
  const order = { warmup: 0, main: 1, finisher: 2 } as const;
  const placed = grouped.blocking
    .filter((i) => i.ref)
    .sort(
      (a, b) =>
        order[a.ref!.section] - order[b.ref!.section] || a.ref!.blockIndex - b.ref!.blockIndex,
    );
  return placed[0] ?? grouped.blocking[0];
}
