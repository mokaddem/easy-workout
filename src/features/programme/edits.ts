import type { TFunction } from 'i18next';
import type { Block, Programme, Session, SessionItem, SessionLog } from '@/domain';
import {
  bySlot,
  isRampSlot,
  itemEdits,
  placedItems,
  removedSlots,
  sessionEdited,
  generatedSession,
  type ItemEdit,
} from '@/engine';
import { effortText } from './effort';
import { range } from './format';

/** What the user changed in one programme session, measured against how it was generated. */
export interface SessionEdits {
  generated: Session;
  /** Edited and added items by slot; ramp-up sets never count. */
  items: Map<string, ItemEdit>;
  removed: string[];
  /** Changes shown to the user: edited or added items plus removed ones, at least 1. */
  count: number;
}

/** `null` when the session is as generated. */
export function sessionEdits(session: Session, generated: Session): SessionEdits | null {
  if (!sessionEdited(session, generated)) return null;
  const items = new Map([...itemEdits(session, generated)].filter(([slot]) => !isRampSlot(slot)));
  const removed = removedSlots(session, generated).filter((slot) => !isRampSlot(slot));
  return { generated, items, removed, count: Math.max(1, items.size + removed.length) };
}

/** How a rotation place relates to the generated programme. */
export type PlaceState =
  | { kind: 'placed'; customId: string; generatedName: Session['name'] }
  | { kind: 'edited'; edits: SessionEdits }
  | { kind: 'plain' };

/** "Session D — Upper-body density" → "Upper-body density", in both languages. */
const titleOf = (name: Session['name']): Session['name'] => {
  const title = (text: string) => text.split(' — ').slice(1).join(' — ') || text;
  return { fr: title(name.fr), en: title(name.en) };
};

export function placeState(programme: Programme, sessionId: string): PlaceState {
  const generated = generatedSession(programme, sessionId);
  const customId = programme.placements?.[sessionId];
  if (customId && generated)
    return { kind: 'placed', customId, generatedName: titleOf(generated.name) };
  const session = programme.rotation.find((s) => s.id === sessionId);
  const edits = session && generated ? sessionEdits(session, generated) : null;
  return edits ? { kind: 'edited', edits } : { kind: 'plain' };
}

/** Per rotation session: placed (mine), edited, or untouched. */
export function rotationMarks(programme: Programme): Map<string, 'mine' | 'edited'> {
  const marks = new Map<string, 'mine' | 'edited'>();
  for (const session of programme.rotation) {
    const state = placeState(programme, session.id);
    if (state.kind !== 'plain') marks.set(session.id, state.kind === 'placed' ? 'mine' : 'edited');
  }
  return marks;
}

/** One measurable change on an item: the old and new value, ready for a sentence. */
export type DoseChange =
  | { part: 'range'; now: string; was: string }
  | { part: 'time'; now: string; was: string }
  | { part: 'minutes'; now: string; was: string }
  | { part: 'sets'; now: number; was: number }
  | { part: 'effort'; now: number; was: number }
  | { part: 'rest'; now: number; was: number };

/** What the line under an edited exercise says. */
export type EditLine =
  | { kind: 'replaced'; before: string }
  | { kind: 'added'; history: boolean }
  | { kind: 'grouped' }
  | { kind: 'dose'; changes: DoseChange[] };

const setsOf = (b: Block) => (b.type === 'straight' ? b.sets : b.rounds);
const restOf = (b: Block) => (b.type === 'straight' ? b.restSec : b.restAfterRoundSec);

function targetChange(now: SessionItem['target'], was: SessionItem['target']): DoseChange[] {
  if (now.kind === 'reps' && was.kind === 'reps')
    return now.min === was.min && now.max === was.max
      ? []
      : [{ part: 'range', now: range(now.min, now.max), was: range(was.min, was.max) }];
  if (now.kind === 'time' && was.kind === 'time')
    return now.minSec === was.minSec && now.maxSec === was.maxSec
      ? []
      : [
          {
            part: 'time',
            now: range(now.minSec, now.maxSec),
            was: range(was.minSec, was.maxSec),
          },
        ];
  if (now.kind === 'cardio' && was.kind === 'cardio')
    return now.minMinutes === was.minMinutes && now.maxMinutes === was.maxMinutes
      ? []
      : [
          {
            part: 'minutes',
            now: range(now.minMinutes, now.maxMinutes),
            was: range(was.minMinutes, was.maxMinutes),
          },
        ];
  return [];
}

/**
 * The line for one edited item, `null` when the item is as generated. `history`: the user has
 * already trained this exercise, so an added one starts from their own load.
 */
export function editLine(
  session: Session,
  generated: Session,
  slot: string,
  history: (exerciseId: string) => boolean = () => false,
): EditLine | null {
  const now = bySlot(session).get(slot);
  if (!now) return null;
  const was = bySlot(generated).get(slot);
  if (!was) return { kind: 'added', history: history(now.item.exerciseId) };
  if (was.item.exerciseId !== now.item.exerciseId)
    return { kind: 'replaced', before: was.item.exerciseId };
  const changes: DoseChange[] = [...targetChange(now.item.target, was.item.target)];
  if (setsOf(now.block) !== setsOf(was.block))
    changes.push({ part: 'sets', now: setsOf(now.block), was: setsOf(was.block) });
  if (now.item.rir !== undefined && was.item.rir !== undefined && now.item.rir !== was.item.rir)
    changes.push({ part: 'effort', now: now.item.rir, was: was.item.rir });
  if (restOf(now.block) !== restOf(was.block) && now.block.type === was.block.type)
    changes.push({ part: 'rest', now: restOf(now.block), was: restOf(was.block) });
  if (changes.length === 0 && now.block.type !== 'straight' && was.block.type === 'straight')
    return { kind: 'grouped' };
  return changes.length > 0 ? { kind: 'dose', changes } : null;
}

/** The user has logged this exercise before. */
export const hasHistory = (logs: readonly SessionLog[] | undefined, exerciseId: string): boolean =>
  (logs ?? []).some(
    (log) =>
      log.status !== 'abandoned' &&
      [...placedItems(log.plan)].some((p) => p.item.exerciseId === exerciseId),
  );

const effort = (t: TFunction, rir: number) => effortText(t, rir);

/** New and old value of one change, with units: "5 sets", "6–10 reps", "rest 90 s". */
export function changeValues(t: TFunction, change: DoseChange): { now: string; was: string } {
  switch (change.part) {
    case 'range':
      return {
        now: t('programme.edit.unit.reps', { value: change.now }),
        was: change.was,
      };
    case 'time':
      return { now: t('programme.edit.unit.s', { value: change.now }), was: change.was };
    case 'minutes':
      return { now: t('programme.edit.unit.min', { value: change.now }), was: change.was };
    case 'sets':
      return {
        now: t('programme.edit.unit.sets', { count: change.now }),
        was: String(change.was),
      };
    case 'effort':
      return { now: effort(t, change.now), was: effort(t, change.was).toLocaleLowerCase() };
    case 'rest':
      return { now: t('programme.edit.unit.rest', { value: change.now }), was: `${change.was} s` };
  }
}

/** The sentence under an edited exercise. */
export function editSentence(t: TFunction, line: EditLine, nameOf: (id: string) => string): string {
  switch (line.kind) {
    case 'replaced':
      return t('programme.edit.replaced', { name: nameOf(line.before) });
    case 'added':
      return t(line.history ? 'programme.edit.added' : 'programme.edit.addedNew');
    case 'grouped':
      return t('programme.edit.grouped');
    case 'dose': {
      if (line.changes.length > 1) {
        const list = line.changes.map((c) => changeValues(t, c).now).join(', ');
        return t('programme.edit.several', { list });
      }
      const change = line.changes[0]!;
      const { now, was } = changeValues(t, change);
      return t(`programme.edit.${change.part}`, { new: now, old: was });
    }
  }
}

/** The "what" of a ledger row: a short fragment, never gendered. */
export function ledgerWhat(
  t: TFunction,
  kind: 'exercise' | 'dose' | 'added' | 'removed' | 'placement' | 'session',
  line: EditLine | null,
): string {
  switch (kind) {
    case 'added':
      return t('programme.preview.edits.what.added');
    case 'removed':
      return t('programme.preview.edits.what.removed');
    case 'exercise':
      return t('programme.preview.edits.what.replaced');
    case 'placement':
      return t('programme.preview.edits.what.placed');
    case 'session':
      return t('programme.preview.edits.what.edited');
    case 'dose':
      if (line?.kind === 'grouped') return t('programme.preview.edits.what.grouped');
      if (line?.kind === 'dose' && line.changes.length === 1) {
        const { now, was } = changeValues(t, line.changes[0]!);
        return t('programme.preview.edits.what.dose', { new: now, old: was });
      }
      return t('programme.preview.edits.what.edited');
  }
}
