import type { Programme } from '../../domain';

/** A slot whose exercise differs between two programmes. `from`/`to` absent = no exercise. */
export interface SlotChange {
  sessionId: string;
  slot: string;
  from?: string;
  to?: string;
}

/** The exercise (or cardio modality) each slot of each session ended up with; '' = dropped. */
const slotChoices = (p: Programme): Map<string, string> => {
  const map = new Map<string, string>();
  for (const n of p.generation?.notes ?? []) {
    const session = n.ref?.sessionId;
    if (!session) continue;
    if (n.code.startsWith('exercise-') && n.code !== 'exercise-harder-variant')
      map.set(`${session}|${String(n.params.slot)}`, String(n.params.exerciseId));
    if (n.code === 'slot-dropped') map.set(`${session}|${String(n.params.slot)}`, '');
    if (n.code === 'cardio-modality')
      map.set(
        `${session}|cardio-${n.ref?.section}-${n.ref?.blockIndex}`,
        String(n.params.exerciseId),
      );
  }
  return map;
};

/** Slot-by-slot exercise changes from one generated programme to another, in session order. */
export const programmeChanges = (before: Programme, after: Programme): SlotChange[] => {
  const was = slotChoices(before);
  const now = slotChoices(after);
  const changes: SlotChange[] = [];
  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const from = was.get(key) || undefined;
    const to = now.get(key) || undefined;
    if (from === to) continue;
    const [sessionId = '', slot = ''] = key.split('|');
    changes.push({ sessionId, slot, ...(from ? { from } : {}), ...(to ? { to } : {}) });
  }
  return changes;
};
