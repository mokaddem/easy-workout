import type { SessionLog } from '../../domain';

/** The session ran away from home with a travel kit. */
export const isTravelLog = (log: Pick<SessionLog, 'adjustments'>): boolean =>
  log.adjustments?.travel !== undefined;

/**
 * One exercise left out of a travel session, as stamped: where it stood in the plan before the
 * kit was applied, what it was, and how many hard sets went with it.
 */
export interface DroppedItem {
  itemKey: string;
  exerciseId: string;
  /** Hard sets of the main part it carried; 0 elsewhere. */
  sets: number;
}

export const droppedEntry = (item: DroppedItem): string =>
  `${item.itemKey}:${item.exerciseId}:${item.sets}`;

export function parseDropped(entry: string): DroppedItem | undefined {
  const m = /^((?:warmup|main|finisher)\/\d+\/\d+):([^:]+):(\d+)$/.exec(entry);
  return m ? { itemKey: m[1]!, exerciseId: m[2]!, sets: Number(m[3]) } : undefined;
}

/** Exercises a travel session left out. */
export const droppedIds = (log: Pick<SessionLog, 'adjustments'>): Set<string> =>
  new Set(
    (log.adjustments?.travel?.dropped ?? []).flatMap((e) => {
      const d = parseDropped(e);
      return d ? [d.exerciseId] : [];
    }),
  );
