import { describe, expect, it } from 'vitest';
import type { Limitation, Profile } from '@/domain';
import { generateProgramme } from '@/engine';
import { referenceEquipment } from '../../../../tests/fixtures/reference-equipment';
import {
  activeLimitation,
  adaptedCount,
  draftKind,
  draftOf,
  fieldsFor,
  profileWith,
  reviewAt,
  reviewDue,
  rowState,
  sameDraft,
  toggleRegion,
  weeksSince,
  withLift,
  withLimit,
} from './model';

const base: Profile = { goal: 'muscle', level: 'intermediate', daysPerWeek: 4, sessionMinutes: 45 };
const NOW = new Date('2026-11-20T10:00:00.000Z');
const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
const limit = (region: Limitation['region'], since: string, extra: Partial<Limitation> = {}) => ({
  region,
  since,
  ...extra,
});

describe('draft', () => {
  it('reads active joints in body order, and the switches', () => {
    const draft = draftOf({
      ...base,
      limitations: [
        limit('knee', at(-60)),
        limit('shoulder', at(-30)),
        limit('wrist', at(-90), { liftedAt: at(-10) }),
      ],
      quiet: true,
    });
    expect(draft).toEqual({ regions: ['shoulder', 'knee'], quiet: true, smallSpace: false });
  });

  it('compares the set of joints, not their order', () => {
    const a = { regions: ['knee', 'hip'] as const, quiet: false, smallSpace: false };
    expect(sameDraft({ ...a, regions: [...a.regions] }, { ...a, regions: ['hip', 'knee'] })).toBe(
      true,
    );
    expect(sameDraft({ ...a, regions: [...a.regions] }, { ...a, regions: ['hip'] })).toBe(false);
    expect(sameDraft({ ...a, regions: [] }, { ...a, regions: [], quiet: true })).toBe(false);
  });

  it('tells what a row will do against what is saved', () => {
    const saved = draftOf({ ...base, limitations: [limit('knee', at(-5))] });
    const draft = toggleRegion(toggleRegion(saved, 'knee', false), 'hip', true);
    expect(rowState(saved, draft, 'knee')).toBe('lifting');
    expect(rowState(saved, draft, 'hip')).toBe('adding');
    expect(rowState(saved, draft, 'wrist')).toBe('off');
    expect(rowState(saved, saved, 'knee')).toBe('on');
    expect(draftKind(saved, draft)).toBe('mixed');
    expect(draftKind(saved, toggleRegion(saved, 'hip', true))).toBe('adding');
    expect(draftKind(saved, toggleRegion(saved, 'knee', false))).toBe('lifting');
    expect(draftKind(saved, saved)).toBe('none');
  });

  it('back to the saved state is no change', () => {
    const saved = draftOf({ ...base, limitations: [limit('knee', at(-5))] });
    expect(sameDraft(saved, toggleRegion(toggleRegion(saved, 'knee', false), 'knee', true))).toBe(
      true,
    );
  });
});

describe('fields to save', () => {
  it('lifts an unticked joint and keeps its entry', () => {
    const profile = { ...base, limitations: [limit('knee', at(-40))] };
    const fields = fieldsFor(profile, { regions: [], quiet: false, smallSpace: false }, NOW);
    expect(fields.limitations).toEqual([limit('knee', at(-40), { liftedAt: NOW.toISOString() })]);
  });

  it('starts a new joint now and leaves the others as they were', () => {
    const profile = { ...base, limitations: [limit('knee', at(-40), { reviewedAt: at(-3) })] };
    const fields = fieldsFor(profile, draftOf(withLimit(profile, 'hip', NOW)), NOW);
    expect(fields.limitations).toEqual([
      limit('knee', at(-40), { reviewedAt: at(-3) }),
      limit('hip', NOW.toISOString()),
    ]);
  });

  it('ticking a lifted joint again starts a new entry beside the lifted one', () => {
    const lifted = limit('knee', at(-90), { liftedAt: at(-20) });
    const profile = { ...base, limitations: [lifted] };
    const next = withLimit(profile, 'knee', NOW);
    expect(next.limitations).toEqual([lifted, limit('knee', NOW.toISOString())]);
    expect(activeLimitation(next, 'knee')?.since).toBe(NOW.toISOString());
  });

  it('leaves switches that are off out, and nothing when nothing is set', () => {
    expect(fieldsFor(base, { regions: [], quiet: false, smallSpace: false }, NOW)).toEqual({});
    expect(fieldsFor(base, { regions: [], quiet: true, smallSpace: false }, NOW)).toEqual({
      quiet: true,
    });
  });

  it('builds the profile a programme is re-picked for, without stale switches', () => {
    const profile = { ...base, quiet: true, smallSpace: true };
    const next = profileWith(profile, { regions: ['knee'], quiet: false, smallSpace: true }, NOW);
    expect(next).toEqual({
      ...base,
      limitations: [limit('knee', NOW.toISOString())],
      smallSpace: true,
    });
    expect(withLift({ ...base, limitations: [limit('knee', at(-2))] }, 'knee', NOW)).toEqual({
      ...base,
      limitations: [limit('knee', at(-2), { liftedAt: NOW.toISOString() })],
    });
  });
});

describe('review', () => {
  it('counts whole weeks', () => {
    expect(weeksSince(at(-6 * 7), NOW)).toBe(6);
    expect(weeksSince(at(-6 * 7 + 1), NOW)).toBe(5);
    expect(weeksSince(at(3), NOW)).toBe(0);
  });

  it('asks six weeks after a joint started', () => {
    expect(reviewDue({ limitations: [limit('knee', at(-41))] }, NOW)).toBeUndefined();
    expect(reviewDue({ limitations: [limit('knee', at(-42))] }, NOW)?.region).toBe('knee');
    expect(reviewAt(limit('knee', '2026-01-01T00:00:00.000Z'))).toBe('2026-02-12T00:00:00.000Z');
  });

  it('asks again six weeks after "yes, keep it"', () => {
    const kept = limit('knee', at(-100), { reviewedAt: at(-10) });
    expect(reviewDue({ limitations: [kept] }, NOW)).toBeUndefined();
    expect(reviewDue({ limitations: [{ ...kept, reviewedAt: at(-43) }] }, NOW)?.region).toBe(
      'knee',
    );
  });

  it('asks one joint at a time, the one that has waited longest, never a lifted one', () => {
    const due = reviewDue(
      {
        limitations: [
          limit('shoulder', at(-50)),
          limit('knee', at(-80)),
          limit('hip', at(-120), { liftedAt: at(-5) }),
        ],
      },
      NOW,
    );
    expect(due?.region).toBe('knee');
    expect(reviewDue(undefined, NOW)).toBeUndefined();
    expect(reviewDue({}, NOW)).toBeUndefined();
  });
});

describe('adapted exercises', () => {
  const generated = generateProgramme({
    profile: { ...base, limitations: [{ region: 'knee', since: '2026-11-01T00:00:00.000Z' }] },
    equipment: referenceEquipment,
  });

  it('counts the exercises graded for the joint that are still in the programme', () => {
    expect(adaptedCount(generated, 'knee')).toBeGreaterThan(0);
  });

  it('is zero for a joint nothing in the programme loads', () => {
    const none = { rotation: [], generation: generated.generation };
    expect(adaptedCount(none, 'knee')).toBe(
      (generated.generation?.notes ?? []).filter(
        (n) => n.code === 'slot-limited' && n.params.region === 'knee',
      ).length,
    );
    expect(adaptedCount({ rotation: [] }, 'ankle')).toBe(0);
  });
});
