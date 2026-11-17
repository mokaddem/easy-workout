import { describe, expect, it } from 'vitest';
import type { Answer } from '@/domain';
import { exerciseById } from '@/catalogue';
import type { ExerciseListItem, ExercisePoint } from '@/engine';
import { dotOf, familyOf, feelOf, listView, sinceSummary, swapLinks } from './logic';

const item = (exerciseId: string, n: number): ExerciseListItem => ({
  exerciseId,
  lastAt: `2026-11-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`,
  lastLogId: `l${n}`,
  sessions: 3,
  pain: false,
});

const pt = (value: number, level: number, load?: ExercisePoint['best']): ExercisePoint =>
  ({
    logId: 'x',
    best: load ?? {
      value,
      unit: 'reps',
      level,
      ...(level ? { load: { kind: 'kg', kg: level } } : {}),
    },
    sets: [],
  }) as unknown as ExercisePoint;

describe('families', () => {
  it('files patterns under the five families', () => {
    expect(familyOf('push-horizontal')).toBe('push');
    expect(familyOf('hinge')).toBe('legs');
    expect(familyOf('core-flexion')).toBe('core');
    expect(familyOf('locomotion')).toBe('cardio');
  });
});

describe('listView', () => {
  const ids = ['push-up', 'pull-up', 'plank'].filter((id) => exerciseById.has(id));
  const items = ids.map((id, i) => item(id, i)).reverse();
  it('has recent first and families after', () => {
    const view = listView(items, exerciseById, 'en', '');
    expect(view.recent.length).toBe(items.length);
    expect(view.groups.length).toBeGreaterThan(1);
    expect(view.flat).toBeUndefined();
  });
  it('flattens on a query, ignoring accents and case', () => {
    const view = listView(items, exerciseById, 'en', 'PUSH');
    expect(view.flat?.map((i) => i.exerciseId)).toContain('push-up');
    expect(view.flat?.every((i) => i.exerciseId !== 'plank')).toBe(true);
    expect(listView(items, exerciseById, 'en', 'zzzz').flat).toEqual([]);
  });
});

describe('feelOf', () => {
  it('prefers hard, else the last feel', () => {
    expect(feelOf([{ feel: 'easy' }, { feel: 'hard' }] as never)).toBe('hard');
    expect(feelOf([{ feel: 'easy' }, { feel: 'right' }] as never)).toBe('right');
    expect(feelOf([{}] as never)).toBeUndefined();
  });
});

describe('sinceSummary', () => {
  it('is empty with one session', () => {
    expect(sinceSummary([pt(10, 12.5)])).toBeUndefined();
  });
  it('reads a load step', () => {
    expect(sinceSummary([pt(10, 12.5), pt(12, 15), pt(8, 17.5)])).toEqual({
      kind: 'load',
      from: 12.5,
      to: 17.5,
      delta: 5,
      added: false,
    });
  });
  it('reads rep gains at a bodyweight', () => {
    expect(sinceSummary([pt(10, 0), pt(15, 0)])).toEqual({ kind: 'reps', count: 5, time: false });
  });
  it('is empty when nothing gained', () => {
    expect(sinceSummary([pt(10, 0), pt(10, 0)])).toBeUndefined();
  });
  it('reads bands', () => {
    const band = (level: 'heavy' | 'medium', n: number): ExercisePoint['best'] => ({
      value: 8,
      unit: 'reps',
      level: n,
      load: { kind: 'band', level },
    });
    expect(sinceSummary([pt(0, 0, band('heavy', -4)), pt(0, 0, band('medium', -3))])).toEqual({
      kind: 'bands',
      count: 1,
      from: 'heavy',
      to: 'medium',
    });
  });
});

describe('dotOf', () => {
  it('shows changes and notable holds only', () => {
    expect(dotOf({ code: 'load-up', params: {} })).toBe('change');
    expect(dotOf({ code: 'hold-miss', params: {} })).toBe('hold');
    expect(dotOf({ code: 'hold-pain', params: {} })).toBe('pain');
    expect(dotOf({ code: 'hold', params: {} })).toBeUndefined();
  });
});

describe('swapLinks', () => {
  const swap = (exerciseId: string, substituteId: string): Answer => ({
    id: `${exerciseId}-${substituteId}`,
    exerciseId,
    kind: 'harder',
    answer: 'swap',
    substituteId,
    at: '2026-11-01T10:00:00.000Z',
  });
  it('reads both directions', () => {
    const answers = [swap('a', 'b')];
    expect(swapLinks('b', answers)).toEqual({ replaces: ['a'] });
    expect(swapLinks('a', answers)).toEqual({ replaces: [], replacedBy: 'b' });
    expect(swapLinks('c', answers)).toEqual({ replaces: [] });
  });
});
