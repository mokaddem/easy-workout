import type { Session } from '@/domain';
import { bySlot, isRampSlot, itemsOf, removedSlots, type Section } from '@/engine';

export interface Tombstone {
  slot: string;
  exerciseId: string;
  section: Section;
  /** Shown before this block of the draft's section (the section's length: at the end). */
  before: number;
}

/**
 * Generated items the user took out, each with where its tombstone goes: after the nearest
 * earlier generated block still in the session, else at the top of its section.
 */
export function tombstones(draft: Session, generated: Session): Tombstone[] {
  const base = bySlot(generated);
  const out: Tombstone[] = [];
  for (const slot of removedSlots(draft, generated)) {
    if (isRampSlot(slot)) continue;
    const was = base.get(slot);
    if (!was) continue;
    let before = 0;
    for (let i = was.blockIndex - 1; i >= 0 && before === 0; i--) {
      const slots = new Set(itemsOf(generated[was.section][i]!).map((x) => x.slot));
      const found = draft[was.section].findIndex((b) => itemsOf(b).some((x) => slots.has(x.slot)));
      if (found >= 0) before = found + 1;
    }
    out.push({ slot, exerciseId: was.item.exerciseId, section: was.section, before });
  }
  return out;
}

export const tombstonesIn = (all: readonly Tombstone[], section: Section): Tombstone[] =>
  all.filter((t) => t.section === section);
