import type { Block, Session, SessionItem } from '../../domain';
import { sessionMinutes } from '../duration';
import { itemsOf, type Section } from './slots';

/** Where an item sits in a session. */
export interface ItemAt {
  section: Section;
  blockIndex: number;
  itemIndex: number;
}

/** Where a block sits, or goes, in a session. */
export interface BlockAt {
  section: Section;
  index: number;
}

/** Sets and rest for straight blocks; rounds and rests for groups. Fields of the other kind are ignored. */
export interface BlockDose {
  sets?: number;
  restSec?: number;
  rounds?: number;
  restBetweenItemsSec?: number;
  restAfterRoundSec?: number;
}

export type ItemDose = Partial<Pick<SessionItem, 'target' | 'rir'>>;

const finish = (session: Session): Session => ({
  ...session,
  estimatedMinutes: sessionMinutes(session),
});

const withSection = (session: Session, section: Section, blocks: Block[]): Session =>
  finish({ ...session, [section]: blocks });

const blockAt = (session: Session, section: Section, index: number): Block => {
  const block = session[section][index];
  if (!block) throw new Error(`no block ${section}/${index}`);
  return block;
};

/** A group of two items is a superset, more is a circuit; one left becomes straight sets. */
const regroup = (group: Extract<Block, { type: 'group' }>, items: SessionItem[]): Block =>
  items.length === 1
    ? { type: 'straight', item: items[0]!, sets: group.rounds, restSec: group.restAfterRoundSec }
    : { ...group, items, style: items.length === 2 ? group.style : 'circuit' };

export function insertBlock(session: Session, at: BlockAt, block: Block): Session {
  const blocks = [...session[at.section]];
  blocks.splice(Math.max(0, Math.min(at.index, blocks.length)), 0, block);
  return withSection(session, at.section, blocks);
}

export function removeBlock(session: Session, section: Section, index: number): Session {
  blockAt(session, section, index);
  return withSection(
    session,
    section,
    session[section].filter((_, i) => i !== index),
  );
}

/** Moves a block within its section or to another one. */
export function moveBlock(session: Session, from: BlockAt, to: BlockAt): Session {
  const block = blockAt(session, from.section, from.index);
  return insertBlock(removeBlock(session, from.section, from.index), to, block);
}

export function setBlockDose(
  session: Session,
  section: Section,
  index: number,
  dose: BlockDose,
): Session {
  const block = blockAt(session, section, index);
  const { sets, restSec, rounds, restBetweenItemsSec, restAfterRoundSec } = dose;
  const next: Block =
    block.type === 'straight'
      ? { ...block, ...(sets !== undefined && { sets }), ...(restSec !== undefined && { restSec }) }
      : {
          ...block,
          ...(rounds !== undefined && { rounds }),
          ...(restBetweenItemsSec !== undefined && { restBetweenItemsSec }),
          ...(restAfterRoundSec !== undefined && { restAfterRoundSec }),
        };
  return withSection(
    session,
    section,
    session[section].map((b, i) => (i === index ? next : b)),
  );
}

const mapItem = (session: Session, at: ItemAt, fn: (item: SessionItem) => SessionItem): Session => {
  const block = blockAt(session, at.section, at.blockIndex);
  const items = itemsOf(block);
  if (!items[at.itemIndex])
    throw new Error(`no item ${at.section}/${at.blockIndex}/${at.itemIndex}`);
  const next: Block =
    block.type === 'straight'
      ? { ...block, item: fn(block.item) }
      : { ...block, items: items.map((item, i) => (i === at.itemIndex ? fn(item) : item)) };
  return withSection(
    session,
    at.section,
    session[at.section].map((b, i) => (i === at.blockIndex ? next : b)),
  );
};

export function setItemDose(session: Session, at: ItemAt, dose: ItemDose): Session {
  return mapItem(session, at, (item) => {
    const next = { ...item, ...dose };
    if ('rir' in dose && dose.rir === undefined) delete next.rir;
    return next;
  });
}

/** Puts another item in this place; it keeps the place's slot. */
export function replaceItem(session: Session, at: ItemAt, item: SessionItem): Session {
  return mapItem(session, at, (was) => ({
    ...item,
    ...(was.slot !== undefined && { slot: was.slot }),
  }));
}

/** Removes one exercise; a block left empty goes, a group left with one becomes straight sets. */
export function removeItem(session: Session, at: ItemAt): Session {
  const block = blockAt(session, at.section, at.blockIndex);
  if (block.type === 'straight') return removeBlock(session, at.section, at.blockIndex);
  const items = block.items.filter((_, i) => i !== at.itemIndex);
  return withSection(
    session,
    at.section,
    session[at.section].map((b, i) => (i === at.blockIndex ? regroup(block, items) : b)),
  );
}

/** Reorders the exercises of a group. */
export function moveItem(session: Session, at: ItemAt, toIndex: number): Session {
  const block = blockAt(session, at.section, at.blockIndex);
  if (block.type === 'straight') return session;
  const items = [...block.items];
  const [item] = items.splice(at.itemIndex, 1);
  if (!item) return session;
  items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, item);
  return withSection(
    session,
    at.section,
    session[at.section].map((b, i) => (i === at.blockIndex ? { ...block, items } : b)),
  );
}

/** Adds an exercise to a group, or turns straight sets into a superset with it. */
export function addToGroup(
  session: Session,
  section: Section,
  blockIndex: number,
  item: SessionItem,
  restBetweenItemsSec = 0,
): Session {
  const block = blockAt(session, section, blockIndex);
  const next: Block =
    block.type === 'straight'
      ? {
          type: 'group',
          style: 'superset',
          items: [block.item, item],
          rounds: block.sets,
          restBetweenItemsSec,
          restAfterRoundSec: block.restSec,
        }
      : regroup(block, [...block.items, item]);
  return withSection(
    session,
    section,
    session[section].map((b, i) => (i === blockIndex ? next : b)),
  );
}

/**
 * Chains a block with the next one: their exercises run back to back, for the larger number of
 * rounds, with the longer of their rests after each round.
 */
export function groupWithNext(
  session: Session,
  section: Section,
  index: number,
  restBetweenItemsSec = 0,
): Session {
  const a = blockAt(session, section, index);
  const b = blockAt(session, section, index + 1);
  const count = (x: Block) => (x.type === 'straight' ? x.sets : x.rounds);
  const rest = (x: Block) => (x.type === 'straight' ? x.restSec : x.restAfterRoundSec);
  const items = [...itemsOf(a), ...itemsOf(b)];
  const group: Block = {
    type: 'group',
    style: items.length === 2 ? 'superset' : 'circuit',
    items,
    rounds: Math.max(count(a), count(b)),
    restBetweenItemsSec:
      a.type === 'group'
        ? a.restBetweenItemsSec
        : b.type === 'group'
          ? b.restBetweenItemsSec
          : restBetweenItemsSec,
    restAfterRoundSec: Math.max(rest(a), rest(b)),
  };
  const blocks = [...session[section]];
  blocks.splice(index, 2, group);
  return withSection(session, section, blocks);
}

/** Splits a group into straight sets of each exercise, one after the other. */
export function ungroup(session: Session, section: Section, index: number): Session {
  const block = blockAt(session, section, index);
  if (block.type === 'straight') return session;
  const straight: Block[] = block.items.map((item) => ({
    type: 'straight',
    item,
    sets: block.rounds,
    restSec: block.restAfterRoundSec,
  }));
  const blocks = [...session[section]];
  blocks.splice(index, 1, ...straight);
  return withSection(session, section, blocks);
}

export function renameSession(session: Session, name: Session['name']): Session {
  return { ...session, name };
}
