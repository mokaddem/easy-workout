import { describe, expect, it } from 'vitest';
import {
  EquipmentRequirementSchema,
  ExerciseSchema,
  ProgrammeSchema,
  SetLogSchema,
  TargetSchema,
  type Exercise,
} from '../src/domain';
import { referenceProgramme } from './fixtures/reference-programme';

const gobletSquat: Exercise = {
  id: 'goblet-squat',
  name: { fr: 'Squat goblet', en: 'Goblet squat' },
  execution: {
    fr: [
      'Tiens un haltère verticalement contre ta poitrine.',
      'Descends en squat, fesses vers l’arrière et le bas.',
      'Remonte en poussant dans les talons.',
    ],
    en: [
      'Hold one dumbbell vertically against your chest.',
      'Squat down, hips back and down.',
      'Stand up by driving through your heels.',
    ],
  },
  keyCue: {
    fr: 'Le poids sur la poitrine aide à garder le buste droit. Talons au sol.',
    en: 'The weight on your chest keeps your torso upright. Heels stay down.',
  },
  primaryMuscles: ['quads', 'glutes'],
  secondaryMuscles: ['adductors', 'abs'],
  pattern: 'squat',
  tags: ['compound'],
  equipment: [[{ kind: 'dumbbell', count: 1 }], [{ kind: 'kettlebell', count: 1 }]],
  loadType: 'external',
  metric: 'reps',
  unilateral: false,
  difficulty: 2,
  easier: ['bodyweight-squat'],
  harder: ['bulgarian-split-squat'],
  joints: { knee: 'moderate' },
};

describe('exercise schema', () => {
  it('accepts a complete exercise', () => {
    expect(ExerciseSchema.safeParse(gobletSquat).success).toBe(true);
  });

  it('rejects a muscle listed as both primary and secondary', () => {
    const ex = { ...gobletSquat, secondaryMuscles: ['quads'] };
    expect(ExerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('rejects execution steps that differ in count between languages', () => {
    const ex = { ...gobletSquat, execution: { ...gobletSquat.execution, en: ['Squat.'] } };
    expect(ExerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('requires added-load options exactly on loadable bodyweight moves', () => {
    const loadable = { ...gobletSquat, equipment: [[]], loadType: 'bodyweight-loadable' };
    const belt = [{ kind: 'weight-belt' }];
    expect(ExerciseSchema.safeParse(loadable).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...loadable, addedLoad: belt }).success).toBe(true);
    expect(ExerciseSchema.safeParse({ ...gobletSquat, addedLoad: belt }).success).toBe(false);
  });

  it('only accepts kilogram implements as added load', () => {
    const loadable = { ...gobletSquat, equipment: [[]], loadType: 'bodyweight-loadable' };
    const miniBand = [{ kind: 'mini-band' }];
    expect(ExerciseSchema.safeParse({ ...loadable, addedLoad: miniBand }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(ExerciseSchema.safeParse({ ...gobletSquat, video: 'x' }).success).toBe(false);
  });

  it('rejects an incline requirement on anything but a bench', () => {
    expect(EquipmentRequirementSchema.safeParse({ kind: 'chair', incline: true }).success).toBe(
      false,
    );
  });
});

describe('targets', () => {
  it('rejects inverted ranges', () => {
    expect(TargetSchema.safeParse({ kind: 'reps', min: 12, max: 8 }).success).toBe(false);
    expect(TargetSchema.safeParse({ kind: 'time', minSec: 60, maxSec: 30 }).success).toBe(false);
  });

  it('accepts work/recovery intervals with optional treadmill settings', () => {
    const interval = { kind: 'interval', rounds: 8, workSec: 30, recoverySec: 30 };
    expect(TargetSchema.safeParse(interval).success).toBe(true);
    expect(
      TargetSchema.safeParse({
        ...interval,
        workSpeedKmh: 5,
        workInclinePct: 12,
        recoveryInclinePct: 3,
      }).success,
    ).toBe(true);
    expect(TargetSchema.safeParse({ ...interval, workSec: 2 }).success).toBe(false);
  });
});

describe('programme schema', () => {
  it('rejects overlapping phases', () => {
    const programme = {
      ...referenceProgramme,
      phases: [
        { name: { fr: 'A', en: 'A' }, fromWeek: 1, toWeek: 3, adjustments: [] },
        { name: { fr: 'B', en: 'B' }, fromWeek: 3, toWeek: 4, adjustments: [] },
      ],
    };
    expect(ProgrammeSchema.safeParse(programme).success).toBe(false);
  });

  it('rejects phases beyond the programme length', () => {
    const programme = {
      ...referenceProgramme,
      phases: [{ name: { fr: 'A', en: 'A' }, fromWeek: 8, toWeek: 9, adjustments: [] }],
    };
    expect(ProgrammeSchema.safeParse(programme).success).toBe(false);
  });
});

describe('set log schema', () => {
  const base = {
    section: 'main',
    blockIndex: 0,
    itemIndex: 0,
    set: 1,
    exerciseId: 'goblet-squat',
    planned: { target: { kind: 'reps', min: 8, max: 10 } },
    at: '2026-11-12T10:00:00Z',
  };

  it('is either performed or flagged', () => {
    expect(SetLogSchema.safeParse({ ...base, actual: { reps: 10 }, feel: 'right' }).success).toBe(
      true,
    );
    expect(SetLogSchema.safeParse({ ...base, flag: 'pain' }).success).toBe(true);
    expect(SetLogSchema.safeParse(base).success).toBe(false);
    // Pain can keep the reps done before it; missing equipment means nothing was done.
    expect(SetLogSchema.safeParse({ ...base, actual: { reps: 4 }, flag: 'pain' }).success).toBe(
      true,
    );
    expect(
      SetLogSchema.safeParse({ ...base, actual: { reps: 4 }, flag: 'no-equipment' }).success,
    ).toBe(false);
    expect(SetLogSchema.safeParse({ ...base, flag: 'pain', feel: 'hard' }).success).toBe(false);
    expect(SetLogSchema.safeParse({ ...base, actual: { reps: 4 }, flag: 'skipped' }).success).toBe(
      false,
    );
  });
});
