import { describe, expect, it } from 'vitest';
import type { Answer, Session } from '@/domain';
import type { Proposal } from '@/engine';
import {
  breakNotice,
  exerciseIds,
  itemGoals,
  nudgeNames,
  orderProposals,
  pendingPainFor,
  swapAnswerFor,
} from './adaptation';

const session = (rir?: number): Pick<Session, 'warmup' | 'main' | 'finisher'> => ({
  warmup: [],
  main: [
    {
      type: 'straight',
      sets: 3,
      restSec: 90,
      item: {
        exerciseId: 'push-up',
        target: { kind: 'reps', min: 8, max: 10 },
        goal: 9,
        ...(rir !== undefined && { rir }),
      },
    },
  ],
  finisher: [],
});

describe('itemGoals', () => {
  it('gives every set the item goal', () => {
    expect(itemGoals(session(2))['main/0/0']).toEqual({ first: 9, rest: 9, sets: 3 });
  });
  it('asks more of a first set at a lower reserve', () => {
    const goals = itemGoals(session(2), { firstSetRir: 1 })['main/0/0']!;
    expect(goals.first).toBeGreaterThan(goals.rest);
  });
});

const proposal = (kind: Proposal['kind'], exerciseId: string): Proposal => ({
  kind,
  exerciseId,
  logId: 'l1',
});

describe('orderProposals', () => {
  it('puts the next session first, then pain, no equipment, assisted, easier, harder', () => {
    const list = [
      proposal('harder', 'a'),
      proposal('easier', 'b'),
      proposal('pain', 'c'),
      proposal('harder', 'd'),
      proposal('no-equipment', 'e'),
    ];
    const ordered = orderProposals(list, new Set(['d']));
    expect(ordered.map((p) => p.exerciseId)).toEqual(['d', 'c', 'e', 'b', 'a']);
  });
});

describe('nudgeNames', () => {
  const name = (id: string) => id.toUpperCase();
  it('names the exercise of the next session first', () => {
    const list = [proposal('pain', 'a'), proposal('harder', 'b')];
    expect(nudgeNames(list, new Set(['a']), name)).toEqual({ kind: 'one', names: ['A'], more: 0 });
  });
  it('else two names and the rest counted', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => proposal('harder', id));
    expect(nudgeNames(list, new Set(), name)).toEqual({
      kind: 'names',
      names: ['A', 'B'],
      more: 2,
    });
  });
});

describe('swaps and pain', () => {
  const answer = (a: Partial<Answer>): Answer => ({
    id: Math.random().toString(),
    exerciseId: 'x',
    kind: 'pain',
    answer: 'swap',
    substituteId: 'y',
    at: '2026-11-10T10:00:00.000Z',
    ...a,
  });
  it('finds the active swap, not one undone by "back"', () => {
    const swap = answer({});
    expect(swapAnswerFor([swap], 'x')).toBe(swap);
    const back = answer({ answer: 'back', at: '2026-11-11T10:00:00.000Z' });
    delete (back as { substituteId?: string }).substituteId;
    expect(swapAnswerFor([swap, back], 'x')).toBeUndefined();
  });
  it('only a waiting pain with the lighter note is pending', () => {
    const p = proposal('pain', 'x');
    expect(pendingPainFor({ code: 'pain-lighter', params: {} }, [p], 'x')).toBe(p);
    expect(pendingPainFor({ code: 'pain-lighter', params: { pending: false } }, [p], 'x')).toBe(
      undefined,
    );
    expect(pendingPainFor({ code: 'hold', params: {} }, [p], 'x')).toBeUndefined();
  });
});

describe('breakNotice', () => {
  it('reads the days and the wording from the note', () => {
    expect(breakNotice({ a: { code: 'goal-eased', params: { days: 20 } } })).toEqual({
      key: 'eased',
      days: 20,
    });
    expect(breakNotice({ a: { code: 'goal-eased', params: { days: 30 } } })?.key).toBe('stepped');
    expect(breakNotice({ a: { code: 'welcome-back', params: { days: 100 } } })?.key).toBe('long');
    expect(breakNotice({ a: { code: 'hold', params: {} } })).toBeUndefined();
  });
});

describe('exerciseIds', () => {
  it('lists every exercise of a session', () => {
    expect([...exerciseIds(session())]).toEqual(['push-up']);
  });
});
