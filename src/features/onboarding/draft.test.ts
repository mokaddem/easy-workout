import { describe, expect, it } from 'vitest';
import { draftProfile, emptyDraft, firstIncompleteStep, parseBodyweight } from './draft';

describe('parseBodyweight', () => {
  it('treats empty as skipped', () => {
    expect(parseBodyweight('')).toEqual({ status: 'empty' });
    expect(parseBodyweight('  ')).toEqual({ status: 'empty' });
  });
  it('accepts dot and comma decimals', () => {
    expect(parseBodyweight('74.5')).toEqual({ status: 'ok', kg: 74.5 });
    expect(parseBodyweight('74,5')).toEqual({ status: 'ok', kg: 74.5 });
    expect(parseBodyweight('80')).toEqual({ status: 'ok', kg: 80 });
  });
  it('rejects out-of-range and malformed values', () => {
    for (const bad of ['740', '29.9', '251', 'abc', '7,4,5', '-60', '70kg', '.']) {
      expect(parseBodyweight(bad).status).toBe('invalid');
    }
  });
  it('accepts the limits', () => {
    expect(parseBodyweight('30').status).toBe('ok');
    expect(parseBodyweight('250').status).toBe('ok');
  });
});

describe('draft validation', () => {
  it('asks for the goal, then the level', () => {
    const draft = emptyDraft();
    expect(firstIncompleteStep(draft)).toBe(1);
    draft.goal = 'muscle';
    expect(firstIncompleteStep(draft)).toBe(2);
    draft.level = 'beginner';
    expect(firstIncompleteStep(draft)).toBeNull();
  });
  it('flags an invalid bodyweight on step 5', () => {
    expect(
      firstIncompleteStep({ ...emptyDraft(), goal: 'muscle', level: 'beginner', bodyweight: '9' }),
    ).toBe(5);
  });
  it('builds a profile without bodyweight when skipped', () => {
    const profile = draftProfile({ ...emptyDraft(), goal: 'muscle', level: 'beginner' });
    expect(profile).toEqual({
      goal: 'muscle',
      level: 'beginner',
      daysPerWeek: 3,
      sessionMinutes: 45,
    });
    expect(
      draftProfile({ ...emptyDraft(), goal: 'muscle', level: 'beginner', bodyweight: '71,5' })
        ?.bodyweightKg,
    ).toBe(71.5);
  });
});
