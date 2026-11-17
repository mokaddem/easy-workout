import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { exerciseById } from '@/catalogue';
import type { Block, Profile, Programme } from '@/domain';
import {
  defaultBlock,
  generateProgramme,
  generatedSession,
  insertBlock,
  newSlot,
  placeSession,
  removeBlock,
  saveSessionEdit,
  setBlockDose,
  setItemDose,
  type EditContext,
} from '@/engine';
import { resources } from '@/i18n/resources';
import { referenceEquipment } from '../../../tests/fixtures/reference-equipment';
import {
  editLine,
  editSentence,
  hasHistory,
  placeState,
  rotationMarks,
  sessionEdits,
} from './edits';
import { ledgerRows } from './ledger';
import { previewData } from './preview';
import { notesForItem } from './why';

const profile: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 60,
};
const ref = generateProgramme({ profile, equipment: referenceEquipment });
const ctx: EditContext = { profile, inventory: referenceEquipment, exercises: exerciseById };
const push = ref.rotation.find((s) => s.id === 'a-push')!;
const straight = (b: Block | undefined) => {
  if (b?.type !== 'straight') throw new Error('expected straight sets');
  return b;
};

const instance = i18next.createInstance();
beforeAll(async () => {
  await instance.init({
    lng: 'en',
    fallbackLng: false,
    resources: { fr: { translation: resources.fr }, en: { translation: resources.en } },
    interpolation: { escapeValue: false },
  });
});

/** Fewer sets on the second block and a lateral raise on the end. */
const edit = (p: Programme): Programme => {
  const base = p.rotation.find((s) => s.id === 'a-push')!;
  const fewer = setBlockDose(base, 'main', 1, { sets: 2 });
  const added = insertBlock(
    fewer,
    { section: 'main', index: fewer.main.length },
    defaultBlock(exerciseById.get('dumbbell-lateral-raise')!, 'main', newSlot(fewer), ctx, false),
  );
  return saveSessionEdit(p, added);
};

describe('session edits', () => {
  const edited = edit(ref);
  const generated = generatedSession(edited, 'a-push')!;
  const stored = edited.rotation.find((s) => s.id === 'a-push')!;

  it('counts the changes and nothing for an untouched session', () => {
    expect(sessionEdits(stored, generated)?.count).toBe(2);
    const untouched = ref.rotation.find((s) => s.id === 'b-pull')!;
    expect(sessionEdits(untouched, generatedSession(ref, 'b-pull')!)).toBeNull();
  });

  it('counts a removed exercise', () => {
    const removed = removeBlock(stored, 'main', 0);
    expect(sessionEdits(removed, generated)?.count).toBe(3);
  });

  it('marks edited and placed places for the overview', () => {
    expect(rotationMarks(edited).get('a-push')).toBe('edited');
    expect(rotationMarks(ref).size).toBe(0);
    const placed = placeSession(ref, 'a-push', { ...push, id: 'own-1' });
    expect(rotationMarks(placed).get('a-push')).toBe('mine');
    expect(placeState(placed, 'a-push')).toMatchObject({ kind: 'placed', customId: 'own-1' });
  });

  it('says what changed on an item, in words', () => {
    const t = instance.getFixedT('en');
    const nameOf = (id: string) => exerciseById.get(id)?.name.en ?? id;
    const second = straight(stored.main[1]).item.slot!;
    const line = editLine(stored, generated, second)!;
    const was = straight(generated.main[1]).sets;
    expect(editSentence(t, line, nameOf)).toBe(`Edited by you: 2 sets instead of ${was}.`);
    const added = stored.main.at(-1)!;
    const addedSlot = straight(added).item.slot!;
    expect(editSentence(t, editLine(stored, generated, addedSlot)!, nameOf)).toMatch(
      /^Added by you\. First time/,
    );
    expect(
      editSentence(
        t,
        editLine(stored, generated, addedSlot, () => true)!,
        nameOf,
      ),
    ).toMatch(/from your history/);
  });

  it('names a range change with the old and the new range', () => {
    const t = instance.getFixedT('en');
    const first = straight(push.main[0]);
    const slot = first.item.slot!;
    const target = first.item.target;
    if (target.kind !== 'reps') throw new Error('expected reps');
    const changed = setItemDose(
      push,
      { section: 'main', blockIndex: 0, itemIndex: 0 },
      { target: { ...target, min: target.min + 1, max: target.max + 1 } },
    );
    const withSlots = saveSessionEdit(ref, changed);
    const s = withSlots.rotation.find((x) => x.id === 'a-push')!;
    const text = editSentence(
      t,
      editLine(s, generatedSession(withSlots, 'a-push')!, slot)!,
      String,
    );
    expect(text).toContain(
      `${target.min + 1}–${target.max + 1} reps instead of ${target.min}–${target.max}`,
    );
  });

  it('tells whether the user has trained an exercise', () => {
    expect(hasHistory(undefined, 'x')).toBe(false);
  });
});

describe('notes follow slots once blocks move', () => {
  it('finds the generation notes of an item at its new position', () => {
    const notes = ref.generation!.notes.filter((n) => n.ref?.sessionId === 'a-push');
    const withNote = notes.find(
      (n) => n.code.startsWith('exercise-') && n.ref?.section === 'main' && n.ref.blockIndex === 1,
    );
    if (!withNote) return;
    const generated = generatedSession(ref, 'a-push')!;
    const exerciseId = String(withNote.params.exerciseId);
    const slot = generated.main[withNote.ref!.blockIndex!]!;
    const item = slot.type === 'straight' ? slot.item : slot.items[withNote.ref!.itemIndex ?? 0]!;
    // The same item now stands first in the main part.
    const found = notesForItem(
      notes,
      { sessionId: 'a-push', section: 'main', blockIndex: 0, slot: item.slot! },
      exerciseId,
      generated,
    );
    expect(found).toContain(withNote);
    const elsewhere = notesForItem(
      notes,
      { sessionId: 'a-push', section: 'main', blockIndex: 1, slot: 'u-other' },
      exerciseId,
      generated,
    );
    expect(elsewhere).not.toContain(withNote);
  });
});

describe('regenerate preview', () => {
  const edited = edit(ref);

  it('lists nothing for a programme without edits', () => {
    const data = previewData('variant', ref, profile, referenceEquipment);
    expect(data.ledger).toBeNull();
  });

  it('keeps the edits and counts only the generator in the headline', () => {
    const data = previewData('variant', edited, profile, referenceEquipment);
    expect(data.ledger?.kept.length).toBe(2);
    expect(data.ledger?.dropped).toEqual([]);
    const plain = previewData('variant', ref, profile, referenceEquipment);
    expect(data.changes).toEqual(plain.changes);
    expect(data.next.generatedRotation).toBeDefined();
  });

  it('lists what the new split drops, with a reason', () => {
    const three: Profile = { ...profile, daysPerWeek: 3 };
    const data = previewData('new', edited, three, referenceEquipment);
    expect(data.splitChanged).toBe(true);
    const t = instance.getFixedT('en');
    const ledger = ledgerRows(t, 'en', edited, data.ledger!, {
      rotationIds: data.next.rotation.map((s) => s.id),
      days: 3,
      inventory: referenceEquipment,
    });
    expect(ledger.dropped).toHaveLength(1);
    expect(ledger.dropped[0]!.why).toMatch(/no longer exists with 3 days a week/);
    expect(ledger.splitChanged).toBe(true);
  });

  it('says what equipment a dropped exercise needs', () => {
    const goblet = saveSessionEdit(
      ref,
      insertBlock(
        push,
        { section: 'main', index: push.main.length },
        defaultBlock(exerciseById.get('goblet-squat')!, 'main', newSlot(push), ctx, false),
      ),
    );
    const none = referenceEquipment.filter((i) => i.kind !== 'dumbbell');
    const data = previewData('new', goblet, profile, none);
    const t = instance.getFixedT('en');
    const ledger = ledgerRows(t, 'en', goblet, data.ledger!, {
      rotationIds: data.next.rotation.map((s) => s.id),
      days: 6,
      inventory: none,
    });
    expect(ledger.dropped[0]).toMatchObject({
      why: 'Needs dumbbells, no longer in your equipment.',
      name: exerciseById.get('goblet-squat')!.name.en,
    });
    expect(ledger.dropped[0]!.where).toMatch(/^Session A, Push: your addition$/);
  });
});
