import { describe, expect, it } from 'vitest';
import type { EquipmentInventory, EquipmentRequirement, Exercise } from '../src/domain';
import {
  availableExercises,
  equipmentCapabilities,
  isExerciseAvailable,
  usableSetups,
} from '../src/engine';

const exercise = (id: string, equipment: EquipmentRequirement[][]): Exercise => ({
  id,
  name: { fr: id, en: id },
  execution: { fr: ['x'], en: ['x'] },
  keyCue: { fr: 'x', en: 'x' },
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  pattern: 'push-horizontal',
  tags: [],
  equipment,
  loadType: 'external',
  metric: 'reps',
  unilateral: false,
  difficulty: 1,
  easier: [],
  harder: [],
  animation: null,
});

const available = (ex: Exercise, inventory: EquipmentInventory) =>
  isExerciseAvailable(ex, equipmentCapabilities(inventory));

const pair = exercise('pair', [[{ kind: 'dumbbell', count: 2 }]]);
const single = exercise('single', [[{ kind: 'dumbbell', count: 1 }]]);

describe('equipment matching', () => {
  it('needs nothing for bodyweight and household setups', () => {
    expect(available(exercise('bw', [[]]), [])).toBe(true);
    expect(available(exercise('dips', [[{ kind: 'chair', count: 2 }]]), [])).toBe(true);
  });

  it('rejects owned kinds missing from the inventory', () => {
    expect(available(single, [])).toBe(false);
    expect(available(exercise('bar', [[{ kind: 'pull-up-bar' }]]), [])).toBe(false);
  });

  it('requires a matched pair for two-dumbbell setups', () => {
    const adjustable = (count: 1 | 2): EquipmentInventory => [
      { id: 'a', kind: 'dumbbell', mode: 'adjustable', count, minKg: 2, maxKg: 20, incrementKg: 2 },
    ];
    expect(available(pair, adjustable(2))).toBe(true);
    expect(available(pair, adjustable(1))).toBe(false);
    expect(available(single, adjustable(1))).toBe(true);

    const fixed = (...kgs: number[]): EquipmentInventory => [
      { id: 'f', kind: 'dumbbell', mode: 'fixed', weights: kgs.map((kg) => ({ kg, count: 1 })) },
    ];
    expect(available(pair, fixed(10, 12))).toBe(false);
    expect(available(pair, fixed(10, 10))).toBe(true);
    expect(available(pair, [...adjustable(1), ...fixed(10)])).toBe(true);
    expect(available(pair, [...adjustable(1), ...fixed(11)])).toBe(false);
  });

  it('distinguishes incline benches from flat ones', () => {
    const incline = exercise('incline', [[{ kind: 'bench', incline: true }]]);
    const flat = exercise('flat', [[{ kind: 'bench' }]]);
    const flatBench: EquipmentInventory = [{ id: 'b', kind: 'bench', incline: false }];
    expect(available(flat, flatBench)).toBe(true);
    expect(available(incline, flatBench)).toBe(false);
    expect(available(incline, [{ id: 'b', kind: 'bench', incline: true }])).toBe(true);
  });

  it('requires a treadmill that inclines for incline walking', () => {
    const inclineWalk = exercise('incline-walk', [[{ kind: 'treadmill', incline: true }]]);
    const treadmill = (maxInclinePct: number): EquipmentInventory => [
      { id: 't', kind: 'treadmill', maxSpeedKmh: 12, maxInclinePct },
    ];
    expect(available(inclineWalk, treadmill(0))).toBe(false);
    expect(available(inclineWalk, treadmill(10))).toBe(true);
  });

  it('keeps bands and mini-bands apart', () => {
    const band = exercise('band', [[{ kind: 'band' }]]);
    expect(available(band, [{ id: 'm', kind: 'mini-band', levels: ['light'] }])).toBe(false);
    expect(available(band, [{ id: 'b', kind: 'band', levels: ['light'] }])).toBe(true);
  });

  it('accepts any one setup and reports which ones work', () => {
    const press = exercise('press', [
      [{ kind: 'dumbbell', count: 2 }, { kind: 'bench' }],
      [{ kind: 'dumbbell', count: 2 }, { kind: 'mat' }],
    ]);
    const caps = equipmentCapabilities([
      {
        id: 'a',
        kind: 'dumbbell',
        mode: 'adjustable',
        count: 2,
        minKg: 2,
        maxKg: 20,
        incrementKg: 2,
      },
    ]);
    expect(usableSetups(press, caps)).toEqual([[{ kind: 'dumbbell', count: 2 }, { kind: 'mat' }]]);
  });

  it('filters a list by inventory', () => {
    const bw = exercise('bw', [[]]);
    expect(availableExercises([bw, single, pair], []).map((e) => e.id)).toEqual(['bw']);
  });
});
