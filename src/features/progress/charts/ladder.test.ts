import { describe, expect, it } from 'vitest';
import type { ExercisePoint } from '@/engine';
import { columnValue, ladderModel } from './ladder';

const point = (
  n: number,
  over: Partial<ExercisePoint> & { kg?: number; reps?: number } = {},
): ExercisePoint => {
  const { kg, reps = 10, ...rest } = over;
  const day = String(1 + n).padStart(2, '0');
  return {
    logId: `l${n}`,
    at: `2026-10-${day}T10:00:00.000Z`,
    date: `2026-10-${day}`,
    source: 'programme',
    sessionId: 'a',
    sessionName: { fr: 'A', en: 'A' },
    week: 1 + Math.floor(n / 3),
    role: 'build',
    target: { kind: 'reps', min: 8, max: 12 },
    range: { min: 8, max: 12 },
    best: {
      value: reps,
      unit: 'reps',
      level: kg ?? 0,
      ...(kg !== undefined && { load: { kind: 'kg', kg } }),
    },
    sets: [],
    calibration: false,
    ...rest,
  } as ExercisePoint;
};

const now = new Date('2026-11-17T10:00:00.000Z');

describe('ladderModel', () => {
  it('places sessions inside their programme week and finds the load steps', () => {
    const points = [
      point(0, { kg: 12.5 }),
      point(1, { kg: 12.5, reps: 11 }),
      point(2, { kg: 12.5, reps: 12 }),
      point(3, { kg: 15, reps: 8 }),
    ];
    const model = ladderModel({ points, range: 'cycle', cycle: { weeks: 8, current: 2 }, now });
    expect(model.items).toHaveLength(4);
    expect(model.items[0]!.x).toBeGreaterThan(0);
    expect(model.items[0]!.x).toBeLessThan(1 / 8);
    expect(model.items[3]!.x).toBeGreaterThan(1 / 8);
    expect(model.steps).toHaveLength(1);
    expect(model.steps[0]!.from).toBe(2);
    expect(model.level?.kind).toBe('kg');
    expect(model.level?.rungs.map((r) => r.value)).toEqual([12.5, 15]);
    expect(model.slots).toHaveLength(8);
    expect(model.slots.filter((s) => s.current)).toHaveLength(1);
    expect(model.axis.at(-1)!.later).toBe(true);
    expect(model.range).toEqual({ min: 8, max: 12 });
  });

  it('draws bodyweight moves as columns only', () => {
    const points = [point(0), point(1, { reps: 14 })];
    const model = ladderModel({ points, range: 'all', now });
    expect(model.level).toBeUndefined();
    expect(model.steps).toEqual([]);
    expect(model.valueMax).toBe(14);
  });

  it('copes with no points and one point', () => {
    expect(ladderModel({ points: [], range: 'all', now }).items).toEqual([]);
    const one = ladderModel({ points: [point(0, { kg: 10 })], range: 'all', now });
    expect(one.items[0]!.x).toBe(0.5);
    expect(one.steps).toEqual([]);
  });

  it('marks pain and missing equipment', () => {
    const pain = point(0, { stopped: 'pain', partial: true });
    const none = point(1, { stopped: 'no-equipment' });
    delete (none as { best?: unknown }).best;
    const model = ladderModel({ points: [pain, none], range: 'all', now });
    expect(model.items[0]!.hollow).toBe(true);
    expect(model.items[1]!.noEquipment).toBe(true);
    expect(model.items[1]!.value).toBeUndefined();
  });

  it('assisted bands climb towards Sans, with every owned rung', () => {
    const band = (level: 'heavy' | 'medium', n: number) =>
      point(n, {
        best: {
          value: 8,
          unit: 'reps',
          level: level === 'heavy' ? -4 : -3,
          load: { kind: 'band', level },
        },
      });
    const model = ladderModel({
      points: [band('heavy', 0), band('medium', 1)],
      range: 'all',
      exercise: { loadType: 'band-assisted' } as never,
      ownedBands: ['light', 'medium', 'heavy'],
      now,
    });
    expect(model.level?.kind).toBe('assisted');
    const rungs = model.level!.rungs;
    expect(rungs.at(-1)!.sans).toBe(true);
    expect(rungs[0]!.band).toBe('heavy');
    expect(rungs.map((r) => r.value)).toEqual([...rungs.map((r) => r.value)].sort((a, b) => a - b));
  });

  it('draws one column per week past forty sessions', () => {
    const points = Array.from({ length: 45 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i * 2));
      return point(0, {
        logId: `p${i}`,
        at: d.toISOString(),
        date: d.toISOString().slice(0, 10),
      });
    });
    const model = ladderModel({ points, range: 'all', now });
    expect(model.bucketed).toBe(true);
    expect(model.items.length).toBeLessThan(45);
    expect(model.items.some((i) => i.sessions > 1)).toBe(true);
  });

  it('adds up interval rounds into minutes', () => {
    expect(columnValue({ value: 6, unit: 'rounds', level: 0, workSec: 30 })).toBe(3);
    expect(columnValue(undefined)).toBeUndefined();
  });
});
