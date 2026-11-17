import type { Block, Programme, Session, SessionItem } from '../../domain';
import { sessionMinutes } from '../duration';
import { ensureSlots, itemsOf, placedItems, programmeWithSlots, type Section } from './slots';

/** Same content, whatever the key order. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

/** What the user can change on an item. Load and goal belong to the progression. */
const itemFace = (item: SessionItem) => ({
  exerciseId: item.exerciseId,
  target: item.target,
  rir: item.rir,
  perSide: item.perSide,
});

/** What the user can change on a block, and which items it chains. */
const blockFace = (block: Block) =>
  block.type === 'straight'
    ? { type: block.type, sets: block.sets, restSec: block.restSec }
    : {
        type: block.type,
        rounds: block.rounds,
        restBetweenItemsSec: block.restBetweenItemsSec,
        restAfterRoundSec: block.restAfterRoundSec,
        slots: block.items.map((i) => i.slot),
      };

export interface Located {
  section: Section;
  blockIndex: number;
  itemIndex: number;
  item: SessionItem;
  block: Block;
}

/** Every item of a session by slot. */
export const bySlot = (session: Session): Map<string, Located> =>
  new Map([...placedItems(session)].map((p) => [p.item.slot ?? '', p]));

export type ItemEdit = 'added' | 'exercise' | 'dose';

/** Exercise changed, dose changed (item or its block), or added by the user — by slot. */
export function itemEdits(session: Session, generated: Session): Map<string, ItemEdit> {
  const base = bySlot(generated);
  const edits = new Map<string, ItemEdit>();
  for (const { item, block } of placedItems(session)) {
    const slot = item.slot ?? '';
    const was = base.get(slot);
    if (!was) edits.set(slot, 'added');
    else if (was.item.exerciseId !== item.exerciseId) edits.set(slot, 'exercise');
    else if (
      !sameValue(itemFace(was.item), itemFace(item)) ||
      !sameValue(blockFace(was.block), blockFace(block))
    )
      edits.set(slot, 'dose');
  }
  return edits;
}

/** Slots of the generated session the user took out. */
export function removedSlots(session: Session, generated: Session): string[] {
  const now = bySlot(session);
  return [...bySlot(generated).keys()].filter((slot) => !now.has(slot));
}

const face = (session: Session) => ({
  name: session.name,
  warmup: session.warmup.map(sectionFace),
  main: session.main.map(sectionFace),
  finisher: session.finisher.map(sectionFace),
});
const sectionFace = (block: Block) => ({
  ...blockFace(block),
  items: itemsOf(block).map(itemFace),
});

/** The session differs from how it was generated in anything the user can change. */
export const sessionEdited = (session: Session, generated: Session): boolean =>
  !sameValue(face(session), face(generated));

const generatedOf = (programme: Programme, sessionId: string): Session | undefined =>
  (programme.generatedRotation ?? programme.rotation).find((s) => s.id === sessionId);

/** The generated version of a rotation session, with slots. */
export function generatedSession(programme: Programme, sessionId: string): Session | undefined {
  const session = generatedOf(programme, sessionId);
  return session && ensureSlots(session, programme.generation?.notes);
}

/** Keeps the generated rotation only while something differs from it. */
export function tidy<P extends Programme>(programme: P): P {
  const generated = programme.generatedRotation;
  if (!generated) return programme;
  const placed = Object.keys(programme.placements ?? {}).length > 0;
  const edited = programme.rotation.some((s, i) => sessionEdited(s, generated[i]!));
  if (placed || edited) return programme;
  const { generatedRotation: _, placements: __, ...rest } = programme;
  return rest as P;
}

/** The programme ready to be edited: slots everywhere, the generated rotation kept aside. */
function editable<P extends Programme>(programme: P): P {
  const withSlots = programmeWithSlots(programme);
  return withSlots.generatedRotation
    ? withSlots
    : { ...withSlots, generatedRotation: withSlots.rotation };
}

const replaceSession = <P extends Programme>(programme: P, session: Session): P => {
  if (!programme.rotation.some((s) => s.id === session.id))
    throw new Error(`no session ${session.id} in programme ${programme.id}`);
  const fitted = { ...session, estimatedMinutes: sessionMinutes(session) };
  return {
    ...programme,
    rotation: programme.rotation.map((s) => (s.id === session.id ? fitted : s)),
  };
};

/** Stores the user's version of a generated session, for the whole cycle. */
export function saveSessionEdit<P extends Programme>(programme: P, session: Session): P {
  if (programme.placements?.[session.id])
    throw new Error(`session ${session.id} is one of the user's own: edit that one instead`);
  return tidy(replaceSession(editable(programme), ensureSlots(session)));
}

/** Back to the generated session (and out of the programme, for a placed one of the user's own). */
export function resetSession<P extends Programme>(programme: P, sessionId: string): P {
  const generated = generatedSession(programme, sessionId);
  if (!generated) throw new Error(`no session ${sessionId} in programme ${programme.id}`);
  const { [sessionId]: _, ...placements } = programme.placements ?? {};
  return tidy({ ...replaceSession(editable(programme), generated), placements });
}

/**
 * One item back to how it was generated. Its whole block comes back when both are straight sets;
 * inside a group only the exercise and its dose do.
 */
export function resetItem(session: Session, generated: Session, slot: string): Session {
  const now = bySlot(session).get(slot);
  const was = bySlot(generated).get(slot);
  if (!now || !was) return session;
  const block: Block =
    now.block.type === 'straight' && was.block.type === 'straight'
      ? was.block
      : now.block.type === 'straight'
        ? { ...now.block, item: was.item }
        : { ...now.block, items: now.block.items.map((i) => (i.slot === slot ? was.item : i)) };
  const blocks = session[now.section].map((b, i) => (i === now.blockIndex ? block : b));
  const next = { ...session, [now.section]: blocks };
  return { ...next, estimatedMinutes: sessionMinutes(next) };
}

/** The user's own session in a rotation place: a copy under that place's id. */
const placedCopy = (custom: Session, sessionId: string): Session => {
  const copy = { ...ensureSlots(custom), id: sessionId };
  return { ...copy, estimatedMinutes: sessionMinutes(copy) };
};

/** Runs one of the user's own sessions in place of a rotation session. */
export function placeSession<P extends Programme>(
  programme: P,
  sessionId: string,
  custom: Session,
): P {
  const ready = editable(programme);
  const generated = generatedSession(ready, sessionId);
  if (!generated) throw new Error(`no session ${sessionId} in programme ${programme.id}`);
  return {
    ...replaceSession(ready, placedCopy(custom, sessionId)),
    placements: { ...ready.placements, [sessionId]: custom.id },
  };
}

/** Rotation places running this session of the user's own. */
export const placesOf = (programme: Programme, customId: string): string[] =>
  Object.entries(programme.placements ?? {})
    .filter(([, id]) => id === customId)
    .map(([sessionId]) => sessionId);

/** After the user's own session changed: every place running it gets the new version. */
export function syncPlacements<P extends Programme>(programme: P, custom: Session): P {
  return placesOf(programme, custom.id).reduce(
    (p, sessionId) => replaceSession(p, placedCopy(custom, sessionId)),
    programme,
  );
}

/** Takes one of the user's own sessions out of the programme everywhere it runs. */
export function removePlacements<P extends Programme>(programme: P, customId: string): P {
  return placesOf(programme, customId).reduce(
    (p, sessionId) => resetSession(p, sessionId),
    programme,
  );
}

/**
 * Puts a generated item the user took out back where the generation had it: after the nearest
 * earlier generated block still in the session (else first in its section), as straight sets
 * unless its whole group is missing.
 */
export function restoreSlot(session: Session, generated: Session, slot: string): Session {
  const was = bySlot(generated).get(slot);
  if (!was || bySlot(session).has(slot)) return session;
  const present = new Set(bySlot(session).keys());
  const mates = itemsOf(was.block);
  const block: Block = mates.every((i) => !present.has(i.slot ?? ''))
    ? was.block
    : was.block.type === 'straight'
      ? was.block
      : {
          type: 'straight',
          item: was.item,
          sets: was.block.rounds,
          restSec: was.block.restAfterRoundSec,
        };
  const blocks = [...session[was.section]];
  let at = 0;
  for (let i = was.blockIndex - 1; i >= 0 && at === 0; i--) {
    const slots = new Set(itemsOf(generated[was.section][i]!).map((x) => x.slot));
    const found = blocks.findIndex((b) => itemsOf(b).some((x) => slots.has(x.slot)));
    if (found >= 0) at = found + 1;
  }
  blocks.splice(at, 0, block);
  const next = { ...session, [was.section]: blocks };
  return { ...next, estimatedMinutes: sessionMinutes(next) };
}
