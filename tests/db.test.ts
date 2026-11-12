import { afterEach, describe, expect, it } from 'vitest';
import { WorkoutDatabase } from '../src/db';
import type { EquipmentItem } from '../src/domain';

let database: WorkoutDatabase | undefined;

afterEach(async () => {
  await database?.delete();
  database = undefined;
});

describe('local database', () => {
  it('stores and reads back equipment with its specs', async () => {
    database = new WorkoutDatabase(`test-${crypto.randomUUID()}`);
    const dumbbells: EquipmentItem = {
      id: 'db-1',
      kind: 'dumbbell',
      mode: 'adjustable',
      count: 2,
      minKg: 2.5,
      maxKg: 24,
      incrementKg: 2,
    };
    await database.equipment.put(dumbbells);
    expect(await database.equipment.get('db-1')).toEqual(dumbbells);
    expect(await database.equipment.where('kind').equals('dumbbell').count()).toBe(1);
  });
});
