import { describe, expect, it } from 'vitest';
import { groupChanges, sessionLetters } from './swaps';

const rotation = [{ id: 'a-full-a' }, { id: 'b-full-b' }, { id: 'c-full-c' }, { id: 'cardio' }];

describe('sessionLetters', () => {
  it('numbers sessions by position and leaves the cardio day out', () => {
    expect([...sessionLetters(rotation)]).toEqual([
      ['a-full-a', 'A'],
      ['b-full-b', 'B'],
      ['c-full-c', 'C'],
      ['cardio', null],
    ]);
  });
});

describe('groupChanges', () => {
  it('groups the same swap across sessions', () => {
    const lines = groupChanges(
      [
        { sessionId: 'c-full-c', slot: 'x', from: 'step-jacks', to: 'rower' },
        { sessionId: 'a-full-a', slot: 'x', from: 'step-jacks', to: 'rower' },
        { sessionId: 'b-full-b', slot: 'y', from: 'curl', to: 'chin-up' },
        { sessionId: 'cardio', slot: 'z', from: 'step-jacks', to: 'rower' },
      ],
      sessionLetters(rotation),
    );
    expect(lines).toEqual([
      { from: 'step-jacks', to: 'rower', sessions: ['A', 'C', 'cardio'] },
      { from: 'curl', to: 'chin-up', sessions: ['B'] },
    ]);
  });

  it('falls back to the letter in the id when the session is unknown', () => {
    const lines = groupChanges([{ sessionId: 'd-upper', slot: 's', to: 'dip' }], new Map());
    expect(lines).toEqual([{ to: 'dip', sessions: ['D'] }]);
  });
});
