// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exerciseById } from '@/catalogue';
import type { Programme, Session } from '@/domain';
import {
  checkSession,
  generateProgramme,
  generatedSession,
  issueKey,
  programmeWithSlots,
  removeBlock,
  setBlockDose,
  type EditContext,
  type Issue,
} from '@/engine';
import { referenceEquipment } from '../../../tests/fixtures/reference-equipment';
import {
  blankSession,
  canMoveBy,
  countChanges,
  dismissIssue,
  moveBlockBy,
  moveBlockToSection,
  pruneDismissals,
  sameSession,
  setGroupStyle,
} from './editOps';
import { clearDraft, loadDraft, storeDraft } from './draftStore';
import { blockKey, firstBlocking, groupIssues } from './issues';
import { tombstones } from './tombstones';

const profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 60,
} as const;
const ctx: EditContext = { profile, inventory: referenceEquipment, exercises: exerciseById };

const programme: Programme = programmeWithSlots(
  generateProgramme({ profile, equipment: referenceEquipment, seed: 0 }),
);
const session: Session = programme.rotation[0]!;
const generated = generatedSession(programme, session.id)!;

describe('moving blocks', () => {
  it('moves inside a section and stops at the edges', () => {
    const moved = moveBlockBy(session, { section: 'main', index: 0 }, 1);
    expect(moved.main[1]).toEqual(session.main[0]);
    expect(moveBlockBy(session, { section: 'main', index: 0 }, -1)).toBe(session);
    expect(canMoveBy(session, { section: 'main', index: 0 }, -1)).toBe(false);
    expect(canMoveBy(session, { section: 'main', index: 0 }, 1)).toBe(true);
  });

  it('takes a block to the end of another section', () => {
    const moved = moveBlockToSection(session, { section: 'main', index: 0 }, 'finisher');
    expect(moved.main).toHaveLength(session.main.length - 1);
    expect(moved.finisher.at(-1)).toEqual(session.main[0]);
  });

  it('changes the style of a group only', () => {
    const at = session.main.findIndex((b) => b.type === 'group');
    if (at < 0) return;
    const next = setGroupStyle(session, 'main', at, 'circuit');
    const block = next.main[at]!;
    expect(block.type === 'group' && block.style).toBe('circuit');
    expect(setGroupStyle(session, 'main', 0, 'circuit').main[0]).toEqual(session.main[0]);
  });
});

describe('counting changes', () => {
  it('is 0 for the same session and counts edits and removals', () => {
    expect(countChanges(session, session)).toBe(0);
    const edited = setBlockDose(session, 'main', 0, { sets: 6 });
    expect(countChanges(edited, session)).toBe(1);
    const removed = removeBlock(edited, 'main', 1);
    expect(countChanges(removed, session)).toBe(2);
    expect(sameSession(edited, session)).toBe(false);
  });

  it('counts a rename', () => {
    expect(countChanges({ ...session, name: { fr: 'x', en: 'x' } }, session)).toBe(1);
  });
});

describe('dismissals', () => {
  it('keep while the item stays and go when it changes', () => {
    const slot = session.main[0]!.type === 'straight' ? session.main[0]!.item.slot! : '';
    const key = `rir-zero-loaded|${slot}|`;
    const dismissed = dismissIssue(session, key);
    expect(dismissed.dismissedIssues).toEqual([key]);
    expect(dismissIssue(dismissed, key)).toBe(dismissed);
    const untouched = setBlockDose(dismissed, 'main', 1, { sets: 2 });
    expect(pruneDismissals(dismissed, untouched).dismissedIssues).toEqual([key]);
    const changed = setBlockDose(dismissed, 'main', 0, { sets: 6 });
    expect(pruneDismissals(dismissed, changed).dismissedIssues).toBeUndefined();
  });

  it('go when the item is removed, session-level ones stay', () => {
    const slot = session.main[0]!.type === 'straight' ? session.main[0]!.item.slot! : '';
    const withBoth = {
      ...session,
      dismissedIssues: [`many-sets|${slot}|`, 'no-warmup||'],
    };
    const removed = removeBlock(withBoth, 'main', 0);
    expect(pruneDismissals(withBoth, removed).dismissedIssues).toEqual(['no-warmup||']);
  });
});

describe('grouping issues', () => {
  const issues: Issue[] = [
    {
      level: 'warn',
      code: 'many-sets',
      ref: { section: 'main', blockIndex: 1 },
      params: { sets: 6 },
    },
    { level: 'block', code: 'no-equipment', ref: { section: 'main', blockIndex: 0, slot: 'a' } },
    { level: 'warn', code: 'no-warmup' },
    { level: 'warn', code: 'over-budget', params: { minutes: 80, budget: 45 } },
    { level: 'block', code: 'main-empty' },
  ];

  it('sorts by where they show and sets the budget aside', () => {
    const grouped = groupIssues(issues);
    expect(grouped.byBlock.get(blockKey('main', 0))).toHaveLength(1);
    expect(grouped.byBlock.get(blockKey('main', 1))).toHaveLength(1);
    expect(grouped.session.map((i) => i.code)).toEqual(['no-warmup']);
    expect(grouped.budget?.code).toBe('over-budget');
    expect(grouped.mainEmpty).toBe(true);
    expect(grouped.blocking).toHaveLength(2);
  });

  it('hides dismissed warnings but never blocking issues', () => {
    const grouped = groupIssues(issues, [
      issueKey(issues[0]!),
      issueKey(issues[1]!),
      issueKey(issues[2]!),
    ]);
    expect(grouped.byBlock.has(blockKey('main', 1))).toBe(false);
    expect(grouped.byBlock.has(blockKey('main', 0))).toBe(true);
    expect(grouped.session).toEqual([]);
  });

  it('jumps to the first blocking issue in session order', () => {
    const first = firstBlocking(groupIssues(issues));
    expect(first?.code).toBe('no-equipment');
  });
});

describe('tombstones', () => {
  it('lists removed generated items where they were', () => {
    expect(tombstones(session, generated)).toEqual([]);
    const removed = removeBlock(session, 'main', 1);
    const stones = tombstones(removed, generated);
    expect(stones).toHaveLength(1);
    expect(stones[0]).toMatchObject({ section: 'main', before: 1 });
    const first = tombstones(removeBlock(session, 'main', 0), generated);
    expect(first[0]).toMatchObject({ section: 'main', before: 0 });
  });
});

describe('blank session and checks', () => {
  it('has an empty main part, which blocks saving', () => {
    const issues = checkSession(blankSession(), ctx);
    expect(issues.some((i) => i.code === 'main-empty')).toBe(true);
  });
});

describe('draft storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a draft and clears it', () => {
    storeDraft('programme', 'a', session);
    expect(loadDraft('programme', 'a')).toEqual(session);
    expect(loadDraft('programme', 'b')).toBeNull();
    clearDraft('programme', 'a');
    expect(loadDraft('programme', 'a')).toBeNull();
  });

  it('ignores something that is not a session', () => {
    localStorage.setItem('editor-draft:mine:x', '{"nope":1}');
    expect(loadDraft('mine', 'x')).toBeNull();
    localStorage.setItem('editor-draft:mine:y', 'not json');
    expect(loadDraft('mine', 'y')).toBeNull();
  });
});
