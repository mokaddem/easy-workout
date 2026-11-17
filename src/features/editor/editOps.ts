import type { Block, Session } from '@/domain';
import {
  insertBlock,
  isRampSlot,
  itemEdits,
  itemsOf,
  moveBlock,
  placedItems,
  removedSlots,
  removeItem,
  sameValue,
  SECTIONS,
  ungroupedRest,
  type BlockAt,
  type EditContext,
  type ItemAt,
  type Section,
} from '@/engine';

/** Moves a block one place up or down inside its section; at the edge nothing changes. */
export function moveBlockBy(session: Session, at: BlockAt, delta: -1 | 1): Session {
  const to = at.index + delta;
  if (to < 0 || to >= session[at.section].length) return session;
  return moveBlock(session, at, { section: at.section, index: to });
}

export const canMoveBy = (session: Session, at: BlockAt, delta: -1 | 1): boolean => {
  const to = at.index + delta;
  return to >= 0 && to < session[at.section].length;
};

/** Takes a block to the end of another section. */
export function moveBlockToSection(session: Session, at: BlockAt, to: Section): Session {
  if (at.section === to) return session;
  return moveBlock(session, at, { section: to, index: session[to].length });
}

/** Changes the style of a group (superset or circuit) without touching its dose. */
export function setGroupStyle(
  session: Session,
  section: Section,
  index: number,
  style: 'superset' | 'circuit',
): Session {
  const block = session[section][index];
  if (!block || block.type !== 'group' || block.style === style) return session;
  return {
    ...session,
    [section]: session[section].map((b, i) => (i === index ? { ...block, style } : b)),
  };
}

/** Where a block sits among the numbered ones: main blocks count from 1, other sections aren't numbered. */
export const blockNumber = (section: Section, index: number): number | undefined =>
  section === 'main' ? index + 1 : undefined;

export const hasItems = (session: Session): boolean =>
  SECTIONS.some((section) => session[section].length > 0);

/** The block of a session with no items inside, for comparing blocks apart from their exercises. */
const shell = (block: Block) =>
  block.type === 'straight'
    ? { type: block.type, sets: block.sets, restSec: block.restSec }
    : { ...block, items: block.items.map((i) => i.slot) };

/** Sections, order and doses the user can change, for telling whether anything differs. */
export function sameSession(a: Session, b: Session): boolean {
  const face = (s: Session) => ({
    name: s.name,
    dismissed: [...(s.dismissedIssues ?? [])].sort(),
    ...Object.fromEntries(SECTIONS.map((sec) => [sec, s[sec]])),
  });
  return sameValue(face(a), face(b));
}

/**
 * How many things differ from `initial`, for the leave sheet: items changed, added or taken
 * out, plus one for a changed name or order. At least 1 when anything differs.
 */
export function countChanges(draft: Session, initial: Session): number {
  if (sameSession(draft, initial)) return 0;
  const edits = [...itemEdits(draft, initial)].filter(([slot]) => !isRampSlot(slot)).length;
  const removed = removedSlots(draft, initial).filter((slot) => !isRampSlot(slot)).length;
  const renamed = sameValue(draft.name, initial.name) ? 0 : 1;
  return Math.max(1, edits + removed + renamed);
}

/** Dismissals are about one item: when that item (or its block's dose) changes, they go. */
export function pruneDismissals(previous: Session, next: Session): Session {
  const dismissed = next.dismissedIssues;
  if (!dismissed || dismissed.length === 0) return next;
  const was = new Map([...placedItems(previous)].map((p) => [p.item.slot, p]));
  const now = new Map([...placedItems(next)].map((p) => [p.item.slot, p]));
  const kept = dismissed.filter((key) => {
    const slot = key.split('|')[1];
    if (!slot) return true;
    const a = was.get(slot);
    const b = now.get(slot);
    if (!b) return false;
    if (!a) return true;
    return sameValue([a.item, shell(a.block)], [b.item, shell(b.block)]);
  });
  if (kept.length === dismissed.length) return next;
  const { dismissedIssues: _, ...rest } = next;
  return kept.length > 0 ? { ...rest, dismissedIssues: kept } : rest;
}

export function dismissIssue(session: Session, key: string): Session {
  const dismissed = session.dismissedIssues ?? [];
  return dismissed.includes(key) ? session : { ...session, dismissedIssues: [...dismissed, key] };
}

/** Every exercise id in the session, for marking them in the picker. */
export const exerciseIdsOf = (session: Session): Set<string> =>
  new Set(SECTIONS.flatMap((s) => session[s].flatMap((b) => itemsOf(b).map((i) => i.exerciseId))));

/** A blank session for the "new" route. */
export function blankSession(): Session {
  return {
    id: 'new',
    name: { fr: '', en: '' },
    estimatedMinutes: 1,
    warmup: [],
    main: [],
    finisher: [],
  };
}

/**
 * Takes one exercise out of a group: it goes after the group as straight sets of the group's
 * rounds, with the rest its place calls for. A group left with one exercise becomes straight sets.
 */
export function takeOutOfGroup(session: Session, at: ItemAt, ctx: EditContext): Session {
  const block = session[at.section][at.blockIndex];
  if (!block || block.type !== 'group') return session;
  const item = block.items[at.itemIndex];
  if (!item) return session;
  const without = removeItem(session, at);
  const leads = at.section === 'main' && at.blockIndex === 0 && at.itemIndex === 0;
  const alone: Block = {
    type: 'straight',
    item,
    sets: block.rounds,
    restSec: ungroupedRest(item, at.section, ctx, leads),
  };
  // The group stays at its place unless it collapsed: then its remaining exercise is that place.
  return insertBlock(without, { section: at.section, index: at.blockIndex + 1 }, alone);
}
