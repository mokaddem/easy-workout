import { describe, expect, it } from 'vitest';
import type { EquipmentInventory, Profile, SessionLog } from '@/domain';
import { generateProgramme } from '@/engine';
import { nextSession, onlyConstraintsDiffer, programmeFreshness } from './programme-state';

const profile: Profile = {
  goal: 'muscle',
  level: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 45,
};
const equipment: EquipmentInventory = [
  { id: 'bands', kind: 'band', levels: ['light', 'medium'] },
  { id: 'bar', kind: 'pull-up-bar', mount: 'doorway' },
];
const programme = { ...generateProgramme({ profile, equipment }), id: 'p1' };

describe('programmeFreshness', () => {
  it('is current for the inputs it was generated from, whatever the order', () => {
    expect(programmeFreshness(programme, profile, [...equipment].reverse())).toBe('current');
    const reordered = [
      { mount: 'doorway', kind: 'pull-up-bar', id: 'bar' } as const,
      equipment[0]!,
    ];
    expect(programmeFreshness(programme, profile, reordered)).toBe('current');
  });

  it('is out of date after minutes, level, bodyweight or equipment changes', () => {
    expect(programmeFreshness(programme, { ...profile, sessionMinutes: 30 }, equipment)).toBe(
      'out-of-date',
    );
    expect(programmeFreshness(programme, { ...profile, level: 'advanced' }, equipment)).toBe(
      'out-of-date',
    );
    expect(programmeFreshness(programme, { ...profile, bodyweightKg: 80 }, equipment)).toBe(
      'out-of-date',
    );
    expect(programmeFreshness(programme, profile, equipment.slice(1))).toBe('out-of-date');
  });

  it('needs a new programme when the goal or the days change', () => {
    expect(programmeFreshness(programme, { ...profile, daysPerWeek: 4 }, equipment)).toBe(
      'needs-new',
    );
    expect(programmeFreshness(programme, { ...profile, goal: 'recomposition' }, equipment)).toBe(
      'needs-new',
    );
  });
});

describe('nextSession', () => {
  const done = (n: number, programmeId = 'p1'): SessionLog[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `l${i}`,
      source: { kind: 'programme', programmeId, week: 1, sessionId: 'x' },
      plan: programme.rotation[0]!,
      status: 'completed',
      startedAt: '2026-11-12T10:00:00Z',
      sets: [],
    }));

  it('starts at week 1, first session', () => {
    expect(nextSession(programme)).toMatchObject({ week: 1, index: 0, finished: false });
  });

  it('moves on one session per completed log of this programme', () => {
    expect(nextSession(programme, done(4))).toMatchObject({ week: 2, index: 1 });
    expect(nextSession(programme, done(4, 'other'))).toMatchObject({ week: 1, index: 0 });
  });

  it('skips logs that do not count as done', () => {
    const logs = done(3).map((log, i) => (i === 2 ? { ...log, countsAsDone: false } : log));
    expect(nextSession(programme, logs)).toMatchObject({ week: 1, index: 2 });
    const abandoned = done(1).map((log) => ({ ...log, status: 'abandoned' as const }));
    expect(nextSession(programme, abandoned)).toMatchObject({ week: 1, index: 0 });
  });

  it('stays on the last session once everything is done', () => {
    const all = programme.sessionsPerWeek * programme.weeks;
    expect(nextSession(programme, done(all))).toMatchObject({
      week: programme.weeks,
      finished: true,
    });
  });
});

describe('onlyConstraintsDiffer', () => {
  it('is true when only a joint, quiet or small space changed', () => {
    const limited = { ...profile, limitations: [{ region: 'knee' as const, since: '2026-11-01' }] };
    expect(onlyConstraintsDiffer(programme, limited, equipment)).toBe(true);
    expect(onlyConstraintsDiffer(programme, { ...profile, quiet: true }, equipment)).toBe(true);
  });

  it('is false for a current programme or when something else changed too', () => {
    expect(onlyConstraintsDiffer(programme, profile, equipment)).toBe(false);
    expect(
      onlyConstraintsDiffer(programme, { ...profile, quiet: true, sessionMinutes: 30 }, equipment),
    ).toBe(false);
    expect(onlyConstraintsDiffer(programme, { ...profile, quiet: true }, equipment.slice(1))).toBe(
      false,
    );
  });
});
