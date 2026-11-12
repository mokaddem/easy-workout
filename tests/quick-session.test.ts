import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import {
  LEVELS,
  SessionSchema,
  type Block,
  type MovementPattern,
  type Profile,
  type SessionItem,
} from '../src/domain';
import {
  equipmentCapabilities,
  generateQuickSession,
  isExerciseAvailable,
  QUICK_FOCUSES,
  sessionSeconds,
  type QuickFocus,
} from '../src/engine';
import { equipmentSets } from './fixtures/equipment-sets';

const items = (b: Block): SessionItem[] => (b.type === 'straight' ? [b.item] : b.items);
const pattern = (id: string) => exerciseById.get(id)!.pattern;

const CORE: MovementPattern[] = [
  'core-anti-extension',
  'core-anti-lateral',
  'core-flexion',
  'core-rotation',
  'spinal-extension',
];
const UPPER: MovementPattern[] = [
  'push-horizontal',
  'push-vertical',
  'pull-horizontal',
  'pull-vertical',
  'chest-isolation',
  'shoulder-isolation',
  'elbow-extension',
  'elbow-flexion',
  'shrug',
];
const LOWER: MovementPattern[] = [
  'squat',
  'hinge',
  'lunge',
  'hip-extension',
  'hip-abduction',
  'knee-flexion',
  'calf-raise',
];

/** Movement patterns a focus may use in its main part. */
const allowed: Record<QuickFocus, MovementPattern[] | null> = {
  full: null,
  upper: [...UPPER, ...CORE],
  lower: [...LOWER, ...CORE],
  push: [
    'push-horizontal',
    'push-vertical',
    'chest-isolation',
    'shoulder-isolation',
    'elbow-extension',
  ],
  pull: ['pull-horizontal', 'pull-vertical', 'elbow-flexion', 'shrug'],
  core: [...CORE, 'conditioning'],
  cardio: ['locomotion', 'conditioning'],
};

const profile = (level: Profile['level']): Profile => ({
  goal: 'recomposition',
  level,
  daysPerWeek: 3,
  sessionMinutes: 45,
});

const cases = Object.entries(equipmentSets).flatMap(([equipmentName, equipment]) =>
  QUICK_FOCUSES.flatMap((focus) =>
    LEVELS.flatMap((level) =>
      [15, 30, 45].map((minutes) => ({
        label: `${equipmentName}/${focus}/${level}/${minutes}min`,
        input: { profile: profile(level), equipment, minutes, focus },
      })),
    ),
  ),
);

describe(`quick sessions — ${cases.length} combinations`, () => {
  const results = cases.map((c) => ({ ...c, quick: generateQuickSession(c.input) }));

  it('are valid sessions, available with the equipment of the day', () => {
    const problems = results.flatMap(({ label, input, quick }) => {
      const parsed = SessionSchema.safeParse(quick.session);
      if (!parsed.success) return [`${label}: invalid`];
      const capabilities = equipmentCapabilities(input.equipment);
      return [...quick.session.warmup, ...quick.session.main, ...quick.session.finisher]
        .flatMap(items)
        .filter((i) => !isExerciseAvailable(exerciseById.get(i.exerciseId)!, capabilities))
        .map((i) => `${label}: ${i.exerciseId} unavailable`);
    });
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('stay on their focus', () => {
    const problems = results.flatMap(({ label, input, quick }) => {
      const patterns = allowed[input.focus];
      if (!patterns) return [];
      return (
        quick.session.main
          .flatMap(items)
          .filter((i) => !patterns.includes(pattern(i.exerciseId)))
          // Push days end with rear-delt work to balance the shoulders.
          .filter(
            (i) =>
              input.focus !== 'push' ||
              !exerciseById.get(i.exerciseId)!.primaryMuscles.includes('rear-delts'),
          )
          .map((i) => `${label}: ${i.exerciseId}`)
      );
    });
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('fit the time asked for (+10 %)', () => {
    const problems = results
      .filter(({ input, quick }) => sessionSeconds(quick.session) / 60 > input.minutes * 1.1)
      .map(({ label, quick }) => `${label}: ${Math.round(sessionSeconds(quick.session) / 60)} min`);
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('give a cardio session the exact minutes asked for', () => {
    for (const { input, quick } of results.filter((r) => r.input.focus === 'cardio')) {
      const target = items(quick.session.main[0]!)[0]!.target;
      const minutes =
        target.kind === 'cardio'
          ? target.maxMinutes
          : target.kind === 'interval'
            ? (target.rounds * (target.workSec + target.recoverySec)) / 60
            : NaN;
      expect(minutes).toBe(input.minutes);
    }
  });

  it('bodyweight-only uses no owned equipment', () => {
    const quick = generateQuickSession({
      profile: profile('intermediate'),
      equipment: [],
      minutes: 30,
      focus: 'full',
    });
    const owned = [...quick.session.warmup, ...quick.session.main, ...quick.session.finisher]
      .flatMap(items)
      .filter(
        (i) => !isExerciseAvailable(exerciseById.get(i.exerciseId)!, equipmentCapabilities([])),
      );
    expect(owned).toEqual([]);
  });

  it('are deterministic, and a new seed gives another session', () => {
    const input = {
      profile: profile('intermediate'),
      equipment: equipmentSets.reference!,
      minutes: 30,
      focus: 'full' as const,
    };
    expect(generateQuickSession(input)).toEqual(generateQuickSession(input));
    const ids = (seed: number) =>
      generateQuickSession({ ...input, seed })
        .session.main.flatMap(items)
        .map((i) => i.exerciseId)
        .join();
    expect(new Set([ids(0), ids(1), ids(2)]).size).toBe(3);
    const push = (seed: number) =>
      generateQuickSession({ ...input, focus: 'push', minutes: 45, seed })
        .session.main.flatMap(items)
        .map((i) => i.exerciseId)
        .join();
    expect(new Set([0, 1, 2, 3, 4].map(push)).size).toBeGreaterThan(1);
  });
});
