import type { Session } from '@/domain';
import type { SlotChange } from '@/engine';

const LETTERS = 'ABCDEFGHIJ';

/** Session id -> display label: its letter, or null for the cardio day. */
export function sessionLetters(
  rotation: readonly Pick<Session, 'id'>[],
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  let index = 0;
  for (const session of rotation) {
    map.set(session.id, session.id === 'cardio' ? null : (LETTERS[index++] ?? 'X'));
  }
  return map;
}

export interface SwapLine {
  from?: string;
  to?: string;
  /** Letters, in rotation order; `cardio` marks the cardio day. */
  sessions: string[];
}

/**
 * Groups slot changes that swap the same exercise for the same one across sessions,
 * keeping the order of first appearance.
 */
export function groupChanges(
  changes: readonly SlotChange[],
  letters: Map<string, string | null>,
): SwapLine[] {
  const lines = new Map<string, SwapLine>();
  for (const change of changes) {
    const known = letters.get(change.sessionId);
    const label =
      known === undefined
        ? change.sessionId === 'cardio'
          ? 'cardio'
          : /^([a-z])-/.exec(change.sessionId)?.[1]?.toUpperCase()
        : (known ?? 'cardio');
    if (!label) continue;
    const key = `${change.from ?? ''}>${change.to ?? ''}`;
    const line = lines.get(key) ?? {
      ...(change.from ? { from: change.from } : {}),
      ...(change.to ? { to: change.to } : {}),
      sessions: [],
    };
    if (!line.sessions.includes(label)) line.sessions.push(label);
    lines.set(key, line);
  }
  const order = (s: string) => (s === 'cardio' ? 99 : LETTERS.indexOf(s));
  return [...lines.values()].map((line) => ({
    ...line,
    sessions: [...line.sessions].sort((a, b) => order(a) - order(b)),
  }));
}
