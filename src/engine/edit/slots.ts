import type { Block, GenerationNote, Programme, Session, SessionItem } from '../../domain';

export type Section = 'warmup' | 'main' | 'finisher';
export const SECTIONS: readonly Section[] = ['warmup', 'main', 'finisher'];

export const itemsOf = (block: Block): SessionItem[] =>
  block.type === 'straight' ? [block.item] : block.items;

export const withItems = (block: Block, items: SessionItem[]): Block =>
  block.type === 'straight' ? { ...block, item: items[0]! } : { ...block, items };

const isCardio = (item: SessionItem) =>
  item.target.kind === 'cardio' || item.target.kind === 'interval';

/** The block's anchor: the slot of its first item. */
export const blockSlot = (block: Block): string => itemsOf(block)[0]!.slot ?? '';

/** Every item of a session with where it sits. */
export function* placedItems(session: Session): Generator<{
  section: Section;
  blockIndex: number;
  itemIndex: number;
  item: SessionItem;
  block: Block;
}> {
  for (const section of SECTIONS)
    for (const [blockIndex, block] of session[section].entries())
      for (const [itemIndex, item] of itemsOf(block).entries())
        yield { section, blockIndex, itemIndex, item, block };
}

/** The slot the generator recorded for each position, from its notes about one session. */
const slotsFromNotes = (notes: readonly GenerationNote[]): Map<string, string> => {
  const map = new Map<string, string>();
  let ramps = 0;
  for (const n of notes) {
    if (!n.ref?.section) continue;
    const at = `${n.ref.section}/${n.ref.blockIndex ?? 0}/${n.ref.itemIndex ?? 0}`;
    if (map.has(at)) continue;
    if (n.code === 'ramp-up') map.set(at, `ramp-${++ramps}`);
    else if (n.code.startsWith('exercise-') && typeof n.params.slot === 'string')
      map.set(at, n.params.slot);
  }
  return map;
};

/** Ramp-up sets: lighter sets of the first lift, re-derived whenever that lift changes. */
export const isRampSlot = (slot: string | undefined): boolean => !!slot?.startsWith('ramp-');

/**
 * Gives every item of a session a slot id, unique within it. Existing ids are kept; otherwise
 * the generator's slot from its notes, then `cardio-<section>-<block>` for cardio (as programme
 * changes name them), then the item's position. Repeats get a `-2`, `-3`… suffix.
 */
export function ensureSlots(session: Session, notes: readonly GenerationNote[] = []): Session {
  const fromNotes = slotsFromNotes(notes.filter((n) => n.ref?.sessionId === session.id));
  // Ids already on items are reserved, so a filled-in id never takes one used further down.
  const reserved = new Set<string>();
  for (const { item } of placedItems(session)) if (item.slot) reserved.add(item.slot);
  const used = new Set<string>();
  const unique = (wanted: string, own: boolean) => {
    let id = wanted;
    for (let n = 2; used.has(id) || (!own && reserved.has(id)); n++) id = `${wanted}-${n}`;
    used.add(id);
    return id;
  };
  const assign = (section: Section, blocks: Block[]): Block[] =>
    blocks.map((block, blockIndex) =>
      withItems(
        block,
        itemsOf(block).map((item, itemIndex) => {
          if (item.slot) {
            const slot = unique(item.slot, true);
            return slot === item.slot ? item : { ...item, slot };
          }
          const wanted =
            fromNotes.get(`${section}/${blockIndex}/${itemIndex}`) ??
            (isCardio(item)
              ? `cardio-${section}-${blockIndex}`
              : `${section}-${blockIndex}-${itemIndex}`);
          return { ...item, slot: unique(wanted, false) };
        }),
      ),
    );
  return {
    ...session,
    warmup: assign('warmup', session.warmup),
    main: assign('main', session.main),
    finisher: assign('finisher', session.finisher),
  };
}

/** A programme whose sessions (as run and as generated) all carry slot ids. */
export function programmeWithSlots<P extends Programme>(programme: P): P {
  const notes = programme.generation?.notes ?? [];
  return {
    ...programme,
    rotation: programme.rotation.map((s) => ensureSlots(s, notes)),
    ...(programme.generatedRotation && {
      generatedRotation: programme.generatedRotation.map((s) => ensureSlots(s, notes)),
    }),
  };
}

/** A fresh slot id for an item the user adds, not used in the session. */
export function newSlot(session: Session, random: () => number = Math.random): string {
  const used = new Set([...placedItems(session)].map((p) => p.item.slot));
  for (;;) {
    const id = `u-${Math.floor(random() * 36 ** 6)
      .toString(36)
      .padStart(6, '0')}`;
    if (!used.has(id)) return id;
  }
}
