import type { GenerationNote, Programme } from '../../domain';

/** A slot whose exercise differs between two programmes. `from`/`to` absent = no exercise. */
export interface SlotChange {
  sessionId: string;
  slot: string;
  from?: string;
  to?: string;
}

/**
 * The exercise (or cardio modality) each slot of each session ended up with; '' = dropped. A slot
 * is named as it is in the programme: a template slot used twice in a session has its repeat
 * renamed there (`-2`), and a repeat that was dropped is named the same way.
 */
const slotChoices = (p: Programme): Map<string, string> => {
  const map = new Map<string, string>();
  const sessions = new Map((p.generatedRotation ?? p.rotation).map((s) => [s.id, s]));
  const placed = (session: string) => {
    const set = new Set<string>();
    const s = sessions.get(session);
    for (const block of [...(s?.warmup ?? []), ...(s?.main ?? []), ...(s?.finisher ?? [])])
      for (const item of block.type === 'straight' ? [block.item] : block.items)
        if (item.slot) set.add(item.slot);
    return set;
  };
  const taken = new Map<string, Set<string>>();
  const slotAt = (n: GenerationNote, session: string): string => {
    const ref = n.ref;
    const block =
      ref?.section && ref.blockIndex !== undefined
        ? sessions.get(session)?.[ref.section]?.[ref.blockIndex]
        : undefined;
    const item =
      block && (block.type === 'straight' ? block.item : block.items[ref?.itemIndex ?? 0]);
    return item?.slot ?? String(n.params.slot);
  };
  for (const n of p.generation?.notes ?? []) {
    const session = n.ref?.sessionId;
    if (!session) continue;
    if (n.code.startsWith('exercise-') && n.code !== 'exercise-harder-variant')
      map.set(`${session}|${slotAt(n, session)}`, String(n.params.exerciseId));
    if (n.code === 'slot-dropped' || n.code === 'slot-limited') {
      let used = taken.get(session);
      if (!used) taken.set(session, (used = placed(session)));
      const wanted = String(n.params.slot);
      let slot = wanted;
      for (let i = 2; used.has(slot); i++) slot = `${wanted}-${i}`;
      used.add(slot);
      map.set(`${session}|${slot}`, '');
    }
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
