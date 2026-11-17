import type { ProgressionNote, SessionItem, SessionLog } from '../../domain';
import { itemKey } from '../play';

/** The plan item behind a progression key (`section/blockIndex/itemIndex`). */
export function itemsByKey(plan: SessionLog['plan']): Map<string, SessionItem> {
  const out = new Map<string, SessionItem>();
  for (const section of ['warmup', 'main', 'finisher'] as const)
    plan[section].forEach((block, blockIndex) => {
      const items = block.type === 'straight' ? [block.item] : block.items;
      items.forEach((item, itemIndex) => out.set(itemKey(section, blockIndex, itemIndex), item));
    });
  return out;
}

export interface TimelineEntry {
  /** Start of the session the note was written for (ISO). */
  at: string;
  logId: string;
  note: ProgressionNote;
}

/** Why the exercise changed, from the notes stored on finished sessions, newest first. */
export function changeTimeline(exerciseId: string, logs: readonly SessionLog[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const finished = logs
    .filter((l) => l.status !== 'in-progress')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const log of finished) {
    if (!log.progression) continue;
    const items = itemsByKey(log.plan);
    for (const [key, note] of Object.entries(log.progression))
      if (items.get(key)?.exerciseId === exerciseId)
        out.push({ at: log.startedAt, logId: log.id, note });
  }
  return out;
}
